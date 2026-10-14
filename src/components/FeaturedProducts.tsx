import { Search } from 'lucide-react'
import type { Product } from '../catalog'
import ProductCard from './ProductCard'

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
  const groupedProducts = products.reduce<Record<string, Product[]>>((groups, product) => {
    ;(groups[product.category] ??= []).push(product)
    return groups
  }, {})
  const categoryOrder = ['Graphics Cards', 'Processors', 'Motherboards', 'Memory', 'Storage', 'Power Supplies', 'Cases & Cooling', 'Laptops', 'Monitors', 'Audio', 'Accessories']
  const orderedGroups = Object.entries(groupedProducts).sort(([a], [b]) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b))

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
          <div className="mt-8 space-y-12">
            {orderedGroups.map(([category, categoryProducts]) => (
              <section key={category} aria-label={category}>
                <div className="mb-4 flex items-center gap-3 border-b border-[#e2e6df] pb-3">
                  <h3 className="font-display text-lg font-bold">{category}</h3>
                  <span className="text-xs text-[#68736c]">{categoryProducts.length} items</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 sm:gap-y-9 lg:grid-cols-3 xl:grid-cols-6">
                  {categoryProducts.map((product) => (
                    <ProductCard key={product.slug} product={product} isFavorite={favorites.includes(product.slug)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite} />
                  ))}
                </div>
              </section>
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
      </div>
    </section>
  )
}

export default FeaturedProducts
