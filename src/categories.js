import { ChefHat, Layers, Coffee, Tag } from 'lucide-react'

export const CATEGORIES = [
  { id: 'pannenkoeken', Icon: ChefHat, color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'beleg',        Icon: Layers,  color: '#10B981', bg: '#ECFDF5' },
  { id: 'drinken',      Icon: Coffee,  color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'overig',       Icon: Tag,     color: '#6B7280', bg: '#F9FAFB' },
]

export const getCat = (id) =>
  CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
