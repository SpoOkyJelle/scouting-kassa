# Todo — Scouting Kassa Verbeteringen

---

## Tickd SaaS — Accounts & Abonnementen

Het doel: Tickd wordt een betaald SaaS-product. Organisaties (bijv. scoutinggroepen) maken een account aan, kiezen een abonnement, en krijgen dan toegang tot hun eigen POS-omgeving.

### Fase 1 — Backend & datamodel

- [x] **Nieuwe database-tabellen**
  - `accounts` — organisatienaam, e-mail, aanmaakdatum, abonnementsstatus
  - `subscriptions` — account_id, plan, start_datum, eind_datum, stripe_subscription_id
  - Bestaande installaties krijgen automatisch een standaard account (migration in server.js)
  - *(account_id foreign keys op alle tabellen = Fase 4 multi-tenancy hardening)*

- [x] **Auth-laag uitbreiden**
  - Sessions bevatten nu `accountId` — bestaande PIN-sessies krijgen automatisch `accountId: 1`
  - `requireActiveSubscription` middleware toegevoegd (opt-in per route)
  - Trial auto-expiry: status wordt `expired` als `trial_ends_at` verstreken is
  - Bestaande PIN-logins werken ongewijzigd

- [x] **Stripe integratie — basis**
  - `stripe` package geïnstalleerd, init via `STRIPE_SECRET_KEY` env var
  - Webhook-endpoint `POST /api/stripe/webhook` (raw body, vóór express.json)
    - `checkout.session.completed` → abonnement activeren + subscription record aanmaken
    - `invoice.paid` → status op `active` zetten
    - `customer.subscription.deleted` → status `cancelled`, eind_datum vastleggen
    - `customer.subscription.updated` → status sync (active/trial/expired)
  - `POST /api/stripe/create-checkout` → Stripe Checkout sessie aanmaken
  - `POST /api/stripe/portal` → Stripe Customer Portal sessie
  - Keys gedocumenteerd in `.env.example`

### Fase 2 — Registratie & onboarding

- [x] **Registratiepagina** (`/register`) — `RegisterScreen.jsx`
  - Formulier: organisatienaam, e-mailadres, wachtwoord + bevestiging
  - Na registratie: account aangemaakt met status `trial` (14 dagen gratis)
  - *(Bevestigingsmail = Fase 5)*

- [x] **Plan-keuze scherm** — stap 2 in `RegisterScreen.jsx`
  - Proefperiode (direct verder) vs Pro (Stripe Checkout)
  - Graceful fallback als Stripe niet geconfigureerd is

- [x] **Stripe Checkout flow**
  - "Start met Pro" → `POST /api/stripe/create-checkout` → redirect naar Stripe
  - Na betaling: Stripe webhook activeert abonnement (Fase 1 webhook)
  - Redirect terug naar `/?checkout=success` → toast melding in app

- [x] **Login-pagina aanpassen**
  - PIN / E-mail toggle bovenin het login-kaartje
  - E-mail tab: e-mail + wachtwoord → `POST /api/auth/email-login`
  - "Nog geen account? Gratis starten →" link naar `/register`

### Fase 3 — Account dashboard

- [x] **Dashboard voor accountbeheerder** — `AccountDashboard.jsx` in Instellingen
  - Organisatienaam, e-mail, abonnementsstatus badge
  - Verloopdatum van trial
  - Gebruik: # bonnen, # medewerkers (live via `/api/accounts/me`)
  - Vernieuwen-knop

- [x] **Stripe Customer Portal** — knop "Abonnement beheren" in AccountDashboard
  - `POST /api/stripe/portal` → opent Stripe portaal in nieuw tabblad
  - Zichtbaar alleen bij actief betaald abonnement

- [x] **Abonnement verlopen — grace period** — `SubscriptionBanner.jsx` in App.jsx
  - Gele balk: trial verloopt binnen 7 dagen (met sluiten-knop)
  - Rode balk: trial verlopen of abonnement opgezegd
  - "Upgrade naar Pro" knop → direct naar Stripe Checkout

### Fase 4 — Multi-tenancy hardening

