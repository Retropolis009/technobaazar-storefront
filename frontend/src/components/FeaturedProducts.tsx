import { ArrowRight, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Product } from '../catalog'
import ProductCard from './ProductCard'

interface FeaturedProductsProps {
  favorites: string[]
  products: Product[]
  search: string
  kicker?: string
  title?: string
  subtitle?: string
  onAddToCart: (product: Product) => void
  onClearFilters: () => void
  onToggleFavorite: (productName: string) => void
}

function FeaturedProducts({
  favorites,
  products,
  search,
  kicker = 'Featured products',
  title = 'Find the right gear for your setup.',
  subtitle = 'Compare current computer components, laptops, and accessories from the store catalog.',
  onAddToCart,
  onClearFilters,
  onToggleFavorite,
}: FeaturedProductsProps) {
  const displayProducts = search.trim() ? products : products.slice(0, 8)

  return (
    <section id="products" className="scroll-mt-40 border-y border-[#e2e6df] bg-[#f7f9fc] py-12 sm:py-16" aria-labelledby="products-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-7 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">{kicker}</p>
            <h2 id="products-title" className="section-heading">{search.trim() ? `Results for “${search.trim()}”` : title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736c]">{subtitle}</p>
          </div>
          <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
            <p className="text-xs font-semibold text-[#68736c]">{products.length} {products.length === 1 ? 'item' : 'items'}</p>
            {!search.trim() && <Link to="/collections/all-gear" className="inline-flex h-10 items-center gap-2 border border-[#c9d5eb] bg-white px-3 text-xs font-bold text-[#244fa7] transition hover:border-[#244fa7]">View full catalog<ArrowRight size={14}/></Link>}
          </div>
        </div>

        {displayProducts.length > 0 ? (
          <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 sm:gap-y-8 md:grid-cols-3 xl:grid-cols-4">
            {displayProducts.map((product) => (
              <ProductCard key={product.slug} product={product} isFavorite={favorites.includes(product.slug)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite} />
            ))}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-[#cbd2ca] bg-white px-5 py-12 text-center">
            <Search size={24} className="mx-auto text-[#929a94]" />
            <p className="mt-3 font-semibold">No gear found for “{search}”</p>
            <button type="button" onClick={onClearFilters} className="mt-3 text-sm font-semibold text-[#244fa7] underline underline-offset-4">Clear search</button>
          </div>
        )}
        {!search.trim() && products.length > displayProducts.length && <div className="mt-8 text-center"><Link to="/collections/all-gear" className="inline-flex h-11 items-center gap-2 rounded-sm bg-[#244fa7] px-5 text-sm font-bold text-white transition hover:bg-[#173d88]">Browse all {products.length} products<ArrowRight size={16}/></Link></div>}
      </div>
    </section>
  )
}

export default FeaturedProducts
