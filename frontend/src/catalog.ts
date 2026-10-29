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
  subcategories?: string[]
}

export interface ProductNote {
  label: string
  value: string
}

export interface ProductContent {
  eyebrow: string
  subtitle: string
  size: string
  gallery: string[]
  intro: string
  notes: ProductNote[]
}

export interface ProductSeo {
  title: string
  description: string
  keywords: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  canonicalUrl: string
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
  compareAtPrice?: number | null
  compareAt?: string | null
  trackStock?: boolean
  badge: string
  image: string
  imageAlt: string
  stockQuantity?: number
  active?: boolean
  content?: ProductContent
  seo?: ProductSeo
}

export const blankProductContent: ProductContent = {
  eyebrow: '',
  subtitle: '',
  size: '',
  gallery: [],
  intro: '',
  notes: [],
}

export const blankProductSeo: ProductSeo = {
  title: '',
  description: '',
  keywords: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  canonicalUrl: '',
}

/** Neutral inline placeholder used when a product has no image yet. */
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="760" viewBox="0 0 760 760"><rect width="760" height="760" fill="#eef0eb"/><g fill="none" stroke="#9aa39c" stroke-width="14"><rect x="250" y="200" width="260" height="200" rx="10"/><circle cx="380" cy="300" r="46"/><path d="M250 470l120-120 90 90 60-60 60 60"/></g><text x="380" y="560" text-anchor="middle" font-family="sans-serif" font-size="30" fill="#7a857d">TechnoBaazar</text></svg>`,
  )

export const departments: Department[] = [
  { name: 'Processors', icon: Cpu },
  { name: 'Graphics Cards', icon: Monitor, subcategories: ['Used Graphics Cards'] },
  { name: 'Motherboards', icon: CircuitBoard },
  { name: 'Memory', icon: MemoryStick },
  { name: 'Storage', icon: HardDrive },
  { name: 'Power Supplies', icon: Plug },
  { name: 'Cases & Cooling', icon: Fan },
  { name: 'Laptops', icon: Laptop, subcategories: ['Used Laptops'] },
  { name: 'Monitors', icon: Monitor },
  { name: 'Audio', icon: Headphones },
]

export const categories = [
  'All gear',
  ...departments.flatMap(({ name, subcategories = [] }) => [name, ...subcategories]),
  'Accessories',
]

export function categorySlug(category: string) {
  return category.toLowerCase().replaceAll('&', ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function categoryFromSlug(slug: string, availableCategories: string[] = categories) {
  return availableCategories.find((category) => categorySlug(category) === slug)
}

export function productMatchesCategory(product: Product, category: string) {
  return category === 'All gear' || product.category === category
}
