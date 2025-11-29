# 📨 Isolated Chat Service – Fastify + Prisma + SQLite

This project implements a complete real-time isolated chat service using:

- Fastify (Node.js backend)
- Prisma ORM
- SQLite database (required for 42 Web module)
- WebSockets for real-time messaging
- JWT Authentication
- Blocking system, private chats, group chats, and game invitations

Designed to fit the ft_transcendence architecture and evaluation requirements.

---

## 🚀 Features

### 🔐 Authentication
- Register users
- Login with JWT
- Password hashing with bcrypt

### 💬 Chat System
- Private 1:1 chats
- Group chats
- Fetch messages per chat
- Real-time messaging via WebSockets
- Message read status (extendable)

### 🚫 User Blocking
- Block/unblock users
- Prevents:
  - private chat creation
  - sending messages
  - receiving invites

### 🎮 Game Invitations
- Send game invite inside chat
- JSON-structured invitation messages
- Broadcast via WebSocket

### 🌐 WebSockets
- Endpoint: `/ws/chat/:chatId`
- Broadcast:
  - messages
  - invites
  - typing events (extendable)

### 🛡 Security
- JWT-protected routes
- CORS enabled
- Prisma ORM (SQL injection safe)

---

## 🛠 Tech Stack

| Component     | Technology |
|---------------|------------|
| Backend       | Fastify    |
| Database      | SQLite     |
| ORM           | Prisma     |
| Auth          | JWT        |
| Realtime      | WebSockets |
| Container     | Docker     |

---

# 📁 Project Structure
backend/
  src/
    server.ts
    auth.ts
    ws.ts
    prismaClient.ts
    routes/
      users.ts
      chats.ts
  prisma/
    schema.prisma
  Dockerfile
  docker-compose.yml
  package.json
  README.md

