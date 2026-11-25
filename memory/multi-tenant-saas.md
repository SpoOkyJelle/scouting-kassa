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

**Next — Fase 0b cutover:** rewrite `server.js` from `better-sqlite3` (sync) to `pg`/Knex
(async) routed through `scoped(req.accountId)`. Then Fase 1 (registration/login + per-account
`displayState` map), Fase 2 (setup wizard reusing Category/Promotion/Instellingen editors).
