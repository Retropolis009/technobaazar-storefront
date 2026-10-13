import { useState } from 'react'
import { Search } from 'lucide-react'
import type { Product } from '../data/storeData'
import ProductCard from './ProductCard'

const pageSize = 8

interface FeaturedProductsProps {
  favorites: string[]
  products: Product[]
  search: string
  onAddToCart: (product: Product) => void
  onClearFilters: () => void
  onToggleFavorite: (productName: string) => void
}

function FeaturedProducts({
  favorites,
  products,
  search,
  onAddToCart,
  onClearFilters,
  onToggleFavorite,
}: FeaturedProductsProps) {
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const visibleProducts = products.slice(0, visibleCount)

  return (
    <section id="products" className="scroll-mt-40 border-y border-[#e2e6df] bg-white py-12 sm:py-16" aria-labelledby="products-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-7 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-kicker">The good stuff</p>
            <h2 id="products-title" className="section-heading">Worth a closer look.</h2>
            <p className="mt-2 text-sm text-[#68736c]">Hand-picked tech for work, play, and everything between.</p>
          </div>
          <p className="text-xs font-semibold text-[#68736c]">{products.length} products</p>
        </div>

        {products.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:grid-cols-3 xl:grid-cols-6">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.name}
                product={product}
                isFavorite={favorites.includes(product.name)}
                onAddToCart={onAddToCart}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="mt-8 border border-dashed border-[#cbd2ca] px-5 py-12 text-center">
            <Search size={24} className="mx-auto text-[#929a94]" />
            <p className="mt-3 font-semibold">No gear found for “{search}”</p>
            <button type="button" onClick={onClearFilters} className="mt-3 text-sm font-semibold text-[#315ee8] underline underline-offset-4">
              Clear filters
            </button>
          </div>
        )}
        {visibleCount < products.length && (
          <div className="mt-9 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + pageSize)}
              className="inline-flex h-11 items-center gap-3 border border-[#cfd6ce] px-5 text-sm font-semibold transition hover:border-[#15201c] hover:bg-[#15201c] hover:text-white"
            >
              View more
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export default FeaturedProducts