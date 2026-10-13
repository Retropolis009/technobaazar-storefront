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

export const componentCategories = [
  'Processors',
  'Graphics Cards',
  'Motherboards',
  'Memory',
  'Storage',
  'Power Supplies',
  'Cases & Cooling',
]

export const categories = [
  'All gear',
  ...departments.map(({ name }) => name),
]

export const products: Product[] = [
  {
    slug: 'geforce-rtx-5070-twin-edge-oc',
    name: 'GeForce RTX 5070 Twin Edge OC',
    category: 'Graphics Cards',
    brand: 'Zotac',
    detail: '12GB GDDR7 · 2.5-slot design',
    description: 'A powerful graphics upgrade built for high-refresh gaming, creative workloads, and detailed worlds without compromise.',
    specifications: ['12GB GDDR7 memory', 'PCI Express 5.0', 'Dual-fan cooling', 'Ray tracing and DLSS support'],
    price: 'Rs. 289,000',
    priceValue: 289000,
    badge: 'Just landed',
    image: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Graphics card and PC components on a desk',
  },
  {
    slug: 'aerobook-14-creator-edition',
    name: 'AeroBook 14 Creator Edition',
    category: 'Laptops',
    brand: 'AeroBook',
    detail: 'Core Ultra 7 · 16GB · 1TB SSD',
    description: 'A portable creator laptop with a crisp display, responsive performance, and room for your everyday projects.',
    specifications: ['Intel Core Ultra 7', '16GB memory', '1TB NVMe SSD', '14-inch high-resolution display'],
    price: 'Rs. 324,999',
    priceValue: 324999,
    badge: 'Staff pick',
    image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Slim laptop open on a wooden desk',
  },
  {
    slug: 'studio-one-wireless-headphones',
    name: 'Studio One Wireless Headphones',
    category: 'Audio',
    brand: 'Studio One',
    detail: 'Active noise canceling · 40-hour battery',
    description: 'Comfortable wireless listening with focused noise cancellation and dependable battery life for long days.',
    specifications: ['Active noise cancellation', 'Up to 40-hour battery', 'Bluetooth wireless', 'Foldable over-ear design'],
    price: 'Rs. 34,500',
    priceValue: 34500,
    badge: 'Bestseller',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Black over-ear headphones',
  },
  {
    slug: 'arc-27-qhd-monitor',
    name: 'Arc 27 QHD Monitor',
    category: 'Monitors',
    brand: 'Arc',
    detail: '1440p IPS · 180Hz · 1ms',
    description: 'Fast, fluid 1440p gaming on a color-rich IPS panel, sized to make your desk feel like a command center.',
    specifications: ['27-inch QHD IPS panel', '180Hz refresh rate', '1ms response time', 'Adaptive sync support'],
    price: 'Rs. 119,900',
    priceValue: 119900,
    badge: 'Smooth operator',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Modern widescreen monitor on a clean desk',
  },
  {
    slug: 'keychron-k2-pro-mechanical-keyboard',
    name: 'Keychron K2 Pro Mechanical Keyboard',
    category: 'Accessories',
    brand: 'Keychron',
    detail: '75% layout · Hot-swappable · Wireless',
    description: 'A compact mechanical keyboard with a tactile feel, flexible connectivity, and a layout that leaves space for your mouse.',
    specifications: ['75% compact layout', 'Hot-swappable switches', 'Bluetooth and USB-C', 'Mac and Windows keycaps included'],
    price: 'Rs. 27,500',
    priceValue: 27500,
    badge: 'Desk favorite',
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Compact mechanical keyboard with dark keycaps',
  },
  {
    slug: 'vortex-airflow-mid-tower-case',
    name: 'Vortex Airflow Mid-Tower Case',
    category: 'Cases & Cooling',
    brand: 'Vortex',
    detail: 'Mesh front · 4 ARGB fans included',
    description: 'A clean, airflow-focused chassis with room to grow and lighting ready for a build that feels like yours.',
    specifications: ['Mid-tower ATX support', 'Mesh front panel', 'Four ARGB fans included', 'Tempered-glass side panel'],
    price: 'Rs. 39,990',
    priceValue: 39990,
    badge: 'Build essential',
    image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Custom desktop PC with illuminated components',
  },
  {
    slug: 'pulse-wireless-mouse',
    name: 'Pulse Wireless Mouse',
    category: 'Accessories',
    brand: 'Pulse',
    detail: '26K sensor · 70-hour battery · 59g',
    description: 'A lightweight wireless mouse tuned for quick, precise movement through long work sessions.',
    specifications: ['26,000 DPI optical sensor', 'Up to 70-hour battery', '59g lightweight shell', 'USB-C charging'],
    price: 'Rs. 18,900',
    priceValue: 18900,
    badge: 'Fast favorite',
    image: 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Black wireless computer mouse',
  },
  {
    slug: 'corsair-rm850e-power-supply',
    name: 'Corsair RM850e 850W Power Supply',
    category: 'Power Supplies',
    brand: 'Corsair',
    detail: '80 PLUS Gold · Fully modular · ATX 3.1',
    description: 'A quiet, efficient power supply with a fully modular cable set for clean and dependable builds.',
    specifications: ['850W continuous power', '80 PLUS Gold certified', 'Fully modular cables', 'ATX 3.1 and PCIe 5.1 ready'],
    price: 'Rs. 49,900',
    priceValue: 49900,
    badge: 'Build essential',
    image: 'https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Power supply and computer components',
  },
  {
    slug: 'ryzen-7-9800x3d-desktop-processor',
    name: 'Ryzen 7 9800X3D Desktop Processor',
    category: 'Processors',
    brand: 'AMD',
    detail: '8 cores · 16 threads · AM5 socket',
    description: 'A high-performance desktop processor designed for demanding games and responsive multitasking.',
    specifications: ['8 cores and 16 threads', 'Up to 5.2GHz boost', 'AM5 socket', '3D V-Cache technology'],
    price: 'Rs. 164,900',
    priceValue: 164900,
    badge: 'Build essential',
    image: 'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Desktop computer processor component',
  },
  {
    slug: 'soundstage-desktop-speakers',
    name: 'Soundstage Desktop Speakers',
    category: 'Audio',
    brand: 'Soundstage',
    detail: '2.0 stereo · USB-C · Bluetooth',
    description: 'A tidy desktop speaker pair that brings full, clear sound to music, games, and video calls.',
    specifications: ['2.0 stereo sound', 'USB-C and Bluetooth input', 'Front-facing volume control', 'Compact desktop footprint'],
    price: 'Rs. 22,500',
    priceValue: 22500,
    badge: 'Desk upgrade',
    image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Pair of desktop speakers',
  },
  {
    slug: 'msi-mag-b650-tomahawk-motherboard',
    name: 'MSI MAG B650 Tomahawk Motherboard',
    category: 'Motherboards',
    brand: 'MSI',
    detail: 'AMD AM5 · DDR5 · ATX',
    description: 'A feature-rich AM5 motherboard with modern connectivity and room for a well-balanced desktop build.',
    specifications: ['AMD B650 chipset', 'AM5 socket', 'DDR5 memory support', 'PCIe 4.0 and Wi-Fi 6E'],
    price: 'Rs. 82,000',
    priceValue: 82000,
    badge: 'Builder pick',
    image: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Motherboard with heatsinks and component slots',
  },
  {
    slug: 'kingston-fury-beast-ddr5-32gb',
    name: 'Kingston FURY Beast DDR5 32GB Kit',
    category: 'Memory',
    brand: 'Kingston',
    detail: '2 × 16GB · 6000MT/s · DDR5',
    description: 'A responsive dual-channel memory kit designed for current desktop platforms and demanding multitasking.',
    specifications: ['32GB total capacity', '2 × 16GB modules', '6000MT/s speed', 'Intel XMP 3.0 and AMD EXPO'],
    price: 'Rs. 54,000',
    priceValue: 54000,
    badge: 'Build essential',
    image: 'https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Desktop memory modules on a dark surface',
  },
  {
    slug: 'kingston-nv3-1tb-nvme-ssd',
    name: 'Kingston NV3 1TB NVMe SSD',
    category: 'Storage',
    brand: 'Kingston',
    detail: 'PCIe 4.0 · M.2 2280 · 6000MB/s',
    description: 'A compact PCIe 4.0 drive that gives a new build or laptop a quick, spacious storage upgrade.',
    specifications: ['1TB capacity', 'M.2 2280 form factor', 'PCIe 4.0 NVMe interface', 'Up to 6000MB/s read'],
    price: 'Rs. 28,500',
    priceValue: 28500,
    badge: 'Quick upgrade',
    image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=760&q=85',
    imageAlt: 'Solid state storage drive',
  },
]

export function categorySlug(category: string) {
  return category
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function categoryFromSlug(slug: string) {
  if (slug === 'accessories') return 'Accessories'
  return categories.find((category) => categorySlug(category) === slug)
}

export function productMatchesCategory(product: Product, category: string) {
  return (
    category === 'All gear' ||
    (category === 'Components' && componentCategories.includes(product.category)) ||
    product.category === category
  )
}
