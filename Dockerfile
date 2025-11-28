FROM node:20
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --production
COPY . .
RUN npx prisma generate --schema=./prisma/schema.prisma
EXPOSE 3000
CMD ["node", "src/server.js"]