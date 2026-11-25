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

**Fase 3 done — team invitations, accept flow, account switching.**
- Migration `0002_invitations.js`: `invitations` (account_id, email, role admin|cashier, token unique,
  invited_by nullable, accepted_at, expires_at; unique(account_id,email)). Applied (Batch 2).
- `src/mailer.js`: provider-agnostic, sends via Resend ONLY if `RESEND_API_KEY`+`MAIL_FROM` set,
  else logs the link; never throws. Invite endpoints always ALSO return the link so it works without
  a provider.
- Server: middleware now sets `req.userId`/`req.token`. Public: `GET /api/auth/invite/:token`,
  `POST /api/auth/accept` (existing user → verify password; new user → create). Authed:
  `GET /api/auth/accounts`, `POST /api/auth/switch` (deletes old session token, issues new one —
  verified a switch invalidates the prior token). Admin: `GET /api/team`,
  `POST /api/team/invite`, `PUT/DELETE /api/team/member/:userId`, `DELETE /api/team/invite/:id`.
  Guards verified: cashier blocked from /api/team (403); owner can't be removed/demoted (403);
  can't remove/demote yourself; reused invite token → 404.
- Frontend: `TeamManager.jsx` in Instellingen (admin) — members list with role dropdown + remove,
  pending invites with copy-link + revoke, invite form (email+role). Account switcher `<select>` in
  the header (App.jsx) when `fetchAccounts()` returns >1. Standalone `AcceptInvite.jsx` page at
  route `/invite?token=…` (main.jsx routes it like /display). api.js: fetchInvite, acceptInvite,
  fetchTeam, inviteMember, revokeInvite, removeMember, changeMemberRole, fetchAccounts, switchAccount.

**Known gaps / next:**
- `.env` password mismatch: `DATABASE_URL=...kassa:kassa...` but `POSTGRES_PASSWORD=change_me`, so
  host `npm run migrate`/`npm run dev` need the URL fixed to `kassa:change_me@localhost:5432`.
  (Worked around with inline DATABASE_URL for the migration.)
- `SETTING_DEFAULTS` still holds pannenkoeken org's payment/categories; genericize later (account 1
  relies on them since its stored settings are `{}`).
- Sessions in-memory (lost on restart). Harden later (persist to the `sessions` table; note that
  table has NOT NULL user_id → make nullable for PIN sessions when persisting).
- PIN session has `userId=null` → no account switcher and not flagged "you" in team list (fine).
- Local Caddy only under the `prod` compose profile; locally the app is on 127.0.0.1:3001.
**Next — Fase 4:** billing/plans, subdomain-per-tenant, hardening (hash PINs, argon2 for passwords,
rate limiting, persist sessions), and configure a real mail provider (RESEND_API_KEY + MAIL_FROM).
