// ─── Promotions / "acties" engine ─────────────────────────────────────────────
// Pure, dependency-free module shared by the React client (live preview) and the
// Node server (authoritative snapshot stored per receipt). Keep it free of any
// browser- or node-specific imports.
//
// A promotion is plain data stored in settings.promotions:
//   { id, name, enabled, type, ... }
// Supported types:
//   'nth_free' — every Nth matching unit is free (e.g. "elke 5e oliebol gratis").
//                { scope, buyQty, freeQty }  →  per `buyQty` matching units, the
//                `freeQty` cheapest become free.
//   'percent'  — percentage off the matching subtotal.
//                { scope, percent }
//   'combo'    — fixed price for a set of components bought together.
//                { items: [{ kind, id, qty }], price }
//
// A `scope` is { kind: 'all' | 'category' | 'product', id }.

export const PROMO_TYPES = ['nth_free', 'percent', 'combo']

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

function matchesScope(item, scope, productCatMap) {
  if (!scope || scope.kind === 'all') return true
  if (scope.kind === 'product')  return String(item.product_id) === String(scope.id)
  if (scope.kind === 'category') return (productCatMap?.[item.product_id] || 'overig') === scope.id
  return false
}

// Flatten matching items into a list of individual unit prices.
function unitPrices(items, scope, productCatMap) {
  const units = []
  for (const it of (items || [])) {
    if (!matchesScope(it, scope, productCatMap)) continue
    const qty = Math.max(0, parseInt(it.quantity) || 0)
    for (let k = 0; k < qty; k++) units.push(Number(it.product_price) || 0)
  }
  return units
}

function nthFreeDiscount(promo, items, productCatMap) {
  const buy  = Math.max(1, parseInt(promo.buyQty) || 0)
  const free = Math.max(1, parseInt(promo.freeQty) || 1)
  if (!buy) return 0
  // Cheapest units become free — standard "goedkoopste gratis".
  const units = unitPrices(items, promo.scope, productCatMap).sort((a, b) => a - b)
  const freeCount = Math.min(units.length, Math.floor(units.length / buy) * free)
  let disc = 0
  for (let k = 0; k < freeCount; k++) disc += units[k]
  return disc
}

function percentDiscount(promo, items, productCatMap) {
  const pct = Math.max(0, Math.min(100, parseFloat(promo.percent) || 0))
  if (!pct) return 0
  const sub = unitPrices(items, promo.scope, productCatMap).reduce((s, p) => s + p, 0)
  return sub * pct / 100
}

function comboDiscount(promo, items, productCatMap) {
  const price = Math.max(0, parseFloat(promo.price) || 0)
  const comps = (promo.items || []).filter(c => c && c.kind && (c.kind === 'category' || c.kind === 'product'))
  if (!comps.length) return 0

  // Per component, the matching units sorted most-expensive first (so the combo
  // consumes the priciest items → biggest, most intuitive saving for the buyer).
  const pools = comps.map(c => ({
    qty: Math.max(1, parseInt(c.qty) || 1),
    units: unitPrices(items, { kind: c.kind, id: c.id }, productCatMap).sort((a, b) => b - a),
  }))

  let combos = Infinity
  for (const pool of pools) combos = Math.min(combos, Math.floor(pool.units.length / pool.qty))
  if (!combos || combos === Infinity) return 0

  let regular = 0
  for (const pool of pools) {
    const take = combos * pool.qty
    for (let k = 0; k < take; k++) regular += pool.units[k]
  }
  return Math.max(0, regular - combos * price)
}

const CALC = { nth_free: nthFreeDiscount, percent: percentDiscount, combo: comboDiscount }

// Compute the total promotion discount for a receipt's items.
// Returns { discount, lines: [{ promoId, name, amount }] }.
// Discounts stack but the total can never exceed the subtotal.
export function computePromotions(items, promotions, productCatMap) {
  const lines = []
  let discount = 0
  const base = (items || []).reduce((s, i) => s + (Number(i.product_price) || 0) * (parseInt(i.quantity) || 0), 0)

  for (const promo of (promotions || [])) {
    if (!promo || promo.enabled === false) continue
    const fn = CALC[promo.type]
    if (!fn) continue
    const amt = round2(fn(promo, items, productCatMap) || 0)
    if (amt <= 0) continue
    lines.push({ promoId: promo.id, name: promo.name || '', amount: amt })
    discount += amt
  }

  discount = Math.min(round2(discount), round2(base))
  return { discount, lines }
}

// Stable id for a newly created promotion.
export const newPromotionId = () => 'p' + Math.random().toString(36).slice(2, 9)
