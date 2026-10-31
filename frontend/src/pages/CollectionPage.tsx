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
      const matchesQuery = !normalizedQuery || `${product.name} ${product.brand} ${product.detail}`.toLowerCase().includes(normalizedQuery)
      return matchesPrice && matchesBrand && matchesQuery
    })

    if (sortBy === 'price-low') filtered.sort((first, second) => first.priceValue - second.priceValue)
    if (sortBy === 'price-high') filtered.sort((first, second) => second.priceValue - first.priceValue)
    if (sortBy === 'name-a-z') filtered.sort((first, second) => first.name.localeCompare(second.name))
    if (sortBy === 'name-z-a') filtered.sort((first, second) => second.name.localeCompare(first.name))
    return filtered
  }, [maxPrice, minPrice, products, query, selectedBrands, sortBy])

  function toggleBrand(brand: string) {
    setSelectedBrands(current => current.includes(brand) ? current.filter(item => item !== brand) : [...current, brand])
  }

  function resetFilters() {
    setMinPrice('')
    setMaxPrice('')
    setSelectedBrands([])
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
    onMinPriceChange: setMinPrice,
    onMaxPriceChange: setMaxPrice,
    onToggleBrand: toggleBrand,
    onReset: resetFilters,
  }

  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1440px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-xs text-[#738093]">
        <Link to="/" className="hover:text-[#244fa7]">Home</Link><span>/</span><span className="font-semibold text-[#34445d]">{category}</span>
      </nav>
      <header className="border border-[#dce4ef] bg-white px-5 py-6 sm:px-8 sm:py-8">
        <p className="section-kicker">Shop computer gear</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="font-display text-3xl font-bold tracking-[-0.045em] text-[#17243a] sm:text-4xl">{category}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#647184]">{category === 'All gear' ? 'Browse the current TechnoBaazar computer and technology catalog. Compare details and prices before choosing your gear.' : `Explore ${category.toLowerCase()} in the TechnoBaazar catalog. Compare specifications, availability, and prices.`}</p></div>
          <p className="text-xs font-semibold text-[#647184]">{visibleProducts.length} {visibleProducts.length === 1 ? 'product' : 'products'}</p>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-3 border border-[#e1e6ed] bg-white p-3">
        <label className="flex min-w-[210px] flex-1 items-center gap-2 border border-[#dce3ed] px-3"><Search size={16} className="shrink-0 text-[#738093]"/><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search this collection" placeholder={`Search ${category.toLowerCase()}...`} className="h-10 min-w-0 flex-1 text-sm outline-none"/></label>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#647184]">Sort by<select value={sortBy} onChange={event => setSortBy(event.target.value)} className="h-10 border border-[#dce3ed] bg-white px-3 text-sm text-[#17243a] outline-none focus:border-[#244fa7]"><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name-a-z">Name: A to Z</option><option value="name-z-a">Name: Z to A</option></select></label>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-7">
        <div className="lg:hidden"><details className="border border-[#e1e6ed] bg-white"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-[#263750]"><span className="inline-flex items-center gap-2"><SlidersHorizontal size={16}/>Category & filters</span><span className="text-xs font-medium text-[#738093]">{selectedBrands.length + Number(Boolean(minPrice || maxPrice))} active</span></summary><div className="border-t border-[#edf0f4] p-4"><CollectionSidebar {...sidebarProps} idPrefix="mobile"/></div></details></div>
        <aside className="hidden border border-[#e1e6ed] bg-white p-4 lg:block"><CollectionSidebar {...sidebarProps} idPrefix="desktop"/></aside>
        <section aria-label={`${category} products`}>
          {visibleProducts.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visibleProducts.map(product => <ProductCard key={product.slug} product={product} isFavorite={favorites.includes(product.slug)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite}/>)}</div> : <div className="border border-dashed border-[#cbd5e2] bg-white px-5 py-14 text-center"><h2 className="font-display text-xl font-bold text-[#17243a]">No products match those filters</h2><p className="mt-2 text-sm text-[#647184]">Try another search, brand, or price range.</p><button type="button" onClick={resetFilters} className="mt-4 h-10 bg-[#244fa7] px-4 text-sm font-bold text-white">Reset filters</button></div>}
        </section>
      </div>
    </main>
  )
}

export default CollectionPage
