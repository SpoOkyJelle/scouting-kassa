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

EXPOSE 3001
CMD ["node", "server.js"]
