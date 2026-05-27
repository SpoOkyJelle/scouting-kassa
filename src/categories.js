// Central definition for all product categories.
// Add new categories here and they'll appear everywhere automatically.
export const CATEGORIES = [
  { id: 'pannenkoeken', emoji: '🥞', color: '#F59E0B' },
  { id: 'beleg',        emoji: '🍓', color: '#10B981' },
  { id: 'drinken',      emoji: '🥤', color: '#3B82F6' },
  { id: 'overig',       emoji: '📦', color: '#6B7280' },
]

/** Returns the category object for a given id, falls back to 'overig'. */
export const getCat = (id) =>
  CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
