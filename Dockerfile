FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY db-schema.sql ./
COPY scripts ./scripts
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080
ENV FLYCODE_DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "server.js"]
