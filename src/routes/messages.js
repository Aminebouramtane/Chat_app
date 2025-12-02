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
                // Try to notify recipient if connected via WS
                try {
                    if (fastify && fastify.wss && typeof fastify.wss.sendToUser === 'function') {
                        const pushed = fastify.wss.sendToUser(created.RecieverId, { type: 'msg', data: created });
                        if (pushed) {
                            // mark delivered in DB
                            try { await prisma.messages.update({ where: { id: created.id }, data: { delivered: true } }); } catch(e) { /* ignore */ }
                            // notify sender if online
                            if (fastify.wss.isOnline(created.senderId) && fastify.wss.sendToUser(created.senderId)) {
                                fastify.wss.sendToUser(created.senderId, { type: 'delivered', data: { messageId: created.id, toUserId: created.RecieverId } });
                            }
                        }
                    }
                } catch (e) { /* ignore push errors */ }
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

        // validate users exist
        try {
            const [userA, userB] = await Promise.all([
                prisma.user.findUnique({ where: { id: a } }),
                prisma.user.findUnique({ where: { id: b } }),
            ]);
            if (!userA || !userB) return reply.code(404).send({ error: 'no_messages_or_user_not_exists', message: 'There are no messages or user does not exist' });
        } catch (e) {
            req.log.error(e);
            return reply.code(500).send({ error: 'server_error', message: 'Failed to validate users' });
        }

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

        if (!msgs || msgs.length === 0) return reply.code(404).send({ error: 'no_messages_or_user_not_exists', message: 'There are no messages or user does not exist' });

        return msgs;
    });
};