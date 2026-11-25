import { createContext, useContext, useMemo } from 'react'
import { useLang } from './LangContext'
import { DEFAULT_CATEGORIES, getIcon, tintBg } from './categories'

const CategoriesContext = createContext(null)

// Turn a stored category ({ id, label, icon, color }) into a render-ready one
// with a resolved Icon component and a derived background tint.
function resolve(cat) {
  return { ...cat, Icon: getIcon(cat.icon), bg: tintBg(cat.color) }
}

export function CategoriesProvider({ categories, children }) {
  const { t, lang } = useLang()

  const value = useMemo(() => {
    const raw  = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES
    const list = raw.map(resolve)
    const byId = new Map(list.map(c => [c.id, c]))

    // Catch-all bucket for products whose category id is no longer configured
    // (e.g. after a category was deleted). Keeps every product visible.
    const fallback = resolve({ id: '__other__', label: t('cat_other'), icon: 'Tag', color: '#8A8374' })

    // Resolve a product's category id to a category (never throws).
    const getCat = (id) => byId.get(id) || fallback

    // Human label for a category id, or the raw id when it is unknown.
    const labelFor = (id) => byId.get(id)?.label ?? id

    // Group products by category, in configured order, dropping empty groups and
    // appending a fallback group for any uncategorised / orphaned products.
    const groupProducts = (products) => {
      const groups = list.map(cat => ({ cat, items: [] }))
      const gById  = new Map(groups.map(g => [g.cat.id, g]))
      const fb     = { cat: fallback, items: [] }
      for (const p of products) {
        const g = gById.get(p.category)
        if (g) g.items.push(p)
        else fb.items.push(p)
      }
      const out = groups.filter(g => g.items.length)
      if (fb.items.length) out.push(fb)
      return out
    }

    return { categories: list, getCat, labelFor, groupProducts }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, lang])

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories() {
  return useContext(CategoriesContext)
}
