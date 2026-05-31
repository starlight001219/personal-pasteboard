FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3088
CMD ["node", "src/server.js"]
