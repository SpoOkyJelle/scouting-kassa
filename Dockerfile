# Node app image. Uses the Debian-based image (not alpine) so native modules
# like better-sqlite3 build without musl headaches.
FROM node:20-bookworm-slim

# Build tools for native modules (better-sqlite3). Removed after install.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Entrypoint runs migrations before starting the server. chmod so the bit is
# set even when the file was checked out on Windows (no exec permission there).
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://localhost:3001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["./docker-entrypoint.sh"]
