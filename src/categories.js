import {
  ChefHat, Layers, Coffee, Tag, CupSoda, Beer, Wine, Pizza, Sandwich, Salad,
  IceCream, Cake, Cookie, Candy, Croissant, Donut, Apple, Carrot, Fish, Beef,
  Drumstick, Milk, Soup, Popcorn, Utensils, ShoppingBag, ShoppingCart, Gift,
  Shirt, Ticket, Star, Heart, Package, Flame, Leaf, Droplet, Flower, GlassWater,
  Egg, Grape, Cherry, Banana,
} from 'lucide-react'

// ─── Icon set ────────────────────────────────────────────────────────────────
// Categories store their icon by NAME (a string), so the configuration is plain
// data that can be saved, exported and restored. The map resolves a name back to
// the lucide component at render time.
export const ICON_MAP = {
  ChefHat, Layers, Coffee, Tag, CupSoda, Beer, Wine, Pizza, Sandwich, Salad,
  IceCream, Cake, Cookie, Candy, Croissant, Donut, Apple, Carrot, Fish, Beef,
  Drumstick, Milk, Soup, Popcorn, Utensils, ShoppingBag, ShoppingCart, Gift,
  Shirt, Ticket, Star, Heart, Package, Flame, Leaf, Droplet, Flower, GlassWater,
  Egg, Grape, Cherry, Banana,
}

export const ICON_NAMES = Object.keys(ICON_MAP)

export const getIcon = (name) => ICON_MAP[name] || Tag

// ─── Colors ────────────────────────────────────────────────────────────────
// A palette to pick from in the editor; any hex colour is allowed too.
export const CATEGORY_COLORS = [
  '#C77A1A', '#5C8A3C', '#3C7A86', '#8A6D9B', '#DC2626', '#2E6B4E',
  '#2563EB', '#D946EF', '#0891B2', '#CA8A04', '#9333EA', '#8A8374',
]

// Light tint derived from a category colour, used as a tile background.
export const tintBg = (color) =>
  (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) ? color + '1A' : '#F2F0E8'

// ─── Defaults ────────────────────────────────────────────────────────────────
// Used on first run and whenever no categories are configured. The app ships
// with a pancake-sale example, but every one of these can be renamed, recoloured,
// re-iconed, reordered or removed from Settings → Categories.
export const DEFAULT_CATEGORIES = [
  { id: 'pannenkoeken', label: 'Pannenkoeken', icon: 'ChefHat', color: '#C77A1A' },
  { id: 'beleg',        label: 'Beleg',        icon: 'Layers',  color: '#5C8A3C' },
  { id: 'drinken',      label: 'Drinken',      icon: 'Coffee',  color: '#3C7A86' },
  { id: 'overig',       label: 'Overig',       icon: 'Tag',     color: '#8A8374' },
]

// Create a stable, unique id for a newly added category.
export const newCategoryId = () => 'c' + Math.random().toString(36).slice(2, 9)
