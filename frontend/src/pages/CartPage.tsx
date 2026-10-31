import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Minus, PackageCheck, Plus, ShoppingBag, TicketPercent, Truck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PLACEHOLDER_IMAGE, type Product } from '../catalog'
import { apiRequest, formatPKR, type CheckoutPayload, type CouponPreview, type Customer, type OrderSummary, type StoreSettings } from '../api'

interface CartPageProps {
  products: Product[]
  quantities: Record<string, number>
  onUpdateQuantity: (productSlug: string, quantity: number) => void
  onRemove: (productSlug: string) => void
  customer: Customer | null
  settings: StoreSettings
  checkoutNote: string
  paymentNote: string
  confirmationNote: string
  onOrderPlaced: (order: OrderSummary) => void
}

const PAYMENT_METHODS = [
  { value: 'cash_on_delivery', label: 'Cash on delivery', detail: 'Pay in cash when your order arrives.' },
  { value: 'bank_transfer_manual', label: 'Bank transfer', detail: 'Transfer after checkout; account details are shared on confirmation.' },
]

function CartPage({ products, quantities, onUpdateQuantity, onRemove, customer, settings, checkoutNote, paymentNote, confirmationNote, onOrderPlaced }: CartPageProps) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery')
  const [note, setNote] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [coupon, setCoupon] = useState<CouponPreview | null>(null)
  const [couponError, setCouponError] = useState('')
  const [couponBusy, setCouponBusy] = useState(false)
  const [attemptKey, setAttemptKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState<OrderSummary | null>(null)

  const subtotal = products.reduce((sum, product) => sum + product.priceValue * (quantities[product.slug] ?? 0), 0)
  const itemCount = Object.values(quantities).reduce((total, quantity) => total + quantity, 0)
  const selectedCity = settings.cities.find((entry) => entry.name === city)
  const fallbackShipping = useMemo(() => {
    if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) return 0
    return selectedCity ? selectedCity.fee : settings.deliveryFee
  }, [settings, subtotal, selectedCity])
  const discount = coupon && coupon.subtotal === subtotal ? coupon.discountAmount : 0
  const shipping = coupon && coupon.subtotal === subtotal ? coupon.shipping : fallbackShipping
  const total = subtotal - discount + shipping

  useEffect(() => {
    setName(customer?.name ?? '')
    setEmail(customer?.email ?? '')
  }, [customer])

  useEffect(() => {
    let active = true
    apiRequest<{ key: string }>('/api/checkout-attempt', { method: 'POST', body: JSON.stringify({ key: crypto.randomUUID() }) })
      .then((data) => { if (active) setAttemptKey(data.key) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setCouponBusy(true)
    setCouponError('')
    try {
      const preview = await apiRequest<CouponPreview>('/api/coupons/preview', {
        method: 'POST', body: JSON.stringify({ code: couponCode, city }),
      })
      setCoupon(preview)
    } catch (cause) {
      setCoupon(null)
      setCouponError(cause instanceof Error ? cause.message : 'Could not apply this coupon.')
    } finally {
      setCouponBusy(false)
    }
  }

  async function submitCheckout(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      let key = attemptKey
      if (!key) {
        const attempt = await apiRequest<{ key: string }>('/api/checkout-attempt', { method: 'POST', body: JSON.stringify({ key: crypto.randomUUID() }) })
        key = attempt.key
        setAttemptKey(key)
      }
      const payload: CheckoutPayload = {
        customerName: name, phone, email: email || undefined, address, city,
        postalCode: postalCode || undefined, paymentMethod,
        couponCode: coupon && coupon.subtotal === subtotal ? coupon.code : undefined,
        note: note || undefined, attemptKey: key,
      }
      const order = await apiRequest<OrderSummary>('/api/orders', { method: 'POST', body: JSON.stringify(payload) })
      setPlaced(order)
      setCoupon(null)
      setCouponCode('')
      onOrderPlaced(order)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not place the order.')
    } finally {
      setBusy(false)
    }
  }

  if (placed) {
    return (
      <main id="top" className="mx-auto min-h-[70vh] max-w-[1100px] px-4 py-10 sm:px-7 sm:py-14">
        <p className="section-kicker">Order confirmed</p>
        <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Thank you, {placed.customerName ?? name}.</h1>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div className="border border-[#dfe4dc] bg-white p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#347346]"><PackageCheck size={18} /> Order {placed.orderNumber} is confirmed.</p>
            <p className="mt-3 text-sm leading-6 text-[#68736c]">{confirmationNote}</p>
            <dl className="mt-6 space-y-3 border-t border-[#edf0eb] pt-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-[#68736c]">Deliver to</dt><dd className="text-right font-semibold">{placed.city ? `${placed.city} — ` : ''}{address || '—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#68736c]">Payment</dt><dd className="text-right font-semibold">{paymentLabel(placed.paymentMethod)} · {placed.paymentStatus.replaceAll('_', ' ')}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[#68736c]">Items</dt><dd className="text-right font-semibold">{placed.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</dd></div>
            </dl>
            <div className="mt-6 space-y-2 border-t border-[#edf0eb] pt-5 text-sm">
              <div className="flex justify-between"><span className="text-[#68736c]">Subtotal</span><strong>{formatPKR(placed.subtotal ?? subtotal)}</strong></div>
              {(placed.discountAmount ?? 0) > 0 && <div className="flex justify-between text-[#347346]"><span>Coupon {placed.couponCode}</span><strong>− {formatPKR(placed.discountAmount ?? 0)}</strong></div>}
              <div className="flex justify-between"><span className="text-[#68736c]">Delivery</span><strong>{(placed.shipping ?? 0) === 0 ? 'Free' : formatPKR(placed.shipping ?? 0)}</strong></div>
              <div className="flex justify-between border-t border-[#edf0eb] pt-3 font-display text-lg font-bold"><span>Total</span><span>{formatPKR(placed.total)}</span></div>
            </div>
          </div>
          <div className="h-fit border border-[#dfe4dc] bg-[#142c24] p-6 text-sm leading-6 text-white/80 sm:p-7">
            <h2 className="font-display text-lg font-bold text-white">What happens next?</h2>
            <p className="mt-3">{paymentNote}</p>
            <p className="mt-3">Keep your phone nearby — the store confirms every order before dispatch.</p>
            <div className="mt-6 grid gap-3">
              {customer
                ? <Link to="/account" className="inline-flex h-11 items-center justify-center gap-2 bg-[#c7f464] font-semibold text-[#142c24]">View your orders <ArrowRight size={15} /></Link>
                : <Link to="/account" className="inline-flex h-11 items-center justify-center gap-2 bg-[#c7f464] font-semibold text-[#142c24]">Create an account to track orders <ArrowRight size={15} /></Link>}
              <Link to="/collections/all-gear" className="inline-flex h-11 items-center justify-center gap-2 border border-white/25 font-semibold text-white">Continue shopping</Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1100px] px-4 py-10 sm:px-7 sm:py-14">
      <p className="section-kicker">Your selection</p>
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Shopping bag</h1>
      {products.length ? (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
          <div className="divide-y divide-[#dfe4dc] border-y border-[#dfe4dc]">
            {products.map((product) => {
              const maximum = (product.trackStock ?? true) ? Math.min(99, product.stockQuantity ?? 99) : 99
              const quantity = Math.min(quantities[product.slug] ?? 1, Math.max(maximum, 1))
              return (
                <article key={product.slug} className="flex gap-4 py-5 sm:gap-6">
                  <Link to={`/products/${product.slug}`} className="size-24 shrink-0 overflow-hidden bg-white sm:size-32">
                    <img
                      src={product.image || PLACEHOLDER_IMAGE}
                      alt={product.imageAlt || product.name}
                      onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE }}
                      className="size-full object-cover"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#315ee8]">{product.category}</p>
                      <Link to={`/products/${product.slug}`} className="mt-1 block font-semibold hover:text-[#315ee8]">{product.name}</Link>
                      <p className="mt-1 text-xs text-[#68736c]">{product.price} each</p>
                      <div className="mt-3 inline-flex h-10 items-center border border-[#cfd6ce] bg-white" aria-label={`Quantity for ${product.name}`}>
                        <button type="button" onClick={() => onUpdateQuantity(product.slug, quantity - 1)} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid size-9 place-items-center disabled:opacity-35"><Minus size={14} /></button>
                        <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
                        <button type="button" onClick={() => onUpdateQuantity(product.slug, quantity + 1)} disabled={quantity >= maximum} aria-label="Increase quantity" className="grid size-9 place-items-center disabled:opacity-35"><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <strong className="text-sm">{formatPKR(product.priceValue * quantity)}</strong>
                      <button type="button" onClick={() => onRemove(product.slug)} aria-label={`Remove ${product.name} from bag`} className="grid size-9 place-items-center text-[#68736c] hover:bg-white hover:text-[#e04f48]"><X size={17} /></button>
                    </div>
                  </div>
                </article>
              )
            })}
            <p className="py-5 text-sm font-semibold">{itemCount} items in your bag</p>
          </div>

          <div className="space-y-5 lg:sticky lg:top-40">
            <section className="border border-[#dfe4dc] bg-white p-5" aria-label="Order summary">
              <h2 className="font-display text-lg font-bold">Order summary</h2>
              <div className="mt-4">
                <label htmlFor="coupon-code" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#566159]"><TicketPercent size={14} /> Coupon code</label>
                <div className="mt-2 flex gap-2">
                  <input id="coupon-code" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="SAVE10" className="h-11 min-w-0 flex-1 border border-[#cfd6ce] px-3 text-sm uppercase outline-none focus:border-[#315ee8]" />
                  <button type="button" onClick={applyCoupon} disabled={couponBusy || !couponCode.trim()} className="h-11 shrink-0 bg-[#142c24] px-4 text-sm font-semibold text-white disabled:opacity-60">{couponBusy ? '…' : 'Apply'}</button>
                </div>
                {coupon && coupon.subtotal === subtotal && <p className="mt-2 text-xs font-semibold text-[#347346]">{coupon.code} applied — you save {formatPKR(coupon.discountAmount)}.</p>}
                {couponError && <p role="alert" className="mt-2 text-xs text-red-700">{couponError}</p>}
              </div>
              <div className="mt-4 space-y-2 border-t border-[#edf0eb] pt-4 text-sm">
                <div className="flex justify-between"><span className="text-[#68736c]">Subtotal</span><strong>{formatPKR(subtotal)}</strong></div>
                {discount > 0 && <div className="flex justify-between text-[#347346]"><span>Discount</span><strong>− {formatPKR(discount)}</strong></div>}
                <div className="flex justify-between"><span className="inline-flex items-center gap-1.5 text-[#68736c]"><Truck size={14} /> Delivery{selectedCity ? ` · ${selectedCity.name}` : ''}</span><strong>{shipping === 0 ? 'Free' : formatPKR(shipping)}</strong></div>
                <div className="flex justify-between border-t border-[#edf0eb] pt-3 font-display text-lg font-bold"><span>Total</span><span>{formatPKR(total)}</span></div>
              </div>
              {settings.freeShippingThreshold > 0 && subtotal < settings.freeShippingThreshold && (
                <p className="mt-3 text-xs leading-5 text-[#68736c]">Add {formatPKR(settings.freeShippingThreshold - subtotal)} more to unlock free delivery.</p>
              )}
            </section>

            <form onSubmit={submitCheckout} className="border border-[#dfe4dc] bg-white p-5">
              <h2 className="font-display text-lg font-bold">Checkout</h2>
              <p className="mt-1 text-xs leading-5 text-[#68736c]">{checkoutNote}</p>
              {!customer && <p className="mt-3 border border-[#e2e6df] bg-[#f5f6f2] p-3 text-xs leading-5 text-[#566159]">Checking out as a guest. <Link to="/account" className="font-semibold text-[#315ee8]">Sign in or create an account</Link> to track orders and sync your bag.</p>}
              <div className="mt-4 grid gap-4">
                <label className="text-sm font-semibold">Full name <span className="text-red-700">*</span><input required maxLength={160} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]" /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">Phone <span className="text-red-700">*</span><input required maxLength={40} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="03xx xxxxxxx" className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]" /></label>
                  <label className="text-sm font-semibold">Email <span className="text-red-700">*</span><input required type="email" maxLength={255} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]" /></label>
                </div>
                <label className="text-sm font-semibold">Delivery address <span className="text-red-700">*</span><textarea required maxLength={1000} autoComplete="street-address" rows={2} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="House, street, area" className="mt-1 w-full border border-[#cfd6ce] p-3 font-normal outline-none focus:border-[#315ee8]" /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">City <span className="text-red-700">*</span>
                    <select required autoComplete="address-level2" value={city} onChange={(event) => { setCity(event.target.value); setCoupon(null) }} className="mt-1 h-11 w-full border border-[#cfd6ce] bg-white px-3 font-normal outline-none focus:border-[#315ee8]">
                      <option value="">Select a Pakistan city</option>
                      {settings.cities.map((entry) => <option key={entry.slug} value={entry.name}>{entry.name} · {formatPKR(entry.fee)} delivery</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-semibold">Postal code <span className="text-red-700">*</span><input required maxLength={20} autoComplete="postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="e.g. 75500" className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]" /></label>
                </div>
                <fieldset>
                  <legend className="text-sm font-semibold">Payment method <span className="text-red-700">*</span></legend>
                  <div className="mt-2 grid gap-2">
                    {PAYMENT_METHODS.map((method) => (
                      <label key={method.value} className={`flex cursor-pointer items-start gap-3 border p-3 ${paymentMethod === method.value ? 'border-[#315ee8] bg-[#f4f6ff]' : 'border-[#dfe4dc]'}`}>
                        <input type="radio" name="payment-method" value={method.value} checked={paymentMethod === method.value} onChange={() => setPaymentMethod(method.value)} className="mt-1 accent-[#315ee8]" />
                        <span><span className="block text-sm font-semibold">{method.label}</span><span className="mt-0.5 block text-xs text-[#68736c]">{method.detail}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="text-sm font-semibold">Order note <span className="font-normal text-[#9aa29b]">(optional)</span><input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Delivery instructions" className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 font-normal outline-none focus:border-[#315ee8]" /></label>
              </div>
              {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
              <button disabled={busy || !products.length} className="mt-4 h-12 w-full bg-[#142c24] font-semibold text-white transition hover:bg-[#315ee8] disabled:opacity-60">
                {busy ? 'Placing order…' : `Place order · ${formatPKR(total)}`}
              </button>
            </form>
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

function paymentLabel(method: string) {
  return method === 'bank_transfer_manual' ? 'Bank transfer' : 'Cash on delivery'
}

export default CartPage
