---
name: generic-app-direction
description: Project goal to turn the scouting pancake POS into a generic, multi-purpose register
metadata:
  type: project
---

The owner wants this app (currently a Scouting "pannenkoeken" cash register / Tappy POS) to become **generic and reusable for multiple purposes** — not hard-coded to one event.

**Why:** stated 2026-11-25 ("De complete app moet uiteindelijk generiek worden en voor meerdere doeleinden inzetbaar").

**How to apply:** replace domain-specific hard-coded concepts with admin-configurable settings (stored in the `settings` JSON row in SQLite, exposed via `/api/settings`, merged over `SETTING_DEFAULTS` in server.js).
- Done: product **categories** are now data-driven. Stored in settings as `categories: [{id,label,icon,color}]`, resolved via `src/CategoriesContext.jsx` (`useCategories()` → `{categories, getCat, labelFor, groupProducts}`), edited in `src/components/CategoryEditor.jsx` (Settings → Categories). Icons picked by name from `ICON_MAP` in `src/categories.js`.
- Done: **promotions / "acties"** (e.g. "elke 5e gratis"). Pure shared engine `src/promotions.js` (`computePromotions(items, promotions, productCatMap)` → `{discount, lines}`), used by both the React client (live preview in NieuweBon/BonDetail) and the server. Types: `nth_free`, `percent`, `combo`; each with a `scope` of all/category/product. Stored in settings as `promotions:[...]`, edited in `src/components/PromotionEditor.jsx` (Settings → Acties). **Frozen per receipt**: server `recomputePromo(receiptId)` writes `receipts.promo_discount`/`promo_lines` on create + every item change (not on settings edits), so paid receipts and the kasafsluiting don't change retroactively. `calcTotal(items, discount_pct, promo_discount)` applies promo before the manual % discount. DB columns added via `ensureColumn` migration.
- Still app-specific / future candidates: default `paymentName` ("Sint Martinus Explos / Pannenkoeken actie 2026") and `paymentUrl` in server.js `SETTING_DEFAULTS`; "Tappy POS" brand name/logo in the header (logo already uploadable); any other Dutch-event wording.
