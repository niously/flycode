FROM node:22-alpine

WORKDIR /app

COPY package.json ./

COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=8080
ENV FLYCODE_DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "server.js"]
