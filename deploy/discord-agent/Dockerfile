# Life OS Agent on Discord — thin deploy image (text-only).
# glibc base (node:24-slim) so the Node bridge + headless opencode agent run.
# No whisper.cpp / ffmpeg / speech model: voice transcription is a deferred
# external-service follow-up, so this image only serves text.
FROM --platform=linux/amd64 node:24-slim

# --- Base tooling (minimal; Node 24 already present, no NodeSource step) ---
# curl/ca-certificates are needed by the opencode installer below.
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends git python3 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# uv (for the opencode atlassian/Jira MCP via uvx)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# --- opencode CLI (official installer) ---
ENV OPENCODE_INSTALL_DIR=/usr/local/bin
RUN curl -fsSL https://opencode.ai/install | bash \
    && ln -sf /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && opencode --version

WORKDIR /app

# Install bridge deps (no ffmpeg-static / whisper — text-only agent)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source + bundled 001 agent (skills, persona, config template)
COPY . .

# run.sh executable
RUN chmod +x run.sh

ENV NODE_ENV=production

# Text-only: no whisper model/binary on the host.
ENV DISABLE_VOICE=1

# The Fargate task maps public :3000 -> container 3000.
EXPOSE 3000

CMD ["./run.sh"]
