const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = async function (fastify, opts) {
    fastify.get('/', async (req, reply) => {
        const users = await prisma.user.findMany({ select: { id: true, username: true, Avatarurl: true, status: true } });
        return users;
    });
    fastify.get('/:id', async (req, reply) => {
        const id = Number(req.params.id);
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return reply.code(404).send({ error: 'Not found' });
        return user;
    });
    // Create a message (REST)
    fastify.post('/', async (req, reply) => {
        const { senderId, recieverId, content } = req.body || {};
        const missing = [];
        if (!senderId) missing.push('senderId');
        if (!recieverId) missing.push('recieverId');
        if (!content) missing.push('content');
        if (missing.length) return reply.code(400).send({ error: 'validation_error', missing, message: 'Missing required fields' });

        // Optionally check sender exists
        try {
            const sender = await prisma.user.findUnique({ where: { id: Number(senderId) } });
            if (!sender) return reply.code(400).send({ error: 'invalid_sender', message: 'senderId does not exist' });
        } catch (e) {
            req.log.error(e);
            return reply.code(500).send({ error: 'server_error', message: 'Failed to validate sender' });
        }

        try {
            const created = await prisma.messages.create({
                    data: {
                        senderId: Number(senderId),
                        RecieverId: Number(recieverId),
                        content: String(content),
                    },
                    include: {
                        sender: { select: { id: true, username: true } },
                        Reciever: { select: { id: true, username: true } }
                    }
                });
                return reply.code(201).send({ status: 'ok', data: created });
        } catch (e) {
            req.log.error(e);
            return reply.code(500).send({ error: 'server_error', message: 'failed to create message' });
        }
    });

    // Get conversation between two users: /messages/conversation?userA=1&userB=2
    fastify.get('/conversation', async (req, reply) => {
        const a = Number(req.query.userA);
        const b = Number(req.query.userB);
        if (!a || !b) return reply.code(400).send({ error: 'userA and userB query params required' });
        const msgs = await prisma.messages.findMany({
            where: {
                OR: [
                    { senderId: a, RecieverId: b },
                    { senderId: b, RecieverId: a },
                ],
            },
            orderBy: { CreatedAt: 'asc' },
            include: {
                sender: { select: { id: true, username: true } },
                Reciever: { select: { id: true, username: true } }
            }
        });
        return msgs;
    });
};