- [x] **Data-isolatie geaudit en versterkt**
  - Alle 7 collecties gefilterd op `account_id` op elke GET/POST/PUT/DELETE
  - Backup/restore nu account-scoped: backup exporteert alleen eigen data, restore vervangt alleen eigen data
  - `SETTING_DEFAULTS` hardcoded organisatiewaarden verwijderd (waren een datalek voor nieuwe accounts)
  - *(lowdb heeft geen row-level security — bij migratie naar PostgreSQL alsnog toevoegen)*

- [x] **Account slug** — `generateSlug()` helper, toegevoegd bij registratie + migration voor bestaande accounts
  - Slug formaat: `{naam-lowercase}-{id}` (bijv. `sint-martinus-explos-1`)
  - Basis voor toekomstige URL-routing (`app.tickd.nl/sint-martinus-explos-1`)
  - *(Volledige URL-routing implementatie = toekomstige stap bij productie-deploy)*

- [x] **Omgevingsvariabelen & secrets**
  - Alle keys in `.env` / `.env.example` gedocumenteerd
  - Geen hardcoded secrets meer in de code

### Fase 5 — Productierijp maken

- [x] **E-mails automatiseren** — Nodemailer (SMTP via env vars)
  - Welkomstmail bij registratie
  - Betaalbevestiging bij `checkout.session.completed`
  - Opzeggingsbevestiging bij `customer.subscription.deleted`
  - Herinnering op 7 dagen én 1 dag voor verlopen trial (dagelijkse check via `setInterval`)
  - Geconfigureerd via `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`, `APP_URL` in `.env`

- [x] **Admin-panel (intern)** — `/admin` (beschermd met `TICKD_ADMIN_KEY`)
  - `GET /api/admin/accounts` — alle accounts met status + gebruik
  - `PUT /api/admin/accounts/:id` — status handmatig aanpassen
  - `AdminPanel.jsx` — tabeloverzicht met inline status-editor

- [x] **GDPR: account verwijderen**
  - `DELETE /api/accounts/me` — wist alle data van het account (7 collecties + settings + sessies)
  - Knop "Account verwijderen" in AccountDashboard (met bevestigingsdialoog)
  - *(Privacy policy / AV / BTW = juridisch/handmatig, geen code)*

---

## Snel op te pakken (UI fixes)

- [x] **Pin verwijderen** — Pinnen wordt niet gebruikt, momenteel alleen QR en contant.
- [x] **Knop 'Betalen' hernoemen** — Wijzig naar `Toon QR code` of `Toon betaalverzoek` (opent QR op klantscherm)
- [x] **Klantscherm: losse knop** — Klantscherm mag niet meer automatisch openen bij het openen van een bon; vervang door expliciete knop `Open op POS` / `Toon op scherm`

## Overzicht & Statistieken

- [x] **Overzicht: standaard filter op vandaag** — Bij openen van het overzicht standaard filteren op de huidige dag
- [x] **Overzicht: extra filters** — Toevoegen van filters: `Vandaag`, `Gisteren`, `Alle tijd`
- [x] **Uitgebreidere statistieken** — Naast totale omzet en huidige winst ook `verwachte winst` tonen op basis van nog openstaande bonnen

## Inkopen

- [x] **Naam bij inkoopbon** — Bij het opgeven van een inkoopbon een naam-veld toevoegen (wie heeft de bon ingediend)
- [x] **Verkooptrends voor inkopen** — Overzicht van best verkochte producten om inkoopbeslissingen te ondersteunen *(evt. met AI-suggesties)*

## Kas & Financiën

- [x] **Kas correctie** — Mogelijkheid toevoegen om de kas handmatig recht te trekken/corrigeren, zowel contant als QR-betalingen

## Tafelindeling

- [x] **Tafelnummers met plattegrond** — Overzicht toevoegen met een visuele indeling van waar tafels staan

## Keukenscherm

- [x] **Keuken scherm** — Keuken krijgt een scherm waarop de bestelling staat, deze kunnen ze dan afvinken als deze gemaakt zijn tot de bestelling compleet is. Hierbij zou er bijgehouden moeten worden of de bestelling compleet is (voor bediening), hoe lang de bestelling al open staat etc.

## Cassier login

- [x] **Losse logins** — Alle werknemers krijgen losse logins zodat zij op hun telefoon een POS krijgen om bestellingen op te nemen of op een centrale computer op hun naam kunnen registreren.