---
name: multi-tenant-saas
description: Plan and Fase 0 scaffolding to turn the kassa into a multi-tenant Postgres SaaS
metadata:
  type: project
---

The kassa is being evolved from single-tenant (one `kassa.db`, PIN from `.env`) into a
**multi-tenant SaaS**: accounts where each organisation configures its own POS. Hosted on
the owner's **own VPS**. Builds on [[generic-app-direction]].

**Locked decisions** (see `docs/MULTI_TENANT_DESIGN.md` for full rationale):
- DB: **PostgreSQL**, shared-schema, `account_id` on every tenant table (row-level scoping).
- Data layer: **Knex** + `db/index.js` `scoped(accountId)` — the only sanctioned way to touch
  tenant tables; `account_id` comes **only from the session**, never the client.
- Auth: email+password (`bcryptjs`), serverside sessions; cashier **PIN kept** as in-account
  operator switch. accounts + users + **memberships** (role owner/admin/cashier) from the start.
- Hosting: Docker Compose (Caddy auto-HTTPS → Node → Postgres) on the VPS.
- Email: provider later (Resend/Postmark); invites/reset stubbed for now.
- Tenant routing: from session now; subdomain-per-tenant later.

**Fase 0 done (scaffolding, additive — server.js still runs the SQLite app):**
`docs/MULTI_TENANT_DESIGN.md`, `knexfile.js`, `migrations/0001_init_multitenant.js`,
`db/index.js` (scoped layer), `scripts/import-sqlite.js` (kassa.db → Postgres account 1),
`Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.dockerignore`, updated `.env.example` and
`package.json` (deps: knex, pg, bcryptjs; scripts: migrate*, import:sqlite). Migration NOT yet
run here (no running Postgres/daemon).

**Fase 0b done — server.js cut over to Postgres/Knex (async).** All endpoints go through
`scoped(req.accountId)`; `account_id` comes from an in-memory session (token → {accountId, role}).
Old SQLite server kept as `server.sqlite.js.bak`. Auth: `POST /api/auth/register` (email+password
+ org → account+owner+membership), `POST /api/auth/login` accepts `{email,password}` OR `{pin}`
(PIN resolves to the first account, falling back to env PIN — so the existing PIN LoginScreen still
works → account 1). `db/index.js` sets pg type parsers (numeric→float, bigint→int, timestamptz→ISO
string, date→string) so shapes match the old SQLite API. Verified end-to-end against the running
Postgres (register → products → "elke 5e gratis" promo → receipt totals → paid → stats; cascade
delete confirms isolation). Dev: `docker compose up -d db` (now bound to 127.0.0.1:5432) + `npm run
dev`; needs DATABASE_URL in .env matching POSTGRES_PASSWORD.

**Known transitional gaps / next:**
- Frontend still logs in with PIN only; no registration/login UI yet.
- `displayState` is still a single global (last writer wins), tagged with accountId — NOT yet
  per-account; public /display page not account-aware. Fase 1.
- Sessions are in-memory (lost on restart). Harden later (persist; sessions table has NOT NULL
  user_id → make nullable for PIN sessions).
- Local Caddy can't bind :80 on Windows (http.sys); irrelevant on the Linux VPS.
**Next — Fase 1:** registration/login UI (email+password + account switch), per-account displayState
+ display token. Then Fase 2 setup wizard reusing Category/Promotion/Instellingen editors.
