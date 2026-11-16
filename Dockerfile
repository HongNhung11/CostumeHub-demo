FROM node:20-alpine

WORKDIR /app

# Cài dependencies trước (tận dụng cache)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
