# Todo — Scouting Kassa Verbeteringen

---

## Tickd SaaS — Accounts & Abonnementen

Het doel: Tickd wordt een betaald SaaS-product. Organisaties (bijv. scoutinggroepen) maken een account aan, kiezen een abonnement, en krijgen dan toegang tot hun eigen POS-omgeving.

### Fase 1 — Backend & datamodel

- [ ] **Nieuwe database-tabellen**
  - `accounts` — organisatienaam, e-mail, aanmaakdatum, abonnementsstatus
  - `subscriptions` — account_id, plan (free/pro/etc.), start_datum, eind_datum, stripe_subscription_id
  - `users` — medewerkers gekoppeld aan een account (vervangt of breidt huidige login-tabel uit)
  - Alle bestaande tabellen (producten, bonnen, etc.) krijgen een `account_id` foreign key zodat data per organisatie gescheiden is

- [ ] **Auth-laag uitbreiden**
  - JWT of session-token bevat voortaan ook `account_id` en `subscription_status`
  - Elke API-route checkt of het account een actief abonnement heeft (middleware `requireActiveSubscription`)
  - Bestaande PIN-logins worden gekoppeld aan een account

- [ ] **Stripe integratie — basis**
  - Stripe-account aanmaken en API-keys instellen
  - Webhook-endpoint `/api/stripe/webhook` voor events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`
  - Bij succesvolle betaling: abonnement in DB activeren
  - Bij verlopen/geannuleerd: account blokkeren (lezen mag, schrijven niet)

### Fase 2 — Registratie & onboarding

- [ ] **Registratiepagina** (`/register`)
  - Formulier: organisatienaam, e-mailadres, wachtwoord
  - Na registratie: account aangemaakt met status `trial` (bijv. 14 dagen gratis)
  - Bevestigingsmail sturen

- [ ] **Plan-keuze scherm**
  - Overzicht van abonnementsopties (bijv. Gratis proefperiode / Pro / Groot evenement)
  - Per plan: max. aantal medewerkers, max. bonnen per maand, features
  - Knop "Start abonnement" opent Stripe Checkout

- [ ] **Stripe Checkout flow**
  - Bij klik "Start abonnement": server maakt Stripe Checkout Session aan en redirect de gebruiker
  - Na betaling: Stripe webhook activeert het abonnement in de DB
  - Redirect terug naar dashboard met bevestiging

- [ ] **Login-pagina aanpassen**
  - Naast PIN-login ook een e-mail/wachtwoord login voor de accountbeheerder
  - "Nog geen account? Registreer hier" link

### Fase 3 — Account dashboard

- [ ] **Dashboard voor accountbeheerder**
  - Overzicht: huidig plan, verloopdatum, gebruik (aantal bonnen, medewerkers)
  - Knop "Abonnement beheren" → Stripe Customer Portal
  - Knop "Medewerkers beheren" → PINs aanmaken/verwijderen

- [ ] **Stripe Customer Portal**
  - Server genereert een Stripe Billing Portal sessie-link
  - Gebruiker kan zelf upgraden, downgraden, of opzeggen

- [ ] **Abonnement verlopen — grace period**
  - Na verlopen: 7 dagen waarschuwing zichtbaar in de UI
  - Na grace period: POS vergrendeld, alleen lezen nog mogelijk
  - Duidelijke melding met link naar abonnement verlengen

### Fase 4 — Multi-tenancy hardening

- [ ] **Data-isolatie controleren**
  - Elke query gefilterd op `account_id` — audit alle bestaande endpoints
  - Row-level security in de database indien mogelijk (bijv. PostgreSQL RLS)

- [ ] **Subdomeinen of URL-structuur**
  - Optie A: `app.tickd.nl/[account-slug]/...` (simpel, één deployment)
  - Optie B: `[account].tickd.nl` (subdomein per klant, complexer)
  - Aanbeveling: begin met Optie A

- [ ] **Omgevingsvariabelen & secrets**
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET` in `.env`
  - Nooit hardcoded in code of frontend

### Fase 5 — Productierijp maken

- [ ] **E-mails automatiseren**
  - Welkomstmail na registratie
  - Betaalbevestiging
  - Herinnering 7 dagen voor verlopen abonnement
  - Bevestiging bij opzegging

- [ ] **Admin-panel (intern)**
  - Overzicht van alle accounts en hun abonnementsstatus
  - Mogelijkheid om een account handmatig te blokkeren of te verlengen

- [ ] **Juridisch & compliance**
  - Algemene voorwaarden en privacybeleid opstellen
  - BTW-afhandeling via Stripe Tax of handmatig
  - GDPR: data-verwijdering op verzoek (`DELETE account + all related data`)

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