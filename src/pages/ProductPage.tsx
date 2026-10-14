import { ArrowLeft, ArrowUpRight, Heart, ShoppingBag, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { categorySlug, type Product } from '../catalog'

interface ProductPageProps {
  product: Product
  relatedProducts: Product[]
  favorites: string[]
  isFavorite: boolean
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

function ProductPage({ product, relatedProducts, favorites, isFavorite, onAddToCart, onToggleFavorite }: ProductPageProps) {
  return (
    <main id="top" className="mx-auto max-w-[1440px] px-4 py-8 sm:px-7 sm:py-12 lg:px-10">
      <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-xs text-[#68736c]">
        <Link to="/" className="hover:text-[#315ee8]">Home</Link><span>/</span>
        <Link to={`/collections/${categorySlug(product.category)}`} className="hover:text-[#315ee8]">{product.category}</Link><span>/</span>
        <span className="text-[#15201c]">{product.name}</span>
      </nav>
      <section className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative aspect-square overflow-hidden bg-white">
          <img src={product.image} alt={product.imageAlt} className="size-full object-cover" />
          <span className="absolute left-4 top-4 bg-[#c7f464] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em]">{product.badge}</span>
        </div>
        <div className="flex flex-col items-start justify-center py-2">
          <p className="section-kicker">{product.category}</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-[-0.045em] sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-sm text-[#68736c]">{product.detail}</p>
          <p className="mt-6 font-display text-2xl font-bold">{product.price}</p>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#566159]">{product.description}</p>
          <div className="mt-7 flex w-full flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onAddToCart(product)}
              className="inline-flex h-12 flex-1 items-center justify-center gap-3 bg-[#142c24] px-5 text-sm font-bold text-white transition hover:bg-[#315ee8] sm:flex-none"
            >
              <ShoppingBag size={17} /> Add to bag
            </button>
            <button
              type="button"
              onClick={() => onToggleFavorite(product.slug)}
              aria-pressed={isFavorite}
              className="inline-flex h-12 items-center justify-center gap-2 border border-[#cfd6ce] px-4 text-sm font-semibold transition hover:border-[#e04f48] hover:text-[#e04f48]"
            >
              <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
              <span className="hidden sm:inline">{isFavorite ? 'Saved' : 'Save'}</span>
            </button>
          </div>
          <p className="mt-5 inline-flex items-center gap-2 text-xs text-[#68736c]"><Truck size={16} /> Nationwide delivery available</p>
          <div className="mt-8 w-full border-t border-[#dfe4dc] pt-6">
            <h2 className="font-display text-lg font-bold">Specifications</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {product.specifications.map((specification) => (
                <li key={specification} className="border-l-2 border-[#c7f464] bg-white px-3 py-2 text-xs text-[#566159]">{specification}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="mt-16 border-t border-[#dfe4dc] pt-10" aria-labelledby="related-title">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div><p className="section-kicker">Keep exploring</p><h2 id="related-title" className="section-heading">More from {product.category}</h2></div>
            <Link to={`/collections/${categorySlug(product.category)}`} className="inline-flex items-center gap-2 text-xs font-semibold text-[#315ee8]">View collection <ArrowUpRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-5">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard
                key={relatedProduct.slug}
                product={relatedProduct}
                isFavorite={favorites.includes(relatedProduct.slug)}
                onAddToCart={onAddToCart}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}
      <Link to={`/collections/${categorySlug(product.category)}`} className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-[#315ee8]"><ArrowLeft size={16} /> Back to {product.category}</Link>
    </main>
  )
}

export default ProductPage
