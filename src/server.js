require('dotenv').config();
const Fastify = require('fastify');
const fastify = Fastify({ logger: true });
const path = require('path');
// CORS for dev
fastify.register(require('@fastify/cors'), { origin: true });
// WebSocket
fastify.register(require('@fastify/websocket'));

// Root health / info route
fastify.get('/', async (req, reply) => {
  return { message: 'OK', routes: ['/users', '/messages'] };
});

// Serve simple chat test page
fastify.get('/chat', async (req, reply) => {
  const fs = require('fs');
  const file = path.join(__dirname, '..', 'public', 'chat.html');
  try {
    return reply.type('text/html').send(fs.createReadStream(file));
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send('failed to load chat page');
  }
});
// register routes
fastify.register(require('./routes/users'), { prefix: '/users' });
fastify.register(require('./routes/messages'), { prefix: '/messages' });

// ws entry
fastify.register(require('./ws'));
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port: +port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();