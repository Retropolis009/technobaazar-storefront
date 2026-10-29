import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import type { Product } from '../catalog'

interface FavoritesPageProps {
  products: Product[]
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

function FavoritesPage({ products, onAddToCart, onToggleFavorite }: FavoritesPageProps) {
  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1440px] px-4 py-10 sm:px-7 sm:py-14 lg:px-10">
      <p className="section-kicker">Your saved gear</p>
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Favorites</h1>
      {products.length ? (
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} isFavorite onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      ) : (
        <div className="mt-8 border border-[#dfe4dc] bg-white px-6 py-14 text-center">
          <Heart size={27} className="mx-auto text-[#315ee8]" />
          <h2 className="mt-4 font-display text-xl font-bold">Nothing saved just yet</h2>
          <p className="mt-2 text-sm text-[#68736c]">Tap the heart on a product to keep it close.</p>
          <Link to="/collections/all-gear" className="mt-5 inline-block text-sm font-semibold text-[#315ee8]">Browse all gear</Link>
        </div>
      )}
    </main>
  )
}

export default FavoritesPage