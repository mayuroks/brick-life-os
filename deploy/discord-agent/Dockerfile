# Life OS Agent on Discord — deploy image
FROM node:20-alpine AS runtime

# Tooling for opencode + the atlassian MCP (uvx mcp-atlassian).
RUN apk add --no-cache python3 py3-pip curl git bash
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# opencode CLI (headless agent runtime) — install globally in the image.
RUN npm install -g opencode-ai

WORKDIR /app

# Install the bridge deps first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source + the bundled 001 agent (skills, persona, config template).
COPY . .

# run.sh must be executable.
RUN chmod +x run.sh

ENV NODE_ENV=production

EXPOSE 3000

CMD ["./run.sh"]
