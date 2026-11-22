FROM node:22-alpine

# Giờ Việt Nam cho ngày thuê, hạn trả, phí trễ
RUN apk add --no-cache tzdata
ENV TZ=Asia/Ho_Chi_Minh NODE_ENV=production

WORKDIR /app

# Cài đúng phiên bản trong lockfile (tận dụng cache)
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy source
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1

CMD ["node", "server.js"]
