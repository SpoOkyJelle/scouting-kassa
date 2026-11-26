// Subscription plans. Shown and selectable now, but NOT charged yet — picking a
// plan just updates accounts.plan. Prices are indicative for when billing goes
// live. Marketing copy is bilingual so it stays out of the i18n dictionaries.
//
// `capabilities` gates real features in the app. It is cumulative by intent:
// each higher tier repeats the lower tier's keys so checks stay a simple
// `includes()`. Enforced today: 'inkoop' (Pro+) and 'sumup' (Business).

const PRO_CAPS      = ['inkoop', 'donaties', 'stats-export', 'email-invites', 'team-10']
const BUSINESS_CAPS = [...PRO_CAPS, 'sumup', 'multi-till', 'team-unlimited']

export const PLANS = [
  {
    id: 'free',
    name:    { nl: 'Gratis',   en: 'Free' },
    price:   { nl: '€0',       en: '€0' },
    period:  { nl: 'altijd gratis', en: 'free forever' },
    tagline: { nl: 'Om te starten en voor kleine acties.', en: 'To get started and for small events.' },
    capabilities: [],
    features: {
      nl: ['1 kassa', 'Onbeperkt bonnen', 'Klantenscherm', 'Categorieën & acties', '1 teamlid'],
      en: ['1 till', 'Unlimited receipts', 'Customer display', 'Categories & promotions', '1 team member'],
    },
  },
  {
    id: 'pro',
    name:    { nl: 'Pro',      en: 'Pro' },
    price:   { nl: '€12',      en: '€12' },
    period:  { nl: 'per maand', en: 'per month' },
    tagline: { nl: 'Voor verenigingen die vaker verkopen.', en: 'For clubs that sell regularly.' },
    highlight: true,
    capabilities: PRO_CAPS,
    features: {
      nl: ['Alles uit Gratis', 'Inkoop & donaties', 'Tot 10 teamleden', 'Statistieken & export', 'E-mailuitnodigingen'],
      en: ['Everything in Free', 'Purchases & donations', 'Up to 10 team members', 'Stats & export', 'Email invitations'],
    },
  },
  {
    id: 'business',
    name:    { nl: 'Business', en: 'Business' },
    price:   { nl: '€29',      en: '€29' },
    period:  { nl: 'per maand', en: 'per month' },
    tagline: { nl: 'Voor grotere organisaties.', en: 'For larger organisations.' },
    capabilities: BUSINESS_CAPS,
    features: {
      nl: ['Alles uit Pro', 'SumUp pinbetalingen', 'Onbeperkt teamleden', 'Meerdere kassa’s', 'Prioriteit-support'],
      en: ['Everything in Pro', 'SumUp card payments', 'Unlimited team members', 'Multiple tills', 'Priority support'],
    },
  },
]

export const PLAN_IDS = PLANS.map(p => p.id)
export const DEFAULT_PLAN = 'free'
export const getPlan = (id) => PLANS.find(p => p.id === id) || PLANS[0]

// Does the given plan id unlock a capability key? (unknown plan → free)
export const planHasCapability = (id, cap) => getPlan(id).capabilities.includes(cap)
