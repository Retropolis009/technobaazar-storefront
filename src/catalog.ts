import {
  CircuitBoard,
  Cpu,
  Fan,
  HardDrive,
  Headphones,
  Laptop,
  MemoryStick,
  Monitor,
  Plug,
  type LucideIcon,
} from 'lucide-react'

export interface Department {
  name: string
  icon: LucideIcon
}

export interface Product {
  slug: string
  name: string
  category: string
  brand: string
  detail: string
  description: string
  specifications: string[]
  price: string
  priceValue: number
  badge: string
  image: string
  imageAlt: string
  stockQuantity?: number
  active?: boolean
}

export const departments: Department[] = [
  { name: 'Processors', icon: Cpu },
  { name: 'Graphics Cards', icon: Monitor },
  { name: 'Motherboards', icon: CircuitBoard },
  { name: 'Memory', icon: MemoryStick },
  { name: 'Storage', icon: HardDrive },
  { name: 'Power Supplies', icon: Plug },
  { name: 'Cases & Cooling', icon: Fan },
  { name: 'Laptops', icon: Laptop },
  { name: 'Monitors', icon: Monitor },
  { name: 'Audio', icon: Headphones },
]

export const categories = ['All gear', ...departments.map(({ name }) => name), 'Accessories']

export function categorySlug(category: string) {
  return category.toLowerCase().replaceAll('&', ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function categoryFromSlug(slug: string) {
  if (slug === 'accessories') return 'Accessories'
  return categories.find((category) => categorySlug(category) === slug)
}

export function productMatchesCategory(product: Product, category: string) {
  return category === 'All gear' || product.category === category
}
