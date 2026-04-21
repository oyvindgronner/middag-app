FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

COPY package*.json ./
RUN npm install --production

COPY . .
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 3040

CMD ["node", "server.js"]
