const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = async function (fastify, opts) {
    fastify.get('/', async (req, reply) => {
        const users = await prisma.user.findMany({ select: { id: true, username:
        true, Avatarurl: true, status: true } });
        return users;
    });
    // Development helper: seed test users (idempotent)
    fastify.post('/seed', async (req, reply) => {
        try {
            await prisma.user.createMany({
                data: [
                    { username: 'alice', email: 'alice@example.com', passwordHash: 'x' },
                    { username: 'bob', email: 'bob@example.com', passwordHash: 'x' },
                    { username: 'carol', email: 'carol@example.com', passwordHash: 'x' },
                    { username: 'dave', email: 'dave@example.com', passwordHash: 'x' },
                    { username: 'eve', email: 'eve@example.com', passwordHash: 'x' }
                ],
                skipDuplicates: true,
            });
            const users = await prisma.user.findMany({ select: { id: true, username: true, Avatarurl: true, status: true } });
            return reply.code(201).send(users);
        } catch (e) {
            request.log && request.log.error && request.log.error(e);
            return reply.code(500).send({ error: 'seed_failed' });
        }
    });
    // Mark a user as online (development helper + quick status update)
    fastify.post('/:id/online', async (req, reply) => {
        const id = Number(req.params.id);
        if (!id) return reply.code(400).send({ error: 'invalid_id' });
        try {
            await prisma.user.update({ where: { id }, data: { status: 'ONLINE' } });
            const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, status: true } });
            return reply.code(200).send(user);
        } catch (e) {
            req.log && req.log.error && req.log.error(e);
            return reply.code(500).send({ error: 'update_failed' });
        }
    });

    // Mark a user as offline
    fastify.post('/:id/offline', async (req, reply) => {
        const id = Number(req.params.id);
        if (!id) return reply.code(400).send({ error: 'invalid_id' });
        try {
            await prisma.user.update({ where: { id }, data: { status: 'OFFLINE' } });
            const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, status: true } });
            return reply.code(200).send(user);
        } catch (e) {
            req.log && req.log.error && req.log.error(e);
            return reply.code(500).send({ error: 'update_failed' });
        }
    });
    fastify.get('/:id', async (req, reply) => {
        const id = Number(req.params.id);
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return reply.code(404).send({ error: 'Not found' });
        return user;
    });
};