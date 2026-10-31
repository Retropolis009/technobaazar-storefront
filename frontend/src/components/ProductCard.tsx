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
    <article className="product-card group flex min-w-0 flex-col border border-[#e8eaee] bg-white transition duration-200 hover:border-[#c9d3e1] hover:shadow-[0_7px_20px_rgba(18,35,60,.09)]">
      <div className="relative aspect-square overflow-hidden bg-white p-3 sm:p-4">
        <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`} className="block size-full">
          <img
            src={product.image || PLACEHOLDER_IMAGE}
            alt={product.imageAlt || product.name}
            loading="lazy"
            onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE }}
            className="size-full object-contain transition duration-300 group-hover:scale-[1.035]"
          />
        </Link>
        {product.badge && discount === 0 && <span className="absolute left-2.5 top-2.5 max-w-[calc(100%-3.5rem)] truncate bg-[#c91d45] px-2 py-1 text-[9px] font-bold text-white sm:left-3 sm:top-3">{product.badge}</span>}
        {discount > 0 && <span className="absolute left-2.5 top-2.5 bg-[#c91d45] px-2 py-1 text-[9px] font-bold text-white sm:left-3 sm:top-3">{discount}% Off</span>}
        <button
          type="button"
          onClick={() => onToggleFavorite(product.slug)}
          className="absolute right-2 top-2 grid size-8 place-items-center bg-white/95 text-[#627083] transition hover:text-[#c91d45] sm:right-2.5 sm:top-2.5"
          aria-label={isFavorite ? `Remove ${product.name} from favorites` : `Save ${product.name} to favorites`}
          aria-pressed={isFavorite}
        ><Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} /></button>
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-1 sm:px-3.5 sm:pb-3.5">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[#737c88]">{product.brand}</p>
        <h3 className="mt-1 min-h-10 line-clamp-2 text-[11px] font-semibold leading-[1.45] text-[#202833] sm:text-xs">
          <Link to={`/products/${product.slug}`} className="hover:text-[#2459c5]">{product.name}</Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-2 font-display text-xs font-bold tracking-[-0.02em] text-[#111820] sm:text-sm">
          <span>{product.price}</span>
          {product.compareAtPrice != null && product.compareAtPrice > product.priceValue && <s className="font-sans text-[10px] font-medium text-[#8993a0]">{product.compareAt}</s>}
        </div>
        <button type="button" onClick={() => onAddToCart(product)} disabled={outOfStock} className="mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1.5 bg-[#2b64d8] px-2 text-[10px] font-bold text-white transition hover:bg-[#174ead] disabled:cursor-not-allowed disabled:bg-[#959eaa] sm:h-9 sm:text-[11px]" aria-label={`${outOfStock ? 'Out of stock' : 'Add'} ${product.name} to cart`}><ShoppingCart size={13}/>{outOfStock ? 'Out of Stock' : 'Add to Cart'}</button>
      </div>
    </article>
  )
}

export default ProductCard
