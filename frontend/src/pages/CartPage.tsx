import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, CreditCard, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, TicketPercent, Truck, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PLACEHOLDER_IMAGE, type Product } from '../catalog'
import { apiRequest, formatPKR, type CheckoutPayload, type CouponPreview, type Customer, type OrderSummary, type StoreSettings } from '../api'

interface CartPageProps {
  mode: 'cart' | 'checkout'
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
  { value: 'cash_on_delivery', label: 'Cash on delivery', detail: 'Pay in cash when your order arrives.', icon: Truck },
  { value: 'bank_transfer_manual', label: 'Bank transfer', detail: 'Transfer after checkout; account details are shared on confirmation.', icon: CreditCard },
]

function CartPage({ mode, products, quantities, onUpdateQuantity, onRemove, customer, settings, checkoutNote, paymentNote, confirmationNote, onOrderPlaced }: CartPageProps) {
  const isCheckout = mode === 'checkout'
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
    if (!isCheckout) return
    let active = true
    apiRequest<{ key: string }>('/api/checkout-attempt', { method: 'POST', body: JSON.stringify({ key: crypto.randomUUID() }) })
      .then((data) => { if (active) setAttemptKey(data.key) })
      .catch(() => undefined)
    return () => { active = false }
  }, [isCheckout])

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
    return <main id="top" className="mx-auto min-h-[65vh] max-w-[1120px] px-4 py-10 sm:px-7 sm:py-14 lg:px-10">
      <div className="mx-auto max-w-3xl border border-[#e1e6ed] bg-white p-6 text-center shadow-sm sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#eaf6ee] text-[#32804a]"><Check size={25}/></span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#32804a]">Order confirmed</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Thank you, {placed.customerName ?? name}.</h1>
        <p className="mt-3 text-sm text-[#647184]">Order <strong className="text-[#17243a]">{placed.orderNumber}</strong> has been received. {confirmationNote}</p>
        <div className="mt-7 grid gap-5 text-left sm:grid-cols-[1fr_0.8fr]">
          <div className="border border-[#e1e6ed] p-4 sm:p-5">
            <h2 className="font-bold text-[#17243a]">Delivery and payment</h2>
            <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-[#748092]">Deliver to</dt><dd className="text-right font-semibold">{placed.city ? `${placed.city} — ` : ''}{address || '—'}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#748092]">Payment</dt><dd className="text-right font-semibold">{paymentLabel(placed.paymentMethod)}</dd></div><div className="flex justify-between gap-3"><dt className="text-[#748092]">Items</dt><dd className="text-right font-semibold">{placed.items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div></dl>
            <div className="mt-4 space-y-2 border-t border-[#edf0f4] pt-4 text-sm"><div className="flex justify-between"><span className="text-[#748092]">Subtotal</span><strong>{formatPKR(placed.subtotal ?? subtotal)}</strong></div>{(placed.discountAmount ?? 0) > 0 && <div className="flex justify-between text-[#32804a]"><span>Discount</span><strong>− {formatPKR(placed.discountAmount ?? 0)}</strong></div>}<div className="flex justify-between"><span className="text-[#748092]">Delivery</span><strong>{(placed.shipping ?? 0) === 0 ? 'Free' : formatPKR(placed.shipping ?? 0)}</strong></div><div className="flex justify-between border-t border-[#edf0f4] pt-3 font-bold"><span>Total</span><span>{formatPKR(placed.total)}</span></div></div>
          </div>
          <div className="flex flex-col justify-between bg-[#f5f8fc] p-4 sm:p-5"><div><h2 className="font-bold text-[#17243a]">What happens next?</h2><p className="mt-2 text-sm leading-6 text-[#647184]">{paymentNote} Keep your phone nearby so the store can confirm delivery.</p></div><div className="mt-5 grid gap-2">{customer ? <Link to="/account" className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-[#244fa7] text-sm font-bold text-white">View your orders<ArrowRight size={15}/></Link> : <Link to="/account" className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-[#244fa7] text-sm font-bold text-white">Create an account to track orders<ArrowRight size={15}/></Link>}<Link to="/collections/all-gear" className="inline-flex h-11 items-center justify-center gap-2 border border-[#d5dce7] bg-white text-sm font-bold text-[#263750]">Continue shopping</Link></div></div>
        </div>
      </div>
    </main>
  }

  if (!products.length) {
    return <main id="top" className="mx-auto min-h-[60vh] max-w-[1120px] px-4 py-10 sm:px-7 sm:py-14 lg:px-10">
      <CheckoutSteps active={isCheckout ? 'checkout' : 'cart'} />
      <div className="mt-8 border border-[#e1e6ed] bg-white px-6 py-14 text-center"><ShoppingBag size={30} className="mx-auto text-[#244fa7]"/><h1 className="mt-4 font-display text-2xl font-bold">Your cart is empty</h1><p className="mt-2 text-sm text-[#647184]">Add something to your cart before continuing to checkout.</p><Link to="/collections/all-gear" className="mt-5 inline-flex h-11 items-center gap-2 rounded-sm bg-[#244fa7] px-5 text-sm font-bold text-white">Browse the catalog<ArrowRight size={15}/></Link></div>
    </main>
  }

  return (
    <main id="top" className="mx-auto min-h-[70vh] max-w-[1320px] px-4 py-8 sm:px-7 sm:py-10 lg:px-10">
      <CheckoutSteps active={isCheckout ? 'checkout' : 'cart'} />
      <div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#e1e6ed] pb-5"><div><p className="section-kicker">{isCheckout ? 'Secure checkout' : 'Your selection'}</p><h1 className="font-display text-3xl font-bold tracking-[-0.04em] text-[#17243a] sm:text-4xl">{isCheckout ? 'Complete your order' : 'Your shopping cart'}</h1><p className="mt-2 text-sm text-[#647184]">{isCheckout ? 'Enter your delivery details and choose how you would like to pay.' : `${itemCount} ${itemCount === 1 ? 'item' : 'items'} ready for checkout.`}</p></div>{!isCheckout && <Link to="/collections/all-gear" className="inline-flex h-10 items-center gap-2 text-sm font-bold text-[#244fa7]"><ArrowLeft size={15}/>Continue shopping</Link>}</div>

      {!isCheckout ? (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <section className="divide-y divide-[#edf0f4] border border-[#e1e6ed] bg-white px-4 sm:px-6" aria-label="Cart items">
            <div className="hidden grid-cols-[1fr_120px_120px] gap-4 border-b border-[#edf0f4] py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#788595] sm:grid"><span>Product</span><span>Quantity</span><span className="text-right">Total</span></div>
            {products.map(product => {
              const maximum = (product.trackStock ?? true) ? Math.min(99, product.stockQuantity ?? 99) : 99
              const quantity = Math.min(quantities[product.slug] ?? 1, Math.max(maximum, 1))
              return <article key={product.slug} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 py-4 sm:grid-cols-[96px_minmax(0,1fr)_120px_120px] sm:items-center sm:gap-4 sm:py-5">
                <Link to={`/products/${product.slug}`} className="grid aspect-square place-items-center overflow-hidden border border-[#edf0f4] bg-[#f7f9fc] p-2"><img src={product.image || PLACEHOLDER_IMAGE} alt={product.imageAlt || product.name} onError={event => { event.currentTarget.src = PLACEHOLDER_IMAGE }} className="size-full object-contain"/></Link>
                <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#788595]">{product.brand} · {product.category}</p><Link to={`/products/${product.slug}`} className="mt-1 block font-semibold leading-5 text-[#17243a] hover:text-[#244fa7]">{product.name}</Link><p className="mt-1 text-xs text-[#748092]">{product.price} each</p><button type="button" onClick={() => onRemove(product.slug)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#8b5660] hover:text-[#bd2f3d]"><X size={13}/>Remove</button></div>
                <div className="col-start-2 row-start-2 inline-flex h-9 w-fit items-center border border-[#d7dee8] bg-white sm:col-start-auto sm:row-start-auto" aria-label={`Quantity for ${product.name}`}><button type="button" onClick={() => onUpdateQuantity(product.slug, quantity - 1)} disabled={quantity <= 1} aria-label="Decrease quantity" className="grid size-8 place-items-center disabled:opacity-35"><Minus size={13}/></button><span className="min-w-8 text-center text-xs font-bold">{quantity}</span><button type="button" onClick={() => onUpdateQuantity(product.slug, quantity + 1)} disabled={quantity >= maximum} aria-label="Increase quantity" className="grid size-8 place-items-center disabled:opacity-35"><Plus size={13}/></button></div>
                <strong className="col-start-2 row-start-2 justify-self-end text-sm text-[#17243a] sm:col-start-auto sm:row-start-auto">{formatPKR(product.priceValue * quantity)}</strong>
              </article>
            })}
          </section>
          <OrderSummaryCard subtotal={subtotal} discount={0} shipping={fallbackShipping} total={subtotal + fallbackShipping} freeShippingThreshold={settings.freeShippingThreshold} checkout={false}/>
        </div>
      ) : (
        <form onSubmit={submitCheckout} className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_370px]">
          <div className="space-y-5">
            <section className="border border-[#e1e6ed] bg-white p-4 sm:p-6"><div className="flex items-center gap-3 border-b border-[#edf0f4] pb-4"><span className="grid size-9 place-items-center rounded-full bg-[#edf3ff] text-[#244fa7]"><UserRound size={17}/></span><div><h2 className="font-display text-lg font-bold text-[#17243a]">Contact information</h2><p className="text-xs text-[#748092]">{customer ? `Signed in as ${customer.email}` : 'We will use these details to confirm your order.'}</p></div></div>{!customer && <p className="mt-4 bg-[#f5f8fc] p-3 text-xs leading-5 text-[#647184]">Checking out as a guest. <Link to="/account" className="font-bold text-[#244fa7]">Sign in or create an account</Link> to track orders and sync your cart.</p>}<div className="mt-4 grid gap-4 sm:grid-cols-2"><FormField label="Full name" required><input required maxLength={160} autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={fieldClass}/></FormField><FormField label="Email address" required><input required type="email" maxLength={255} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={fieldClass}/></FormField><FormField label="Phone number" required><input required maxLength={40} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="03xx xxxxxxx" className={fieldClass}/></FormField></div></section>

            <section className="border border-[#e1e6ed] bg-white p-4 sm:p-6"><div className="flex items-center gap-3 border-b border-[#edf0f4] pb-4"><span className="grid size-9 place-items-center rounded-full bg-[#edf3ff] text-[#244fa7]"><MapPin size={17}/></span><div><h2 className="font-display text-lg font-bold text-[#17243a]">Delivery address</h2><p className="text-xs text-[#748092]">Choose a city to calculate delivery costs.</p></div></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><FormField label="Street address" required className="sm:col-span-2"><textarea required maxLength={1000} autoComplete="street-address" rows={2} value={address} onChange={event => setAddress(event.target.value)} placeholder="House, street, area" className={`${fieldClass} h-auto py-3`}/></FormField><FormField label="City" required><select required autoComplete="address-level2" value={city} onChange={event => { setCity(event.target.value); setCoupon(null) }} className={fieldClass}><option value="">Select a Pakistan city</option>{settings.cities.map(entry => <option key={entry.slug} value={entry.name}>{entry.name} · {formatPKR(entry.fee)} delivery</option>)}</select></FormField><FormField label="Postal code" required><input required maxLength={20} autoComplete="postal-code" value={postalCode} onChange={event => setPostalCode(event.target.value)} placeholder="e.g. 75500" className={fieldClass}/></FormField><FormField label="Delivery instructions" required className="sm:col-span-2"><input required maxLength={500} value={note} onChange={event => setNote(event.target.value)} placeholder="Write ‘No special instructions’ if none" className={fieldClass}/></FormField></div></section>

            <section className="border border-[#e1e6ed] bg-white p-4 sm:p-6"><div className="flex items-center gap-3 border-b border-[#edf0f4] pb-4"><span className="grid size-9 place-items-center rounded-full bg-[#edf3ff] text-[#244fa7]"><CreditCard size={17}/></span><div><h2 className="font-display text-lg font-bold text-[#17243a]">Payment method</h2><p className="text-xs text-[#748092]">{checkoutNote}</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{PAYMENT_METHODS.map(method => { const Icon = method.icon; return <label key={method.value} className={`flex cursor-pointer items-start gap-3 border p-4 transition ${paymentMethod === method.value ? 'border-[#244fa7] bg-[#f4f7fd]' : 'border-[#e1e6ed] hover:border-[#aebed8]'}`}><input type="radio" name="payment-method" value={method.value} checked={paymentMethod === method.value} onChange={() => setPaymentMethod(method.value)} className="mt-1 accent-[#244fa7]"/><Icon size={17} className="mt-0.5 shrink-0 text-[#244fa7]"/><span><span className="block text-sm font-bold text-[#17243a]">{method.label}</span><span className="mt-1 block text-xs leading-5 text-[#748092]">{method.detail}</span></span></label>})}</div></section>
            {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          </div>
          <div className="space-y-4 lg:sticky lg:top-36"><OrderSummaryCard subtotal={subtotal} discount={discount} shipping={shipping} total={total} freeShippingThreshold={settings.freeShippingThreshold} checkout couponCode={couponCode} onCouponCodeChange={value => setCouponCode(value.toUpperCase())} onApplyCoupon={applyCoupon} couponBusy={couponBusy} couponError={couponError} coupon={coupon}/><section className="border border-[#e1e6ed] bg-white p-4"><h2 className="font-bold text-[#17243a]">In your order</h2><ul className="mt-3 divide-y divide-[#edf0f4]">{products.map(product => <li key={product.slug} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><img src={product.image || PLACEHOLDER_IMAGE} alt="" onError={event => { event.currentTarget.src = PLACEHOLDER_IMAGE }} className="size-12 border border-[#edf0f4] bg-[#f7f9fc] object-contain p-1"/><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#17243a]">{product.name}</span><span className="text-[10px] text-[#748092]">Qty {quantities[product.slug] ?? 0}</span></span><strong className="text-xs">{formatPKR(product.priceValue * (quantities[product.slug] ?? 0))}</strong></li>)}</ul><div className="mt-4 border-t border-[#edf0f4] pt-4"><p className="flex items-center gap-2 text-[11px] leading-5 text-[#647184]"><ShieldCheck size={15} className="shrink-0 text-[#32804a]"/>Your details are used only to process and confirm this order.</p><button disabled={busy || !products.length} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#244fa7] px-4 text-sm font-bold text-white transition hover:bg-[#173d88] disabled:cursor-not-allowed disabled:bg-[#a7afba]">{busy ? 'Placing order…' : `Place order · ${formatPKR(total)}`}<ArrowRight size={16}/></button><Link to="/cart" className="mt-3 flex items-center justify-center gap-1 text-xs font-semibold text-[#647184] hover:text-[#244fa7]"><ArrowLeft size={13}/>Return to cart</Link></div></section></div>
        </form>
      )}
    </main>
  )
}

function CheckoutSteps({ active }: { active: 'cart' | 'checkout' }) {
  return <nav aria-label="Checkout progress" className="flex items-center gap-2 text-xs font-semibold"><Link to="/cart" aria-current={active === 'cart' ? 'step' : undefined} className={`inline-flex items-center gap-2 ${active === 'cart' ? 'text-[#244fa7]' : 'text-[#738093]'}`}><span className={`grid size-6 place-items-center rounded-full ${active === 'cart' ? 'bg-[#244fa7] text-white' : 'bg-[#e8edf4] text-[#526174]'}`}>1</span>Cart</Link><ChevronRight size={14} className="text-[#aab3c0]"/><span aria-current={active === 'checkout' ? 'step' : undefined} className={`inline-flex items-center gap-2 ${active === 'checkout' ? 'text-[#244fa7]' : 'text-[#738093]'}`}><span className={`grid size-6 place-items-center rounded-full ${active === 'checkout' ? 'bg-[#244fa7] text-white' : 'bg-[#e8edf4] text-[#526174]'}`}>2</span>Checkout</span></nav>
}

function OrderSummaryCard({ subtotal, discount, shipping, total, freeShippingThreshold, checkout, couponCode = '', onCouponCodeChange, onApplyCoupon, couponBusy = false, couponError = '', coupon }: {
  subtotal: number; discount: number; shipping: number; total: number; freeShippingThreshold: number; checkout: boolean
  couponCode?: string; onCouponCodeChange?: (value: string) => void; onApplyCoupon?: () => void; couponBusy?: boolean; couponError?: string; coupon?: CouponPreview | null
}) {
  return <section className="border border-[#e1e6ed] bg-white p-4 sm:p-5" aria-label="Order summary"><h2 className="font-display text-lg font-bold text-[#17243a]">Order summary</h2>
    {checkout && <div className="mt-4 border-b border-[#edf0f4] pb-4"><label htmlFor="coupon-code" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#566579]"><TicketPercent size={14}/>Discount code</label><div className="mt-2 flex gap-2"><input id="coupon-code" value={couponCode} onChange={event => onCouponCodeChange?.(event.target.value)} placeholder="Enter code" className="h-10 min-w-0 flex-1 border border-[#d7dee8] px-3 text-sm uppercase outline-none focus:border-[#244fa7]"/><button type="button" onClick={onApplyCoupon} disabled={couponBusy || !couponCode.trim()} className="h-10 bg-[#eef3fb] px-3 text-xs font-bold text-[#244fa7] disabled:opacity-50">{couponBusy ? '…' : 'Apply'}</button></div>{coupon && coupon.subtotal === subtotal && <p className="mt-2 text-xs font-semibold text-[#32804a]">{coupon.code} applied — save {formatPKR(coupon.discountAmount)}.</p>}{couponError && <p role="alert" className="mt-2 text-xs text-red-700">{couponError}</p>}</div>}
    <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-[#748092]">Subtotal</span><strong>{formatPKR(subtotal)}</strong></div>{discount > 0 && <div className="flex justify-between text-[#32804a]"><span>Discount</span><strong>− {formatPKR(discount)}</strong></div>}<div className="flex justify-between"><span className="text-[#748092]">Delivery</span><strong>{shipping === 0 ? 'Free' : checkout ? formatPKR(shipping) : `From ${formatPKR(shipping)}`}</strong></div><div className="flex justify-between border-t border-[#edf0f4] pt-3 font-display text-lg font-bold text-[#17243a]"><span>{checkout ? 'Total' : 'Estimated total'}</span><span>{formatPKR(total)}</span></div></div>
    {freeShippingThreshold > 0 && subtotal < freeShippingThreshold && <p className="mt-3 border-l-2 border-[#315ee8] bg-[#f5f8fc] px-3 py-2 text-xs leading-5 text-[#647184]">Add {formatPKR(freeShippingThreshold - subtotal)} more for free delivery.</p>}
    {!checkout && <Link to="/checkout" className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#244fa7] text-sm font-bold text-white transition hover:bg-[#173d88]">Proceed to checkout<ArrowRight size={16}/></Link>}
    <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-[#788595]"><ShieldCheck size={13} className="text-[#32804a]"/>Secure checkout · Nationwide delivery</div>
  </section>
}

function FormField({ label, required, className = '', children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block text-xs font-bold text-[#39485d] ${className}`}>{label}{required && <span className="ml-1 text-red-700">*</span>}{children}</label>
}

const fieldClass = 'mt-1.5 h-11 w-full border border-[#d7dee8] bg-white px-3 text-sm font-normal text-[#17243a] outline-none focus:border-[#244fa7]'

function paymentLabel(method: string) {
  return method === 'bank_transfer_manual' ? 'Bank transfer' : 'Cash on delivery'
}

export default CartPage
