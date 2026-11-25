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

**Fase 1 done — accounts in the frontend + per-account display.**
- `LoginScreen.jsx` rewritten: "Account" tab (email+password login + register with org name) and
  "Kassa-PIN" tab (quick till login). api.js: `loginPassword`, `register`, `fetchDisplayToken`.
- Per-account customer display: server keeps `displayStates`/`sseClients` as Maps keyed by
  accountId. Public `/display-events` & `/display-data` take `?token=` (opaque display token stored
  in the account's `settings.data.displayToken`, created via `GET /api/display-token`).
  `App.jsx` builds the display URL with the token; `KlantenschermDisplay.jsx` reads it from the URL.
  Verified: two accounts get distinct tokens, one's push doesn't leak to the other, unknown token→404.
- Settings writes now store only the raw delta (`getRawSettings`), not the merged defaults.

**Fase 2 done — onboarding/setup wizard + settings secret-redaction.**
- `OnboardingWizard.jsx`: 4-step stepper (Welkom/naam → Categorieën → Producten → Afronden
  payment+PIN), reusing `CategoryEditor` and `Producten` directly. Shown once per account via
  `App.jsx` gate `needsOnboarding = token && role==='admin' && settingsLoaded && !dismissed &&
  settings.onboarded !== true`. Finish/Skip persists `{onboarded:true}` via `updateSettings`.
  Wizard sets cashier/admin PIN by sending `{cashierPin,adminPin}` through PUT /api/settings
  (admin-only) — no current-PIN dance needed for a fresh account.
- **Security fix:** `GET/PUT /api/settings` now run through `safeSettings()` which strips
  `adminPin`, `cashierPin`, `displayToken` from the response (previously any session could read the
  admin PIN). Verified: fresh account has no onboarded flag, secrets never appear in GET/PUT, flag
  persists.
- Account 1 and account 5 ("Codeio", user's own test account) are NOT onboarded → both show the
  wizard on next login (intended live demo). PIN login → account 1 → wizard; click "Overslaan" to
  skip.

**Known gaps / next:**
- `SETTING_DEFAULTS` still holds the pannenkoeken org's paymentUrl/paymentName/categories; new
  accounts inherit them until the wizard overrides. Genericize the seed defaults later (careful:
  account 1 relies on them since its stored settings are `{}`).
- Single membership per login assumed (login picks first membership); no account-switch UI yet.
- Sessions in-memory (lost on restart). Harden later (persist; sessions table has NOT NULL user_id
  → make nullable for PIN sessions).
- Local Caddy only under the `prod` compose profile; locally the app is on 127.0.0.1:3001.
**Next — Fase 3:** team invitations (real email provider: Resend/Postmark), account-switch UI.
Fase 4: billing, subdomains, PIN hashing + argon2 for passwords + rate limiting.
