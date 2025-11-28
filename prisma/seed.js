const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
await prisma.user.createMany({
    data: [
        { username: 'alice', email: 'alice@example.com', passwordHash: 'x' },
        { username: 'bob', email: 'bob@example.com', passwordHash: 'x' }
        ],
        skipDuplicates: true,
    });
    const alice = await prisma.user.findUnique({ where: { username:'alice' } });
    const bob = await prisma.user.findUnique({ where: { username: 'bob' } });

    if (alice && bob) {
        await prisma.messages.create({
        data: { senderId: alice.id, RecieverId: bob.id, content: 'Hello Bob!' }
        });
    await prisma.messages.create({
        data: { senderId: bob.id, RecieverId: alice.id, content: 'Hi Alice!' }
        });
    }
}
main()
.catch(e => { console.error(e); process.exit(1); })
.finally(async () => { await prisma.$disconnect(); });