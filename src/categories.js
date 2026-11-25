import { ChefHat, Layers, Coffee, Tag } from 'lucide-react'

export const CATEGORIES = [
  { id: 'pannenkoeken', Icon: ChefHat, color: '#C77A1A', bg: '#FBF1DE' },
  { id: 'beleg',        Icon: Layers,  color: '#5C8A3C', bg: '#EDF3E3' },
  { id: 'drinken',      Icon: Coffee,  color: '#3C7A86', bg: '#E6F0F1' },
  { id: 'overig',       Icon: Tag,     color: '#8A8374', bg: '#F2F0E8' },
]

export const getCat = (id) =>
  CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
