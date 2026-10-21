import { useState } from 'react'
import { ArrowLeft, ArrowUpRight, Heart, Minus, PackageCheck, Plus, ShoppingBag, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { categorySlug, type Product } from '../catalog'

interface ProductPageProps {
  product: Product
  relatedProducts: Product[]
  favorites: string[]
  isFavorite: boolean
  onAddToCart: (product: Product, quantity?: number) => void
  onToggleFavorite: (productName: string) => void
}

function ProductPage({ product, relatedProducts, favorites, isFavorite, onAddToCart, onToggleFavorite }: ProductPageProps) {
  const stock = product.stockQuantity ?? 0
  const [quantity, setQuantity] = useState(1)
  const inStock = stock > 0
  const specifications = product.specifications.map((specification, index) => {
    const separator = specification.indexOf(':')
    return {
      label: separator > 0 ? specification.slice(0, separator).trim() : inferSpecificationLabel(specification, index),
      value: separator > 0 ? specification.slice(separator + 1).trim() : specification,
    }
  })

  return (
    <main id="top" className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-xs text-[#68736c]">
        <Link to="/" className="hover:text-[#315ee8]">Home</Link><span>/</span>
        <Link to={`/collections/${categorySlug(product.category)}`} className="hover:text-[#315ee8]">{product.category}</Link><span>/</span>
        <span className="line-clamp-1 text-[#15201c]">{product.name}</span>
      </nav>

      <section className="grid gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(400px,.95fr)] lg:gap-12">
        <div className="relative grid min-h-[360px] place-items-center overflow-hidden border border-[#e7eae4] bg-white p-5 sm:min-h-[520px] sm:p-10">
          <img src={product.image} alt={product.imageAlt} className="max-h-[480px] w-full object-contain" />
          {product.badge && <span className="absolute left-4 top-4 bg-[#c7f464] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em]">{product.badge}</span>}
          <button type="button" onClick={() => onToggleFavorite(product.slug)} aria-pressed={isFavorite} aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-[#e7eae4] bg-white text-[#142c24] hover:text-[#e04f48]">
            <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="flex flex-col py-1">
          <p className="section-kicker">{product.category} <span className="px-1 text-[#a5ada6]">/</span> {product.brand}</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight tracking-[-0.045em] sm:text-[2.55rem]">{product.name}</h1>
          <p className="mt-3 text-base font-semibold leading-7 text-[#455149]">{product.detail}</p>

          {specifications.length > 0 && <section className="mt-6" aria-labelledby="key-specifications-title">
            <h2 id="key-specifications-title" className="font-display text-lg font-bold">Key specifications</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2.5">
              {specifications.slice(0, 4).map((specification, index) => <div key={`${specification.label}-${specification.value}`} className="min-h-20 border border-[#dfe4dc] bg-white p-3.5">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#315ee8]">{specification.label || `Feature ${String(index + 1).padStart(2, '0')}`}</dt>
                <dd className="mt-1.5 text-sm font-semibold leading-5 text-[#15201c]">{specification.value}</dd>
              </div>)}
            </dl>
          </section>}

          <div className="mt-6 border-y border-[#e2e6df] py-5">
            <p className="font-display text-3xl font-bold tracking-[-0.04em]">{product.price}</p>
            <p className="mt-2 text-xs text-[#68736c]">Price in Pakistani Rupees. Availability and price are confirmed at checkout.</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <span className={`inline-flex items-center gap-2 font-semibold ${inStock ? 'text-[#347346]' : 'text-[#a33131]'}`}>
              <span className={`size-2 rounded-full ${inStock ? 'bg-[#4c9a62]' : 'bg-[#c74c4c]'}`} />
              {inStock ? 'In stock' : 'Out of stock'}
            </span>
            {inStock && <span className="text-[#68736c]">{stock} available</span>}
            <span className="inline-flex items-center gap-1.5 text-[#68736c]"><Truck size={15} /> Nationwide delivery</span>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <div className="inline-flex h-12 items-center border border-[#cfd6ce] bg-white" aria-label="Quantity">
              <button type="button" disabled={!inStock || quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} aria-label="Decrease quantity" className="grid size-11 place-items-center disabled:opacity-35"><Minus size={15} /></button>
              <span className="min-w-10 text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
              <button type="button" disabled={!inStock || quantity >= Math.min(99, stock)} onClick={() => setQuantity(value => Math.min(Math.min(99, stock), value + 1))} aria-label="Increase quantity" className="grid size-11 place-items-center disabled:opacity-35"><Plus size={15} /></button>
            </div>
            <button type="button" disabled={!inStock} onClick={() => onAddToCart(product, quantity)} className="inline-flex h-12 min-w-48 flex-1 items-center justify-center gap-3 bg-[#142c24] px-5 text-sm font-bold text-white transition hover:bg-[#315ee8] disabled:cursor-not-allowed disabled:bg-[#8c958e] sm:flex-none">
              <ShoppingBag size={17} /> {inStock ? 'Add to bag' : 'Unavailable'}
            </button>
          </div>

          <div className="mt-7 grid gap-3 border-y border-[#e2e6df] py-4 text-xs text-[#566159] sm:grid-cols-2">
            <p className="flex items-center gap-2"><PackageCheck size={16} className="text-[#315ee8]" /> Secure checkout</p>
            <p className="flex items-center gap-2"><Truck size={16} className="text-[#315ee8]" /> Cash on delivery available</p>
          </div>

        </div>
      </section>

      <section className="mt-12 grid gap-8 border-y border-[#dfe4dc] bg-white px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12" aria-label="Product information">
        <div>
          <p className="section-kicker">Product information</p>
          <h2 className="font-display text-2xl font-bold tracking-[-0.04em]">Overview</h2>
          <p className="mt-4 text-sm leading-7 text-[#455149]">{product.description}</p>
          <p className="mt-4 text-xs leading-6 text-[#68736c]">{product.name} by {product.brand}, in {product.category}. Product details shown here are provided by the store.</p>
        </div>
        <div aria-labelledby="specifications-title">
          <p className="section-kicker">At a glance</p>
          <h2 id="specifications-title" className="font-display text-2xl font-bold tracking-[-0.04em]">Full specifications</h2>
          {specifications.length ? <dl className="mt-4 divide-y divide-[#e7eae4] border-y border-[#e7eae4]">
            {specifications.map((specification, index) => <div key={`${specification.label}-${specification.value}`} className="grid grid-cols-[minmax(120px,.7fr)_1.3fr] gap-4 py-3.5 text-sm sm:grid-cols-[minmax(160px,.7fr)_1.3fr]">
              <dt className="font-semibold text-[#455149]">{specification.label || `Feature ${index + 1}`}</dt>
              <dd className="leading-6 text-[#68736c]">{specification.value}</dd>
            </div>)}
          </dl> : <p className="mt-4 border-y border-[#e7eae4] py-5 text-sm text-[#68736c]">Specifications have not been added yet.</p>}
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="mt-16 border-t border-[#dfe4dc] pt-10" aria-labelledby="related-title">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div><p className="section-kicker">Keep exploring</p><h2 id="related-title" className="section-heading">More from {product.category}</h2></div>
            <Link to={`/collections/${categorySlug(product.category)}`} className="inline-flex items-center gap-2 text-xs font-semibold text-[#315ee8]">View collection <ArrowUpRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-5">
            {relatedProducts.map((relatedProduct) => <ProductCard key={relatedProduct.slug} product={relatedProduct} isFavorite={favorites.includes(relatedProduct.slug)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite} />)}
          </div>
        </section>
      )}
      <Link to={`/collections/${categorySlug(product.category)}`} className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-[#315ee8]"><ArrowLeft size={16} /> Back to {product.category}</Link>
    </main>
  )
}

function inferSpecificationLabel(specification: string, index: number) {
  const text = specification.toLowerCase()
  if (/\b(memory|ddr[345]|gddr\d|\d+\s?gb)\b/.test(text)) return 'Memory'
  if (/pci express|pcie/.test(text)) return 'Interface'
  if (/cooling|fan|mesh front/.test(text)) return 'Cooling'
  if (/ray tracing|dlss/.test(text)) return 'Graphics features'
  if (/processor|core ultra|ryzen|\b\d+ cores?\b/.test(text)) return 'Processor'
  if (/battery/.test(text)) return 'Battery life'
  if (/bluetooth|usb-c|wireless|\binput/.test(text)) return 'Connectivity'
  if (/refresh rate|\b\d+hz\b/.test(text)) return 'Refresh rate'
  if (/response time|\b\d+ms\b/.test(text)) return 'Response time'
  if (/display|panel|\d+-inch|\d+ inch|qhd|\bips\b/.test(text)) return 'Display'
  if (/noise cancellation/.test(text)) return 'Noise control'
  if (/layout/.test(text)) return 'Layout'
  if (/switch/.test(text)) return 'Switches'
  if (/form factor|mid-tower|atx support/.test(text)) return 'Form factor'
  if (/sensor|dpi/.test(text)) return 'Sensor'
  if (/weight|\b\d+g\b/.test(text)) return 'Weight'
  if (/watt|\b\d+w\b|power/.test(text)) return 'Power'
  if (/efficien|80 plus/.test(text)) return 'Efficiency'
  if (/socket/.test(text)) return 'Socket'
  if (/chipset/.test(text)) return 'Chipset'
  if (/capacity|\b\d+tb\b/.test(text)) return 'Capacity'
  if (/speed|\d+mt\/s/.test(text)) return 'Speed'
  if (/xmp|expo/.test(text)) return 'Compatibility'
  if (/read|\d+mb\/s/.test(text)) return 'Read speed'
  if (/stereo|audio/.test(text)) return 'Audio'
  if (/glass/.test(text)) return 'Side panel'
  if (/control|volume/.test(text)) return 'Controls'
  return `Feature ${index + 1}`
}

export default ProductPage
