# Life OS Agent on Discord — deploy image (Render, Ubuntu 26.04 LTS, amd64)
# glibc base so whisper-cli/ffmpeg/opencode run; includes cloud voice transcription.
FROM --platform=linux/amd64 ubuntu:26.04

# --- Base tooling ---
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates git python3 python3-pip \
      whisper.cpp ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# uv (for the opencode atlassian/Jira MCP via uvx)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# --- Node 24 LTS (glibc) via NodeSource ---
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs

# --- opencode CLI (official installer) ---
ENV OPENCODE_INSTALL_DIR=/usr/local/bin
# The installer ignores OPENCODE_INSTALL_DIR and places the binary under
# $HOME/.opencode/bin; symlink it onto PATH so run.sh can exec `opencode`.
RUN curl -fsSL https://opencode.ai/install | bash \
    && ln -sf /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && opencode --version

WORKDIR /app

# Install bridge deps (scripts ENABLED so ffmpeg-static downloads its amd64 binary)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source + bundled 001 agent (skills, persona, config template)
COPY . .

# run.sh executable
RUN chmod +x run.sh

# Bake the speech model (free-tier-safe: tiny.en ~75MB). Env lets other plans override.
RUN mkdir -p /app/models \
    && curl -fsSL -o /app/models/ggml-tiny.en.bin \
        https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin

ENV NODE_ENV=production
ENV WHISPER_MODEL=/app/models/ggml-tiny.en.bin

# Render binds the public port via $PORT (config defaults to 3000 otherwise).
EXPOSE 10000

CMD ["./run.sh"]
