FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 10001 appuser && \
    adduser -D -u 10001 -G appuser appuser

COPY package*.json ./
RUN npm install --production

COPY . .
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3040

CMD ["node", "server.js"]
