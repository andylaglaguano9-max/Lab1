FROM node:22-alpine
WORKDIR /app
COPY server.js .
COPY coordinator.js .
EXPOSE 3000 4000
CMD ["node", "server.js"]
