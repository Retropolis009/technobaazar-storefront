import { Link } from 'react-router-dom'
import { Heart, ShoppingBag } from 'lucide-react'
import type { Product } from '../catalog'

interface ProductCardProps {
  product: Product
  isFavorite: boolean
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

function ProductCard({ product, isFavorite, onAddToCart, onToggleFavorite }: ProductCardProps) {
  return (
    <article className="product-card group">
      <div className="product-image-wrap relative aspect-[0.94] overflow-hidden bg-[#f2f4f0]">
        <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`} className="block size-full">
          <img
            src={product.image}
            alt={product.imageAlt}
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
          />
        </Link>
        <button
          type="button"
          onClick={() => onAddToCart(product)}
          className="absolute bottom-2.5 right-2.5 grid size-9 place-items-center bg-[#c7f464] text-[#142c24] transition hover:bg-[#142c24] hover:text-white sm:bottom-3 sm:right-3"
          aria-label={`Add ${product.name} to bag`}
        >
          <ShoppingBag size={16} />
        </button>
        <button
          type="button"
          onClick={() => onToggleFavorite(product.slug)}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-white text-[#142c24] shadow-sm transition hover:text-[#e04f48] sm:right-3 sm:top-3"
          aria-label={isFavorite ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
          aria-pressed={isFavorite}
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="pt-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#315ee8]">{product.category}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-[#15201c] sm:text-sm">
          <Link to={`/products/${product.slug}`} className="hover:text-[#315ee8]">{product.name}</Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-[11px] text-[#78817a]">{product.detail}</p>
        <p className="mt-3 font-display text-sm font-bold tracking-[-0.02em] sm:text-base">{product.price}</p>
      </div>
    </article>
  )
}

export default ProductCard
