# One image = API + BullMQ worker + built React app (single origin => simple cookies & OAuth redirects)
FROM node:22-alpine AS fe
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:22-alpine AS be
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend ./
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=be /app/backend/dist backend/dist
COPY --from=be /app/backend/node_modules backend/node_modules
COPY --from=be /app/backend/package.json backend/
COPY --from=fe /app/frontend/dist frontend/dist
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/index.js"]
