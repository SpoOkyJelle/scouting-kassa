# Node app image. All dependencies are pure JavaScript (express, knex, pg,
# bcryptjs), so no native build toolchain is required.
FROM node:20-bookworm-slim

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
