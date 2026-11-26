#!/bin/sh
# Container entrypoint: apply pending DB migrations, then start the server.
# Runs on every boot; `knex migrate:latest` is a no-op when the DB is already
# up to date, so this is safe to run repeatedly.
set -e

echo "[entrypoint] Applying database migrations..."
npm run migrate

echo "[entrypoint] Starting Tappy POS server..."
exec node server.js
