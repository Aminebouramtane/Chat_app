const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = async function (fastify, opts) {
    fastify.get('/', async (req, reply) => {
        const users = await prisma.user.findMany({ select: { id: true, username:
        true, Avatarurl: true, status: true } });
        return users;
    });
    fastify.get('/:id', async (req, reply) => {
        const id = Number(req.params.id);
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return reply.code(404).send({ error: 'Not found' });
        return user;
    });
};