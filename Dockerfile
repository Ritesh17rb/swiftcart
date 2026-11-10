FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY client/package*.json ./client/
RUN npm ci --prefix client
COPY client ./client
RUN npm run build --prefix client

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 OPS_DB_PATH=/app/data/reflow.sqlite
WORKDIR /app
COPY package.json ./
COPY ops ./ops
COPY client/src/domain ./client/src/domain
COPY client/package.json ./client/package.json
COPY --from=build /app/client/dist ./client/dist
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 8080
CMD ["node", "ops/server.js"]
