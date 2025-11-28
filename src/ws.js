const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = async function (fastify, opts) {
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
                        },
                        include: {
                            sender: { select: { id: true, username: true } },
                            Reciever: { select: { id: true, username: true } }
                        }
                    });

                    // Acknowledge sender with created object
                    send(socket, { type: 'ack', data: created });

                    // If recipient is connected, send only to them
                    const rSock = userSockets.get(String(recieverId));
                    if (rSock && rSock.readyState === rSock.OPEN) {
                        send(rSock, { type: 'msg', data: created });
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
            if (socket._userId) userSockets.delete(String(socket._userId));
        });
    });
};