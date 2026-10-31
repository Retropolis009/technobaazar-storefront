import { Heart, ShoppingCart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PLACEHOLDER_IMAGE, type Product } from '../catalog'

interface ProductCardProps {
  product: Product
  isFavorite: boolean
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

function ProductCard({ product, isFavorite, onAddToCart, onToggleFavorite }: ProductCardProps) {
  const outOfStock = (product.trackStock ?? true) && (product.stockQuantity ?? 0) <= 0
  const discount = product.compareAtPrice != null && product.compareAtPrice > product.priceValue
    ? Math.round((product.compareAtPrice - product.priceValue) / product.compareAtPrice * 100)
    : 0

  return (
    <article className="product-card group flex min-w-0 flex-col border border-[#e1e6ed] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#b9c9e5] hover:shadow-[0_10px_30px_rgba(25,55,105,.09)]">
      <div className="relative aspect-square overflow-hidden bg-[#f6f8fb] p-4 sm:p-5">
        <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`} className="block size-full">
          <img
            src={product.image || PLACEHOLDER_IMAGE}
            alt={product.imageAlt || product.name}
            loading="lazy"
            onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE }}
            className="size-full object-contain transition duration-300 group-hover:scale-[1.04]"
          />
        </Link>
        <span className="absolute left-2.5 top-2.5 max-w-[calc(100%-3.5rem)] truncate rounded-sm bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#526174] shadow-sm sm:left-3 sm:top-3">{product.category}</span>
        {discount > 0 && <span className="absolute bottom-2.5 left-2.5 rounded-sm bg-[#bd2f3d] px-2 py-1 text-[9px] font-bold text-white sm:bottom-3 sm:left-3">-{discount}%</span>}
        {product.badge && discount === 0 && <span className="absolute bottom-2.5 left-2.5 rounded-sm bg-[#e9f1ff] px-2 py-1 text-[9px] font-bold text-[#244fa7] sm:bottom-3 sm:left-3">{product.badge}</span>}
        <button
          type="button"
          onClick={() => onToggleFavorite(product.slug)}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full border border-[#e7ebf0] bg-white text-[#536274] shadow-sm transition hover:text-[#bd2f3d] sm:right-3 sm:top-3"
          aria-label={isFavorite ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
          aria-pressed={isFavorite}
        ><Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#788595]">{product.brand}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-[#17243a] sm:text-sm">
          <Link to={`/products/${product.slug}`} className="hover:text-[#244fa7]">{product.name}</Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-[11px] text-[#788595]">{product.detail}</p>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-3 font-display text-sm font-bold tracking-[-0.02em] text-[#18243a] sm:text-base">
          <span>{product.price}</span>
          {product.compareAtPrice != null && product.compareAtPrice > product.priceValue && <s className="font-sans text-xs font-medium text-[#8993a0]">{product.compareAt}</s>}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#edf0f4] pt-2.5">
          <span className={`text-[10px] font-semibold ${outOfStock ? 'text-[#b33643]' : 'text-[#37834d]'}`}>{outOfStock ? 'Out of stock' : 'Available'}</span>
          <button type="button" onClick={() => onAddToCart(product)} disabled={outOfStock} className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-[#244fa7] px-2.5 text-[10px] font-bold text-white transition hover:bg-[#173d88] disabled:cursor-not-allowed disabled:bg-[#a7afba]" aria-label={`Add ${product.name} to cart`}><ShoppingCart size={13}/>Add</button>
        </div>
      </div>
    </article>
  )
}

export default ProductCard
