# Life OS Agent on Discord — thin deploy image (text-only).
# Uses a glibc base so the Node bridge + headless opencode agent run.
# No whisper.cpp / ffmpeg / speech model: voice transcription is a deferred
# external-service follow-up, so this image only serves text.
FROM --platform=linux/amd64 ubuntu:26.04

# --- Base tooling (minimal) ---
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git python3 \
    && rm -rf /var/lib/apt/lists/*

# uv (for the opencode atlassian/Jira MCP via uvx)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# --- Node 24 LTS (glibc) via NodeSource ---
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

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
