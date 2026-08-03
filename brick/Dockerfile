# Brick deploy image
FROM node:20-alpine

WORKDIR /app

# Install production deps first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the source (see .dockerignore — excludes node_modules, .env, etc.).
COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
