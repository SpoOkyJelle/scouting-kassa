# Multi-tenant SaaS — ontwerp & opzet

Dit document beschrijft hoe de kassa van een **single-tenant** applicatie (één `kassa.db`,
één PIN uit `.env`) evolueert naar een **multi-tenant SaaS**: meerdere organisaties die
elk hun eigen POS inrichten achter een eigen account, gehost op een eigen VPS.

Status: **Fase 0 in opbouw.** De bestaande SQLite-app (`server.js`) blijft werken; de
Postgres-infrastructuur wordt er eerst naast gezet en daarna ingeschakeld.

---

## 1. Vastgelegde keuzes

| Onderwerp | Keuze | Waarom |
|---|---|---|
| Database | **PostgreSQL**, shared-schema met `account_id` op elke tabel | SaaS-standaard; cross-tenant werk (facturatie, admin, analytics) in één query; echte concurrency; standaard backup/replicatie-tooling |
| Datalaag | **Knex** + verplichte tenant-scoping (`account_id` uit de sessie) | Kleinste sprong vanaf de huidige rauwe SQL; migraties; één plek die scoping afdwingt |
| Auth | **E-mail + wachtwoord** (gehasht, `bcryptjs`), serverside sessies | Revoceerbaar; geen externe afhankelijkheid om te starten; OAuth kan later |
| Kassa-PIN | **Behouden**, als snelle operator-wissel *binnen* een ingelogd account | Behoudt de bestaande kassa-UX |
| Gebruikers | **accounts + users + memberships** vanaf het begin | Team/uitnodigingen later terugbouwen in een live SaaS is pijnlijk |
| Hosting | **VPS + Docker Compose**: Caddy (auto-HTTPS) → Node → Postgres | Reproduceerbaar, één `docker compose up`, gratis TLS |
| E-mail | Provider (Resend/Postmark/SES) — **later**; nu gestubt | Zelf SMTP vanaf een VPS = spam/deliverability-ellende |
| Tenant in URL | Nu: **uit de sessie** (geen subdomein). Later: subdomein-per-tenant | Minimale start; subdomein is een losse uitbreiding |

### Begrippen
- **Account / tenant** — de organisatie die een POS inricht; eigenaar van álle POS-data.
- **User** — een persoon die inlogt (e-mail + wachtwoord). Via **membership** gekoppeld
  aan één of meerdere accounts, elk met een **rol** (`owner` / `admin` / `cashier`).
- **Kassa-PIN** — gemak aan de kassa om snel van operator/rol te wisselen op een al
  ingelogd apparaat. Niet langer de beveiliging zelf.

---

## 2. Datamodel

**Centrale / auth-tabellen** (niet tenant-scoped):

```
accounts    (id, name, slug UNIQUE, status, plan, created_at)
users       (id, email UNIQUE (lowercased), password_hash, name, created_at)
memberships (id, user_id → users, account_id → accounts, role, created_at,
             UNIQUE(user_id, account_id))
sessions    (token PK, user_id, account_id, role, expires_at, created_at)
```

**Tenant-tabellen** — elk met `account_id → accounts ON DELETE CASCADE` + index:

```
products       (id, account_id, name, price, cost_price, category, available, sort_order, created_at)
receipts       (id, account_id, name, note, paid, discount_pct, donation,
                promo_discount, promo_lines jsonb, payment_method, payments jsonb, created_at)
receipt_items  (id, account_id, receipt_id → receipts, product_id, product_name, product_price, quantity)
inkoop         (id, account_id, description, amount, date, note, submitted_by, created_at)
donaties       (id, account_id, name, amount, date, note, created_at)
kas            (id, account_id, datum, begin_bedrag, eind_bedrag, note, created_at,
                UNIQUE(account_id, datum))
kas_correcties (id, account_id, kas_id → kas, type, amount, description, created_at)
settings       (account_id PK → accounts, data jsonb)   -- per-account instellingen:
                                                            categories, promotions, payment, logo, pins
```

> De globale `settings`-rij (`key='settings'`) wordt **per account**. De kassa-PINs
> (nu `adminPin`/`cashierPin` in de settings-JSON) verhuizen mee; op termijn **gehasht**
> opslaan i.p.v. plain.

---

## 3. Tenant-isolatie — de #1 regel

