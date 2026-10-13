import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import CollectionSidebar from '../components/CollectionSidebar'
import ProductCard from '../components/ProductCard'
import type { Product } from '../data/storeData'

interface CollectionPageProps {
  category: string
  products: Product[]
  favorites: string[]
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

function CollectionPage({ category, products, favorites, onAddToCart, onToggleFavorite }: CollectionPageProps) {
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('featured')
  const brands = useMemo(() => [...new Set(products.map((product) => product.brand))].sort((a, b) => a.localeCompare(b)), [products])

  const visibleProducts = useMemo(() => {
    const minimum = minPrice === '' ? 0 : Number(minPrice)
    const maximum = maxPrice === '' ? Number.POSITIVE_INFINITY : Number(maxPrice)
    const filtered = products.filter((product) => {
      const matchesPrice = product.priceValue >= minimum && product.priceValue <= maximum
      const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(product.brand)
      return matchesPrice && matchesBrand
    })

    if (sortBy === 'price-low') filtered.sort((first, second) => first.priceValue - second.priceValue)
    if (sortBy === 'price-high') filtered.sort((first, second) => second.priceValue - first.priceValue)
    if (sortBy === 'name-a-z') filtered.sort((first, second) => first.name.localeCompare(second.name))
    if (sortBy === 'name-z-a') filtered.sort((first, second) => second.name.localeCompare(first.name))
    return filtered
  }, [maxPrice, minPrice, products, selectedBrands, sortBy])

  function toggleBrand(brand: string) {
    setSelectedBrands((current) =>
      current.includes(brand) ? current.filter((item) => item !== brand) : [...current, brand],
    )
  }

  function resetFilters() {
    setMinPrice('')
    setMaxPrice('')
    setSelectedBrands([])
    setSortBy('featured')
  }

  const sidebarProps = {
    activeCategory: category,
    brands,
    minPrice,
    maxPrice,
    selectedBrands,
    sortBy,
    onMinPriceChange: setMinPrice,
    onMaxPriceChange: setMaxPrice,
    onToggleBrand: toggleBrand,
    onSortChange: setSortBy,
    onReset: resetFilters,
  }

  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1440px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10">
      <nav aria-label="Breadcrumb" className="mb-7 flex items-center gap-2 text-xs text-[#68736c]">
        <Link to="/" className="hover:text-[#315ee8]">Home</Link><span>/</span><span className="text-[#15201c]">{category}</span>
      </nav>
      <div className="border-b border-[#dfe4dc] pb-6">
        <p className="section-kicker">TechnoBaazar collection</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-[-0.05em] sm:text-5xl">{category}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68736c]">
              {category === 'All gear'
                ? 'Explore carefully picked tech for your setup, workspace, and everyday life.'
                : category === 'Components'
                  ? 'Build from the essentials: processors, graphics, memory, storage, and more.'
                  : `Explore ${category.toLowerCase()} selected for performance, reliability, and a better setup.`}
            </p>
          </div>
          <p className="text-xs font-semibold text-[#68736c]">{visibleProducts.length} of {products.length} products</p>
        </div>
      </div>

      <div className="mt-6 lg:hidden">
        <details className="border border-[#dfe4dc] bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Filter and sort products</summary>
          <div className="border-t border-[#dfe4dc] p-4">
            <CollectionSidebar {...sidebarProps} idPrefix="mobile" />
          </div>
        </details>
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#dfe4dc] pr-6 lg:block">
          <CollectionSidebar {...sidebarProps} idPrefix="desktop" />
        </aside>
        {visibleProducts.length ? (
          <div className="grid grid-cols-2 content-start gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                isFavorite={favorites.includes(product.name)}
                onAddToCart={onAddToCart}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center lg:col-start-2">
            <h2 className="font-display text-2xl font-bold">No products match these filters</h2>
            <p className="mt-2 text-sm text-[#68736c]">Try another price range or clear the selected brands.</p>
            <button type="button" onClick={resetFilters} className="mt-4 text-sm font-semibold text-[#315ee8] underline underline-offset-4">Reset filters</button>
          </div>
        )}
      </div>
    </main>
  )
}

export default CollectionPage
