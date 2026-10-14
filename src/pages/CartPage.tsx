import { ArrowRight, ShoppingBag, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Product } from '../catalog'
import { useState, type FormEvent } from 'react'
import type { Customer } from '../api'

interface CartPageProps {
  products: Product[]
  quantities: Record<string, number>
  onRemove: (productSlug: string) => void
  customer: Customer | null
  onCheckout: (details: { customerName: string; phone: string; address: string }) => Promise<string>
}

function CartPage({ products, quantities, onRemove, customer, onCheckout }: CartPageProps) {
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const subtotal = products.reduce((sum, product) => sum + product.priceValue * (quantities[product.slug] ?? 0), 0)

  async function submitCheckout(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      setOrderNumber(await onCheckout({ customerName: customer?.name ?? '', phone, address }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not place the order.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1100px] px-4 py-10 sm:px-7 sm:py-14">
      <p className="section-kicker">Your selection</p>
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Shopping bag</h1>
      {orderNumber && <p role="status" className="mt-5 border border-green-200 bg-green-50 p-4 text-sm text-green-900">Order {orderNumber} is confirmed. <Link to="/account" className="font-semibold underline">View your order</Link>.</p>}
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
          <div className="flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-sm font-semibold">{Object.values(quantities).reduce((total, quantity) => total + quantity, 0)} items in your bag</p>
            <p className="text-sm font-semibold">Subtotal: Rs. {subtotal.toLocaleString('en-PK')}</p>
          </div>
          {customer && <form onSubmit={submitCheckout} className="mt-5 max-w-xl border border-[#dfe4dc] bg-white p-5">
            <h2 className="font-display text-lg font-bold">Delivery details</h2>
            <p className="mt-1 text-xs text-[#68736c]">Cash on delivery. Final stock and prices are confirmed by the store.</p>
            <label className="mt-4 block text-sm font-semibold">Phone<input required maxLength={40} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal"/></label>
            <label className="mt-4 block text-sm font-semibold">Delivery address<textarea required maxLength={1000} autoComplete="street-address" rows={3} value={address} onChange={event => setAddress(event.target.value)} className="mt-1 w-full border border-[#cfd6ce] p-3 font-normal"/></label>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="mt-4 h-11 w-full bg-[#142c24] font-semibold text-white disabled:opacity-60">{busy ? 'Placing order…' : 'Place cash-on-delivery order'}</button>
          </form>}
        </div>
      ) : (
        <div className="mt-8 border border-[#dfe4dc] bg-white px-6 py-14 text-center">
          <ShoppingBag size={27} className="mx-auto text-[#315ee8]" />
          <h2 className="mt-4 font-display text-xl font-bold">{orderNumber ? 'Your order is confirmed' : 'Your bag is ready for something good'}</h2>
          <p className="mt-2 text-sm text-[#68736c]">Add gear you like and it will show up here.</p>
          {orderNumber && <p className="mt-2 text-sm">Order {orderNumber}. <Link to="/account" className="text-[#315ee8] underline">View your account</Link></p>}
          <Link to="/collections/all-gear" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#315ee8]">Browse all gear <ArrowRight size={15} /></Link>
        </div>
      )}
    </main>
  )
}

export default CartPage
