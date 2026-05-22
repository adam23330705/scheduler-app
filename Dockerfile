FROM node:22-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .

# 数据持久化目录
VOLUME /app/data

ENV PORT=8787
ENV NODE_ENV=production

EXPOSE 8787
CMD ["node", "server.js"]
