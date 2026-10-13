import { ArrowRight, ShoppingBag, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Product } from '../data/storeData'

interface CartPageProps {
  products: Product[]
  quantities: Record<string, number>
  onRemove: (productSlug: string) => void
}

function CartPage({ products, quantities, onRemove }: CartPageProps) {
  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1100px] px-4 py-10 sm:px-7 sm:py-14">
      <p className="section-kicker">Your selection</p>
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Shopping bag</h1>
      {products.length ? (
        <div className="mt-8 divide-y divide-[#dfe4dc] border-y border-[#dfe4dc]">
          {products.map((product) => (
            <article key={product.slug} className="flex gap-4 py-5 sm:gap-6">
              <Link to={`/products/${product.slug}`} className="size-24 shrink-0 overflow-hidden bg-white sm:size-32">
                <img src={product.image} alt={product.imageAlt} className="size-full object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#315ee8]">{product.category}</p>
                  <Link to={`/products/${product.slug}`} className="mt-1 block font-semibold hover:text-[#315ee8]">{product.name}</Link>
                  <p className="mt-2 text-xs text-[#68736c]">Qty {quantities[product.slug]} · {product.price}</p>
                </div>
                <button type="button" onClick={() => onRemove(product.slug)} aria-label={`Remove ${product.name} from bag`} className="grid size-9 shrink-0 place-items-center text-[#68736c] hover:bg-white hover:text-[#e04f48]"><X size={17} /></button>
              </div>
            </article>
          ))}
          <div className="flex items-center justify-between py-5">
            <p className="text-sm font-semibold">{Object.values(quantities).reduce((total, quantity) => total + quantity, 0)} items in your bag</p>
            <p className="text-xs text-[#68736c]">Checkout can be connected later</p>
          </div>
        </div>
      ) : (
        <div className="mt-8 border border-[#dfe4dc] bg-white px-6 py-14 text-center">
          <ShoppingBag size={27} className="mx-auto text-[#315ee8]" />
          <h2 className="mt-4 font-display text-xl font-bold">Your bag is ready for something good</h2>
          <p className="mt-2 text-sm text-[#68736c]">Add gear you like and it will show up here.</p>
          <Link to="/collections/all-gear" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#315ee8]">Browse all gear <ArrowRight size={15} /></Link>
        </div>
      )}
    </main>
  )
}

export default CartPage