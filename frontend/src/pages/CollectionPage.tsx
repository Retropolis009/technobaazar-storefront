import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import CollectionSidebar from '../components/CollectionSidebar'
import ProductCard from '../components/ProductCard'
import type { Category } from '../api'
import type { Product } from '../catalog'

interface CollectionPageProps {
  category: string
  categories: Category[]
  products: Product[]
  favorites: string[]
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

function CollectionPage({ category, categories, products, favorites, onAddToCart, onToggleFavorite }: CollectionPageProps) {
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [availability, setAvailability] = useState<'all' | 'in-stock' | 'out-of-stock'>('all')
  const [sortBy, setSortBy] = useState('featured')
  const [query, setQuery] = useState('')
  const brands = useMemo(() => [...new Set(products.map(product => product.brand))].sort((a, b) => a.localeCompare(b)), [products])

  const visibleProducts = useMemo(() => {
    const minimum = minPrice === '' ? 0 : Number(minPrice)
    const maximum = maxPrice === '' ? Number.POSITIVE_INFINITY : Number(maxPrice)
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = products.filter(product => {
      const matchesPrice = product.priceValue >= minimum && product.priceValue <= maximum
      const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(product.brand)
      const inStock = !(product.trackStock ?? true) || (product.stockQuantity ?? 0) > 0
      const matchesAvailability = availability === 'all' || (availability === 'in-stock' ? inStock : !inStock)
      const matchesQuery = !normalizedQuery || `${product.name} ${product.brand} ${product.detail}`.toLowerCase().includes(normalizedQuery)
      return matchesPrice && matchesBrand && matchesAvailability && matchesQuery
    })

    if (sortBy === 'price-low') filtered.sort((first, second) => first.priceValue - second.priceValue)
    if (sortBy === 'price-high') filtered.sort((first, second) => second.priceValue - first.priceValue)
    if (sortBy === 'name-a-z') filtered.sort((first, second) => first.name.localeCompare(second.name))
    if (sortBy === 'name-z-a') filtered.sort((first, second) => second.name.localeCompare(first.name))
    return filtered
  }, [availability, maxPrice, minPrice, products, query, selectedBrands, sortBy])

  function toggleBrand(brand: string) {
    setSelectedBrands(current => current.includes(brand) ? current.filter(item => item !== brand) : [...current, brand])
  }

  function resetFilters() {
    setMinPrice('')
    setMaxPrice('')
    setSelectedBrands([])
    setAvailability('all')
    setSortBy('featured')
    setQuery('')
  }

  const sidebarProps = {
    activeCategory: category,
    categories,
    brands,
    minPrice,
    maxPrice,
    selectedBrands,
    availability,
    onAvailabilityChange: setAvailability,
    onMinPriceChange: setMinPrice,
    onMaxPriceChange: setMaxPrice,
    onToggleBrand: toggleBrand,
    onReset: resetFilters,
  }

  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1360px] px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-[10px] text-[#808792]">
        <Link to="/" className="hover:text-[#2459c5]">Home</Link><span>/</span><span className="font-semibold text-[#333b46]">{category}</span>
      </nav>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#737c87]">Shop computer gear</p><h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-[-0.035em] text-[#1d232a] sm:text-[30px]">{category}</h1></div>
        <p className="max-w-2xl text-xs leading-5 text-[#737c87]">{category === 'All gear' ? 'Browse the TechnoBaazar catalog and compare product details, availability, and prices.' : `Explore ${category.toLowerCase()} in the TechnoBaazar catalog.`}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3 bg-[#f2f3f5] px-3 py-2.5 sm:px-4">
        <p className="min-w-[130px] text-xs font-semibold text-[#3d4652]">{visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}</p>
        <label className="flex min-w-[200px] flex-1 items-center gap-2 border border-[#e1e4e9] bg-white px-3"><Search size={15} className="shrink-0 text-[#738093]"/><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search this collection" placeholder={`Search ${category.toLowerCase()}...`} className="h-9 min-w-0 flex-1 text-xs outline-none"/></label>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#555e69]">Sort by<select value={sortBy} onChange={event => setSortBy(event.target.value)} className="h-9 border border-[#dce0e5] bg-white px-2 text-xs text-[#17243a] outline-none focus:border-[#2459c5]"><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name-a-z">Name: A to Z</option><option value="name-z-a">Name: Z to A</option></select></label>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[225px_minmax(0,1fr)] lg:gap-6">
        <div className="lg:hidden"><details className="border border-[#e1e6ed] bg-white"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-[#263750]"><span className="inline-flex items-center gap-2"><SlidersHorizontal size={16}/>Category & filters</span><span className="text-xs font-medium text-[#738093]">{selectedBrands.length + Number(Boolean(minPrice || maxPrice)) + Number(availability !== 'all')} active</span></summary><div className="border-t border-[#edf0f4] p-4"><CollectionSidebar {...sidebarProps} idPrefix="mobile"/></div></details></div>
        <aside className="hidden bg-white pr-2 lg:block"><CollectionSidebar {...sidebarProps} idPrefix="desktop"/></aside>
        <section aria-label={`${category} products`}>
          {visibleProducts.length ? <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{visibleProducts.map(product => <ProductCard key={product.slug} product={product} isFavorite={favorites.includes(product.slug)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite}/>)}</div> : <div className="border border-dashed border-[#cbd5e2] bg-white px-5 py-14 text-center"><h2 className="font-display text-xl font-bold text-[#17243a]">No products match those filters</h2><p className="mt-2 text-sm text-[#647184]">Try another search, brand, or price range.</p><button type="button" onClick={resetFilters} className="mt-4 h-10 bg-[#244fa7] px-4 text-sm font-bold text-white">Reset filters</button></div>}
        </section>
      </div>
    </main>
  )
}

export default CollectionPage
