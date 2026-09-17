FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY storage.js ./
COPY mailer.js ./
COPY alerter.js ./
COPY analytics.js ./
COPY knowledge.js ./
COPY integrations.js ./
COPY public ./public
COPY datasets ./datasets
COPY docs ./docs
COPY scripts ./scripts

RUN addgroup -S aihr && adduser -S aihr -G aihr && \
    mkdir -p /app/data && chown -R aihr:aihr /app
USER aihr

EXPOSE 3000
CMD ["node", "server.js"]
