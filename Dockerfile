# Render free-tier Web Service build for Life Map Dashboard.
# Root-level Dockerfile so Render's default detection finds it (build context = repo root).
# Deploys the Feature 1 app in life-map-dashboard/ (owned by 012).
FROM node:24-alpine

WORKDIR /app

COPY life-map-dashboard/package.json life-map-dashboard/package-lock.json ./
RUN npm ci --omit=dev

COPY life-map-dashboard/ .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