De grootste multi-tenant-fout is een query vergeten te filteren → datalek tussen klanten.
Daarom:

- **Alle** toegang tot tenant-tabellen loopt via `scoped(accountId)` (zie `db/index.js`).
  Die filtert elke read op `account_id` en injecteert `account_id` bij elke insert.
- `account_id` komt **uitsluitend uit de sessie** (de `requireAuth`-middleware), **nooit**
  uit de request-body of query-parameters.
- Directe `db('products')…` zonder scoping is verboden in applicatiecode (alleen de
  datalaag/migraties mogen dat).

---

## 4. Auth & sessies

1. **Registreren** — e-mail + wachtwoord + organisatienaam → maakt `account`, `user`
   (owner) en `membership`. Wachtwoord via `bcryptjs`.
2. **Inloggen** — e-mail + wachtwoord → serverside `session` (token → user+account+rol,
   met `expires_at`). Token in de client (zoals nu), revoceerbaar serverside.
3. **Account kiezen** — heeft een user meerdere memberships, dan kiest hij het account;
   de sessie legt `account_id` + `role` vast.
4. **Kassa-PIN** — binnen een ingelogd account wisselt een korte PIN de actieve
   operator/rol (cashier ↔ admin) zonder opnieuw e-mail/wachtwoord.

---

## 5. Onboarding / inrichten

```
1. Registreren     → e-mail + wachtwoord + organisatienaam
2. Setup-wizard    → POS-naam & logo · categorieën (defaults) · producten
                     · betaalverzoek (ING-link) · optioneel acties · kassa-PIN('s)
3. (optioneel) team → medewerkers uitnodigen (e-mail) of PIN delen
4. Live            → kassa openen
```

De bestaande **CategoryEditor**, **PromotionEditor** en **Instellingen** worden de
stappen van de wizard — het "inrichten" is grotendeels al gebouwd, nu per account.

---

## 6. Hosting op de VPS

```
Internet ──HTTPS──> Caddy (auto Let's Encrypt, reverse proxy)
                      └─> Node/Express app
                            └─> PostgreSQL (Docker volume)
```

- **docker-compose.yml** — `db` (Postgres) + `app` (deze repo) + `caddy`.
- **Caddyfile** — reverse proxy + automatische HTTPS (zet `DOMAIN` naar je domein).
- **Migraties** — `npm run migrate` (Knex) i.p.v. `CREATE TABLE IF NOT EXISTS`.
- **E-mail** — later via provider; uitnodigingen/reset nu gestubt (token gelogd).
- **Backups** — `pg_dump` via cron → offsite object-storage.
- **Secrets** — `SESSION_SECRET`, `POSTGRES_PASSWORD`, `DATABASE_URL` via `.env`
  (zie `.env.example`), niet in git.

---

## 7. Fasering

- **Fase 0 — Fundament (nu).** Docker Compose + Postgres; Knex + migraties met het
  volledige multi-tenant schema; `scoped()`-datalaag; importscript dat de huidige
  `kassa.db` als *account 1* inleest. `server.js` blijft nog op SQLite draaien.
- **Fase 0b — Cutover.** `server.js` omzetten van `better-sqlite3` (synchroon) naar
  `pg`/Knex (async). Mechanisch maar groot: elke DB-call wordt `async/await` en loopt
  via `scoped(req.accountId)`.
- **Fase 1 — Accounts.** Registratie + e-mail/wachtwoord-login + memberships; kassa-PIN
  binnen het account; `displayState` wordt een **map per account** (SSE per tenant).
- **Fase 2 — Setup-wizard** (hergebruik bestaande editors).
- **Fase 3 — Team & polish** — uitnodigingen (met echte e-mailprovider), rollen fijner.
- **Fase 4 — Commercie** — plannen/limieten, facturatie (Stripe), eventueel
  subdomein-per-tenant (wildcard-DNS + wildcard-cert via Caddy).

---

## 8. Open punten / later beslissen
- E-mailprovider kiezen (Resend is de simpelste start).
- Subdomein (`klant.jouwpos.nl`) vs pad (`/t/klant`) voor tenant-branding.
- PIN-hashing i.p.v. plain in `settings.data`.
- Argon2 i.p.v. bcryptjs zodra native build in Docker geregeld is.
- Rate limiting op login / password-reset.
