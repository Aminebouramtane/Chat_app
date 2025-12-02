const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async function (fastify, opts) {
  // expose a small wss helper on the fastify instance so other routes can push messages
  if (!fastify.hasDecorator || !fastify.hasDecorator('wss')) {
    try {
      fastify.decorate('wss', {
        sendToUser: (userId, obj) => {
          const s = userSockets.get(String(userId));
          if (s && s.readyState === s.OPEN) {
            try { s.send(JSON.stringify(obj)); return true; } catch (e) { return false; }
          }
          return false;
        },
        isOnline: (userId) => userSockets.has(String(userId))
      });
    } catch (e) {
      // ignore decorate errors
    }
  }
  // Map of userId -> websocket
  const userSockets = new Map();
  // Also keep a set of all sockets for cleanup
  const allSockets = new Set();

  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const socket = connection.socket;
    allSockets.add(socket);

    // helper to send structured message
    const send = (s, obj) => {
      try { s.send(JSON.stringify(obj)); } catch (e) { /* ignore */ }
    };

    // on message: first message may be {type:'identify',data:{userId}}
    socket.on('message', async (message) => {
      let parsed;
      try {
        parsed = JSON.parse(message.toString());
      } catch (e) {
        return send(socket, { type: 'error', code: 'invalid_json', message: 'Invalid JSON' });
      }

      // identification message
      if (parsed?.type === 'identify' && parsed?.data?.userId) {
        const uid = String(parsed.data.userId);
        userSockets.set(uid, socket);
        socket._userId = uid;
        // mark this user as ONLINE in the database
        (async () => {
          try {
            await prisma.user.update({ where: { id: Number(uid) }, data: { status: 'ONLINE' } });
          } catch (e) { /* ignore update errors */ }
        })();

        // send to the newly connected socket the list of currently online users
        const onlineList = Array.from(userSockets.keys());
        send(socket, { type: 'presence_list', data: onlineList });

        // deliver any undelivered messages queued for this user
        (async () => {
          try {
            const pending = await prisma.messages.findMany({
              where: { RecieverId: Number(uid), delivered: false },
              include: { sender: { select: { id: true, username: true } }, Reciever: { select: { id: true, username: true } } }
            });
            for (const msg of pending) {
              if (socket && socket.readyState === socket.OPEN) send(socket, { type: 'msg', data: msg });
              try { await prisma.messages.update({ where: { id: msg.id }, data: { delivered: true } }); } catch (e) { /* ignore */ }
              const sSock = userSockets.get(String(msg.senderId));
              if (sSock && sSock.readyState === sSock.OPEN) send(sSock, { type: 'delivered', data: { messageId: msg.id, toUserId: Number(uid) } });
            }
          } catch (e) { /* ignore */ }
        })();

        // announce to other connected sockets that this user is online
        for (const [otherId, s] of userSockets.entries()) {
          if (otherId === uid) continue;
          if (s && s.readyState === s.OPEN) send(s, { type: 'presence', data: { userId: uid, status: 'online' } });
        }

        return send(socket, { type: 'identified', data: { userId: uid } });
      }

      // handle message sending
      if (parsed?.type === 'msg' && parsed.data) {
        const { senderId, recieverId, content } = parsed.data;
        if (!senderId || !recieverId || !content) {
          return send(socket, { type: 'error', code: 'validation', message: 'senderId, recieverId and content are required' });
        }

        try {
          const created = await prisma.messages.create({
            data: {
              senderId: Number(senderId),
              RecieverId: Number(recieverId),
              content: String(content),
              delivered: false
            },
            include: {
              sender: { select: { id: true, username: true } },
              Reciever: { select: { id: true, username: true } }
            }
          });

          // Acknowledge sender with created object
          send(socket, { type: 'ack', data: created });

          // If recipient is connected, send to them and mark delivered
          const rSock = userSockets.get(String(recieverId));
          if (rSock && rSock.readyState === rSock.OPEN) {
            try {
              // send to recipient
              send(rSock, { type: 'msg', data: created });
              // mark message as delivered in DB
              await prisma.messages.update({ where: { id: created.id }, data: { delivered: true } });
              // notify sender socket that their message was delivered
              const sSock = userSockets.get(String(senderId));
              if (sSock && sSock.readyState === sSock.OPEN) {
                send(sSock, { type: 'delivered', data: { messageId: created.id, toUserId: Number(recieverId) } });
              }
            } catch (e) {
              // ignore deliver errors (message remains undelivered)
            }
          }
        } catch (dbErr) {
          console.error('failed to persist message', dbErr);
          return send(socket, { type: 'error', code: 'server_error', message: 'Failed to save message' });
        }
        return;
      }

      // For all other types, return unknown type error
      return send(socket, { type: 'error', code: 'unknown_type', message: 'Unknown message type' });
    });

    socket.on('close', () => {
      allSockets.delete(socket);
      if (socket._userId) {
        const uid = String(socket._userId);
        userSockets.delete(uid);
        // mark user offline in DB
        (async ()=>{
          try { await prisma.user.update({ where: { id: Number(uid) }, data: { status: 'OFFLINE' } }); } catch(e) { /* ignore */ }
        })();
        // announce offline to remaining sockets
        for (const [otherId, s] of userSockets.entries()) {
          if (s && s.readyState === s.OPEN) send(s, { type: 'presence', data: { userId: uid, status: 'offline' } });
        }
      }
    });
  });
};