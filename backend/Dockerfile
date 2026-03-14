FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Data volume for SQLite persistence
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/journal.db

EXPOSE 3001

CMD ["node", "server.js"]
