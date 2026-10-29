import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, Download, Eye, Globe, ImagePlus, LayoutDashboard, LogOut, PackagePlus, PenLine, Plus, Search, Settings as SettingsIcon, ShieldCheck, Trash2, Truck, X } from 'lucide-react'
import { blankProductContent, type Product, type ProductContent } from '../catalog'
import { DEFAULT_LANDING_CONTENT } from '../content'
import { apiUrl, formatPKR, type AdminCoupon, type AdminSettings, type Category, type CategoryField, type ContentRevision, type DashboardStats, type MediaFile, type OrderSummary } from '../api'

interface Props { products: Product[]; onProductsChange: (products: Product[]) => void }
type Section = 'overview' | 'catalog' | 'orders' | 'content' | 'seo' | 'settings'
type Draft = {
  slug: string; name: string; category: string; brand: string; price: string; compareAtPrice: string; badge: string
  detail: string; description: string; image: string; imageAlt: string; stockQuantity: string
  active: boolean; trackStock: boolean; specifications: Array<{ label: string; value: string }>
  seoTitle: string; seoDescription: string; seoKeywords: string; ogTitle: string; ogDescription: string; ogImage: string; canonicalUrl: string
}
const emptyDraft: Draft = {
  slug: '', name: '', category: 'Graphics Cards', brand: '', price: '', compareAtPrice: '', badge: '', detail: '',
  description: '', image: '', imageAlt: '', stockQuantity: '0', active: true, trackStock: true, specifications: [{ label: '', value: '' }],
  seoTitle: '', seoDescription: '', seoKeywords: '', ogTitle: '', ogDescription: '', ogImage: '', canonicalUrl: '',
}
const orderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
const paymentStatuses = ['unpaid', 'pending', 'paid', 'due_on_delivery', 'refunded']

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status}).`)
  return data as T
}

function AdminPage({ products, onProductsChange }: Props) {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState<Section>('overview')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All types')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [categoryFields, setCategoryFields] = useState<CategoryField[]>([])
  const [availableCategories, setAvailableCategories] = useState<Category[]>([])
  const categories = ['All types', ...Array.from(new Set(products.map(product => product.category))).sort()]
  const matchingProducts = useMemo(() => products.filter(product =>
    (categoryFilter === 'All types' || product.category === categoryFilter) &&
    `${product.name} ${product.category} ${product.brand}`.toLowerCase().includes(query.toLowerCase())), [products, query, categoryFilter])

  useEffect(() => {
    fetch(`${apiUrl}/api/admin/session`, { credentials: 'include' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (data?.authenticated) { setAuthenticated(true); setEmail(data.email) } })
      .catch(() => setError('Flask API is unavailable. Start the backend, then try signing in again.'))
  }, [])

  useEffect(() => {
    if (!authenticated) return
    adminFetch<Category[]>('/api/admin/categories').then(setAvailableCategories).catch(() => undefined)
    async function loadServerCatalog() {
      try {
        const catalog = await adminFetch<{ initialized: boolean; products: Product[] }>('/api/catalog')
        if (!catalog.initialized) throw new Error('Catalog is not initialized. Run `flask --app app seed-catalog` in the backend folder.')
        onProductsChange(catalog.products)
      } catch (cause) { setError(cause instanceof Error && cause.message ? cause.message : 'Could not sync the catalog with Flask. Check that the backend is running.') }
    }
    void loadServerCatalog()
  }, [authenticated, onProductsChange])

  useEffect(() => {
    if (!formOpen) return
    adminFetch<CategoryField[]>(`/api/admin/category-fields?category=${encodeURIComponent(draft.category)}`)
      .then(setCategoryFields)
      .catch(() => setCategoryFields([]))
  }, [formOpen, draft.category])

  async function login(event: FormEvent) {
    event.preventDefault()
    try {
      const data = await adminFetch<{ email: string }>('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setAuthenticated(true); setEmail(data.email); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed.') }
  }

  function openCreate() { setEditing(null); setDraft({ ...emptyDraft, specifications: [{ label: '', value: '' }] }); setError(''); setFormOpen(true) }
  function openEdit(product: Product) {
    setEditing(product)
    setDraft({
      slug: product.slug, name: product.name, category: product.category, brand: product.brand,
      price: String(product.priceValue), compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
      badge: product.badge, detail: product.detail,
      description: product.description, image: product.image, imageAlt: product.imageAlt,
      stockQuantity: String(product.stockQuantity ?? 0), active: product.active ?? true, trackStock: product.trackStock ?? true,
      seoTitle: product.seo?.title ?? '', seoDescription: product.seo?.description ?? '', seoKeywords: product.seo?.keywords ?? '',
      ogTitle: product.seo?.ogTitle ?? '', ogDescription: product.seo?.ogDescription ?? '', ogImage: product.seo?.ogImage ?? '',
      canonicalUrl: product.seo?.canonicalUrl ?? '',
      specifications: product.specifications.length ? product.specifications.map(specification => {
        const separator = specification.indexOf(':')
        return separator > 0
          ? { label: specification.slice(0, separator).trim(), value: specification.slice(separator + 1).trim() }
          : { label: '', value: specification }
      }) : [{ label: '', value: '' }],
    })
    setError('')
    setFormOpen(true)
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    const priceValue = Number(draft.price)
    const slug = draft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const stockQuantity = Number(draft.stockQuantity)
    const compareAtPrice = draft.compareAtPrice.trim() === '' ? null : Number(draft.compareAtPrice)
    const specifications = draft.specifications
      .filter(specification => specification.label.trim() || specification.value.trim())
      .map(specification => specification.label.trim() ? `${specification.label.trim()}: ${specification.value.trim()}` : specification.value.trim())
    if (!draft.name.trim() || !availableCategories.some(category => category.name === draft.category) || !draft.brand.trim() || !Number.isInteger(priceValue) || priceValue < 1 || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setError('Choose an existing category and enter a product name, brand, whole-number price, and valid stock quantity.')
      return
    }
    if (compareAtPrice !== null && (!Number.isInteger(compareAtPrice) || compareAtPrice < 1)) {
      setError('Compare-at price must be a positive whole number or blank.')
      return
    }
    if (!slug || slug.length > 180) { setError('Enter a valid product URL slug (letters, numbers, and hyphens).'); return }
    if (draft.description.length > 5000 || specifications.some(specification => specification.length > 300) || specifications.length > 100) {
      setError('Description must be under 5,000 characters and each of up to 100 specifications under 300 characters.')
      return
    }
    const product: Product = {
      slug, name: draft.name.trim(), category: draft.category.trim(), brand: draft.brand.trim(),
      detail: draft.detail.trim(), description: draft.description.trim(), specifications,
      price: `Rs. ${priceValue.toLocaleString('en-PK')}`, priceValue, compareAtPrice, trackStock: draft.trackStock,
      badge: draft.badge.trim(),
      image: draft.image.trim(), imageAlt: draft.imageAlt.trim() || draft.name.trim(), stockQuantity, active: draft.active,
    }
    setSaving(true)
    try {
      const saved = await adminFetch<Product>(editing ? `/api/admin/products/${editing.slug}` : '/api/admin/products', { method: editing ? 'PUT' : 'POST', body: JSON.stringify({
        ...product,
        seoTitle: draft.seoTitle.trim(), seoDescription: draft.seoDescription.trim(), seoKeywords: draft.seoKeywords.trim(),
        ogTitle: draft.ogTitle.trim(), ogDescription: draft.ogDescription.trim(), ogImage: draft.ogImage.trim(),
        canonicalUrl: draft.canonicalUrl.trim(),
      }) })
      onProductsChange(editing ? products.map(item => item.slug === editing.slug ? saved : item) : [saved, ...products])
      setFormOpen(false); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Product was not saved.') }
    finally { setSaving(false) }
  }

  async function restockProduct(product: Product) {
    const answer = window.prompt(`How many units of ${product.name} should be added?`, '1')
    if (answer === null || answer.trim() === '') return
    const amount = Number(answer)
    if (!Number.isInteger(amount) || amount < 1 || amount + (product.stockQuantity ?? 0) > 1_000_000) { setError('Enter a whole number that keeps stock at or below 1,000,000.'); return }
    const stockQuantity = (product.stockQuantity ?? 0) + amount
    try {
      const saved = await adminFetch<Product>(`/api/admin/products/${product.slug}`, { method: 'PUT', body: JSON.stringify({ stockQuantity }) })
      onProductsChange(products.map(item => item.slug === product.slug ? saved : item)); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Inventory was not changed.') }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return
    try {
      await adminFetch(`/api/admin/products/${product.slug}`, { method: 'DELETE' })
      onProductsChange(products.filter(item => item.slug !== product.slug))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete product.') }
  }

  if (!authenticated) return <main className="grid min-h-[70vh] place-items-center px-4 py-16"><form onSubmit={login} className="w-full max-w-md border border-[#dfe4dc] bg-white p-8 shadow-sm">
    <div className="mb-5 grid h-12 w-12 place-items-center bg-[#e5eaff] text-[#315ee8]"><ShieldCheck /></div><p className="section-kicker">Restricted area</p><h1 className="font-display text-3xl font-bold">Admin sign in</h1><p className="mt-2 text-sm text-[#68736c]">Store staff only. Sign in to manage the catalog, orders, and landing content.</p>
    <label className="mt-6 block text-sm font-semibold" htmlFor="admin-email">Admin email</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 h-11 w-full border border-[#cfd6ce] px-3 outline-none focus:border-[#315ee8]" /><label className="mt-4 block text-sm font-semibold" htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 h-11 w-full border border-[#cfd6ce] px-3 outline-none focus:border-[#315ee8]" />
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button className="mt-5 h-11 w-full bg-[#142c24] font-semibold text-white hover:bg-[#315ee8]">Sign in</button><button type="button" onClick={() => navigate('/')} className="mt-4 w-full text-sm text-[#68736c]">Back to store</button>
  </form></main>

  const sectionMeta: Record<Section, { title: string; note: string }> = {
    overview: { title: 'Overview', note: 'A quick look at your catalog, orders, and inventory.' },
    catalog: { title: 'Products', note: 'Manage products, prices, page content, and available stock.' },
    orders: { title: 'Orders', note: 'Confirm, ship, and track customer orders.' },
    content: { title: 'Landing content', note: 'Edit the homepage, then publish when it looks right.' },
    seo: { title: 'SEO', note: 'Rank higher on Google: titles, previews, analytics, and per-product search settings.' },
    settings: { title: 'Store settings', note: 'Delivery fees, coupons, categories, and media.' },
  }

  return <main className="min-h-[80vh] bg-[#f5f6f2]"><div className="mx-auto flex max-w-[1440px] flex-col md:flex-row">
    <aside className="w-full border-b border-[#dfe4dc] bg-white p-5 md:min-h-[75vh] md:w-64 md:border-b-0 md:border-r"><div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-[#142c24] text-[#c7f464]"><ShieldCheck size={20}/></div><div><strong className="block">Store Admin</strong><span className="text-xs text-[#68736c]">Management console</span></div></div>
      <nav className="flex gap-2 overflow-x-auto md:flex-col">
        <NavButton active={section === 'overview'} onClick={() => setSection('overview')} icon={<LayoutDashboard size={17}/>} label="Overview" />
        <NavButton active={section === 'catalog'} onClick={() => setSection('catalog')} icon={<Boxes size={17}/>} label="Products" />
        <NavButton active={section === 'orders'} onClick={() => setSection('orders')} icon={<ClipboardList size={17}/>} label="Orders" />
        <NavButton active={section === 'content'} onClick={() => setSection('content')} icon={<PenLine size={17}/>} label="Landing content" />
        <NavButton active={section === 'seo'} onClick={() => setSection('seo')} icon={<Globe size={17}/>} label="SEO" />
        <NavButton active={section === 'settings'} onClick={() => setSection('settings')} icon={<SettingsIcon size={17}/>} label="Settings" />
      </nav>
      <button onClick={() => navigate('/')} className="mt-3 hidden px-3 py-3 text-left text-sm text-[#68736c] hover:text-[#315ee8] md:block">← Back to storefront</button>
      <button onClick={async () => { try { await fetch(`${apiUrl}/api/admin/logout`, { method: 'POST', credentials: 'include' }) } finally { setAuthenticated(false); navigate('/admin') } }} className="mt-8 hidden items-center gap-3 px-3 py-3 text-sm text-[#68736c] hover:text-red-700 md:flex"><LogOut size={17}/>Sign out</button>
    </aside>
    <div className="min-w-0 flex-1 p-5 sm:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">Store operations</p><h1 className="font-display text-3xl font-bold">{sectionMeta[section].title}</h1><p className="mt-2 text-sm text-[#68736c]">{sectionMeta[section].note}</p></div>{section === 'catalog' && <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 bg-[#142c24] px-4 text-sm font-semibold text-white hover:bg-[#315ee8]"><PackagePlus size={17}/>Add product</button>}</div>
      {error && authenticated && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {section === 'overview' && <OverviewSection products={products} />}
      {section === 'catalog' && <CatalogSection
        categories={categories} categoryFilter={categoryFilter} onCategoryFilter={setCategoryFilter}
        query={query} onQuery={setQuery} matchingProducts={matchingProducts}
        onEdit={openEdit} onRestock={restockProduct} onDelete={deleteProduct}
        products={products} onProductsChange={onProductsChange} onError={setError}
      />}
      {section === 'orders' && <OrdersSection onError={setError} />}
      {section === 'content' && <ContentSection onError={setError} />}
      {section === 'seo' && <SeoSection products={products} onProductsChange={onProductsChange} onError={setError} />}
      {section === 'settings' && <SettingsSection onError={setError} onCategoriesChange={setAvailableCategories} />}
    </div></div>
    {formOpen && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#15201c]/60 p-2 sm:p-5">
      <div className="mx-auto my-2 max-w-[1440px] overflow-hidden bg-[#f5f6f2] shadow-2xl sm:my-5">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dfe4dc] bg-white px-4 py-3 sm:px-7">
          <div><p className="section-kicker mb-0">Product editor</p><h2 className="font-display text-xl font-bold">{editing ? 'Edit listing' : 'Create a product listing'}</h2></div>
          <button type="button" onClick={() => setFormOpen(false)} aria-label="Close editor" className="grid size-10 place-items-center border border-[#dfe4dc] hover:bg-[#f5f6f2]"><X size={19}/></button>
        </header>

        <form onSubmit={saveProduct} className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <div className="max-h-[calc(100vh-100px)] space-y-5 overflow-y-auto p-4 sm:p-7">
            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="01" title="Product identity" note="Name, brand, category, and the URL used by the storefront." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Product name" required><input required maxLength={240} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value, slug: editing ? draft.slug : slugify(event.target.value) })} className={inputClass}/></Field>
                <Field label="Brand" required><input required maxLength={120} value={draft.brand} onChange={event => setDraft({ ...draft, brand: event.target.value })} className={inputClass}/></Field>
                <Field label="Category" required><select required value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} className={`${inputClass} bg-white`}>{availableCategories.map(category => <option key={category.id} value={category.name}>{category.parentName ? `${category.parentName} / ${category.name}` : category.name}</option>)}</select></Field>
                <Field label="Product URL slug" required hint={editing ? 'The published URL stays the same when editing this listing.' : 'Used in the product page URL.'}><input required readOnly={Boolean(editing)} maxLength={180} pattern="[A-Za-z0-9-]+" value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} className={`${inputClass} read-only:bg-[#f5f6f2] read-only:text-[#68736c]`}/></Field>
                <Field label="Short detail line" hint="Displayed directly below the product name." ><input maxLength={300} value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} placeholder="Example: 16GB GDDR6 · Triple-fan cooling" className={inputClass}/></Field>
                <Field label="Badge" hint="Optional label such as New arrival or Bestseller."><input maxLength={100} value={draft.badge} onChange={event => setDraft({ ...draft, badge: event.target.value })} className={inputClass}/></Field>
              </div>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="02" title="Product description" note="Write a clear overview customers can read before the specifications." />
              <label className="mt-5 block text-sm font-semibold">Description<span className="mt-1 block text-xs font-normal leading-5 text-[#68736c]">Plain text shown above the specifications. Line breaks are kept.</span><textarea maxLength={5000} rows={6} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Describe what this product is, what it is designed for, and what is included. Add only confirmed product information." className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 text-sm font-normal leading-6 outline-none focus:border-[#315ee8]"/></label>
              <p className="mt-1 text-right text-xs text-[#68736c]">{draft.description.length}/5000</p>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><EditorSection number="03" title="Specifications" note="Each row appears in Key specifications and Full specifications."/><button type="button" onClick={() => setDraft({ ...draft, specifications: [...draft.specifications, { label: '', value: '' }] })} className="inline-flex h-9 items-center gap-2 border border-[#cfd6ce] px-3 text-xs font-semibold hover:border-[#315ee8]"><Plus size={14}/>Add row</button></div>
              {categoryFields.length > 0 && <div className="mt-4"><p className="text-xs font-semibold text-[#68736c]">Quick add for {draft.category} <span className="font-normal">(from Settings \u2192 Categories):</span></p><div className="mt-2 flex flex-wrap gap-2">{categoryFields.filter(field => !draft.specifications.some(specification => specification.label.trim().toLowerCase() === field.label.trim().toLowerCase())).map(field => <button key={field.id} type="button" title={field.placeholder ? `Example: ${field.placeholder}` : field.label} onClick={() => setDraft({ ...draft, specifications: [...draft.specifications, { label: field.label, value: '' }] })} className="inline-flex h-8 items-center gap-1.5 border border-[#315ee8]/30 bg-[#e5eaff] px-2.5 text-xs font-semibold text-[#315ee8] hover:border-[#315ee8]"><Plus size={13}/>{field.label}</button>)}</div></div>}
              <div className="mt-5 space-y-3">{draft.specifications.map((specification, index) => <div key={index} className="grid grid-cols-[minmax(95px,.7fr)_minmax(0,1.3fr)_36px] gap-2">
                <input aria-label={`Specification ${index + 1} label`} maxLength={100} value={specification.label} onChange={event => setDraft({ ...draft, specifications: draft.specifications.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} placeholder="Label" className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
                <input aria-label={`Specification ${index + 1} value`} maxLength={300} value={specification.value} onChange={event => setDraft({ ...draft, specifications: draft.specifications.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} placeholder={categoryFields.find(field => field.label.trim().toLowerCase() === specification.label.trim().toLowerCase())?.placeholder || 'Specification value'} className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
                <button type="button" onClick={() => setDraft({ ...draft, specifications: draft.specifications.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove specification ${index + 1}`} className="grid size-9 place-self-center text-[#68736c] hover:text-red-700"><Trash2 size={16}/></button>
              </div>)}</div>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="04" title="Price and inventory" note="Set the selling price, an optional compare-at price, and available quantity." />
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Field label="Price (PKR)" required hint="Whole rupees, no commas or decimals."><input required type="number" min={1} step={1} value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} className={inputClass}/></Field>
                <Field label="Compare-at price" hint="Blank hides the strikethrough."><input type="number" min={1} step={1} value={draft.compareAtPrice} onChange={event => setDraft({ ...draft, compareAtPrice: event.target.value })} className={inputClass}/></Field>
                <Field label="Stock quantity" required hint="How many units you can sell right now."><input required type="number" min={0} max={1000000} step={1} value={draft.stockQuantity} onChange={event => setDraft({ ...draft, stockQuantity: event.target.value })} className={inputClass}/></Field>
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 border border-[#dfe4dc] p-3"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} className="mt-1 accent-[#315ee8]"/><span><span className="block text-sm font-semibold">Publish this listing</span><span className="mt-0.5 block text-xs text-[#68736c]">Turn off to hide this product from the storefront.</span></span></label>
              <label className="mt-3 flex cursor-pointer items-start gap-3 border border-[#dfe4dc] p-3"><input type="checkbox" checked={draft.trackStock} onChange={event => setDraft({ ...draft, trackStock: event.target.checked })} className="mt-1 accent-[#315ee8]"/><span><span className="block text-sm font-semibold">Track inventory</span><span className="mt-0.5 block text-xs text-[#68736c]">Turn off for made-to-order or unlimited items; checkout skips stock checks.</span></span></label>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="05" title="Product image" note="Paste a direct image URL or a /api/media/ upload, plus alternative text." />
              <div className="mt-5 grid gap-4">
                <Field label="Image URL" hint="Paste a direct link or a /api/media/ URL from the media library."><input type="text" maxLength={2000} value={draft.image} onChange={event => setDraft({ ...draft, image: event.target.value })} placeholder="https://example.com/product-image.jpg" className={inputClass}/></Field>
                <Field label="Image alternative text" hint="Describes the image; shown if it cannot load."><input maxLength={300} value={draft.imageAlt} onChange={event => setDraft({ ...draft, imageAlt: event.target.value })} placeholder={draft.name || 'Describe the product image'} className={inputClass}/></Field>
              </div>
            </section>
            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="06" title="Search & social (SEO)" note="How this product appears on Google, WhatsApp, and Facebook. Blank fields fall back to the name, detail, and image above." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="SEO title" hint="Aim for under 60 characters so Google shows it in full."><input maxLength={200} value={draft.seoTitle} onChange={event => setDraft({ ...draft, seoTitle: event.target.value })} placeholder={`${draft.name || 'Product name'} Price in Pakistan | TechnoBaazar`} className={inputClass}/><p className="mt-1 text-right text-xs font-normal text-[#68736c]">{draft.seoTitle.length}/200</p></Field></div>
                <div className="sm:col-span-2"><label className="block text-sm font-semibold">Meta description<span className="mt-1 block text-xs font-normal leading-5 text-[#68736c]">The snippet under the title on Google. Aim for under 155 characters.</span><textarea maxLength={500} rows={3} value={draft.seoDescription} onChange={event => setDraft({ ...draft, seoDescription: event.target.value })} placeholder="Buy this product online in Pakistan at the best price, with nationwide delivery and warranty." className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 text-sm font-normal leading-6 outline-none focus:border-[#315ee8]"/></label><p className="mt-1 text-right text-xs text-[#68736c]">{draft.seoDescription.length}/500</p></div>
                <Field label="Keywords" hint="Comma-separated. A minor ranking factor, still used by some directories."><input maxLength={500} value={draft.seoKeywords} onChange={event => setDraft({ ...draft, seoKeywords: event.target.value })} placeholder="ryzen 5 7600, processor price in pakistan" className={inputClass}/></Field>
                <Field label="Social (OG) title" hint="Blank reuses the SEO title when the link is shared."><input maxLength={200} value={draft.ogTitle} onChange={event => setDraft({ ...draft, ogTitle: event.target.value })} className={inputClass}/></Field>
                <Field label="Social (OG) description" hint="Blank reuses the meta description."><input maxLength={500} value={draft.ogDescription} onChange={event => setDraft({ ...draft, ogDescription: event.target.value })} className={inputClass}/></Field>
                <Field label="Social (OG) image URL" hint="Blank reuses the product image. 1200x630 works best."><input maxLength={2000} value={draft.ogImage} onChange={event => setDraft({ ...draft, ogImage: event.target.value })} placeholder="https://example.com/share-image.jpg" className={inputClass}/></Field>
                <div className="sm:col-span-2"><Field label="Canonical URL" hint="Rarely needed. Only set this when the same product also lives under another URL."><input maxLength={1000} value={draft.canonicalUrl} onChange={event => setDraft({ ...draft, canonicalUrl: event.target.value })} placeholder="https://technobaazar.pk/products/example" className={inputClass}/></Field></div>
              </div>
            </section>
            {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <div className="flex flex-wrap justify-end gap-3 pb-2"><button type="button" onClick={() => setFormOpen(false)} className="h-11 border border-[#cfd6ce] bg-white px-5 text-sm font-semibold">Cancel</button><button disabled={saving} className="h-11 bg-[#142c24] px-6 text-sm font-semibold text-white hover:bg-[#315ee8] disabled:opacity-60">{saving ? 'Saving listing…' : editing ? 'Save changes' : 'Save and publish listing'}</button></div>
          </div>

          <aside className="border-t border-[#dfe4dc] bg-[#eef0eb] p-4 sm:p-7 lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="mb-4 flex items-center justify-between"><div><p className="section-kicker">Live preview</p><h3 className="font-display text-lg font-bold">Store product page</h3></div><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#68736c]"><Eye size={14}/>Preview only</span></div>
            <article className="overflow-hidden border border-[#dfe4dc] bg-white">
              <div className="relative grid min-h-60 place-items-center bg-white p-6 sm:min-h-[340px]">
                {draft.image ? <img src={draft.image} alt={draft.imageAlt || draft.name} className="max-h-[320px] w-full object-contain"/> : <div className="text-center text-[#929b94]"><PackagePlus size={36} className="mx-auto"/><p className="mt-2 text-xs">Product image preview</p></div>}
                {draft.badge && <span className="absolute left-3 top-3 bg-[#c7f464] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider">{draft.badge}</span>}
              </div>
              <div className="border-t border-[#e7eae4] p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#315ee8]">{draft.category || 'Category'} / {draft.brand || 'Brand'}</p>
                <h4 className="mt-2 font-display text-xl font-bold leading-tight">{draft.name || 'Product name'}</h4>
                <p className="mt-2 text-sm font-semibold text-[#455149]">{draft.detail || 'Short product detail'}</p>
                <div className="mt-4 border-y border-[#e2e6df] py-3"><p className="font-display text-2xl font-bold">{Number(draft.price) > 0 ? `Rs. ${Number(draft.price).toLocaleString('en-PK')}` : 'Price'}{Number(draft.compareAtPrice) > Number(draft.price) && <s className="ml-2 align-middle font-sans text-sm font-semibold text-[#9aa29b]">Rs. {Number(draft.compareAtPrice).toLocaleString('en-PK')}</s>}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#347346]"><Truck size={14}/>{Number(draft.stockQuantity) > 0 ? `${draft.stockQuantity} in stock · Nationwide delivery` : 'Currently out of stock'}</p></div>
                <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider">Key specifications</p><dl className="mt-2 space-y-2">{draft.specifications.filter(specification => specification.label.trim() || specification.value.trim()).slice(0, 4).map((specification, index) => <div key={index} className="grid grid-cols-[.7fr_1.3fr] gap-2 border-b border-[#edf0eb] pb-2 text-xs"><dt className="font-semibold text-[#566159]">{specification.label || `Feature ${index + 1}`}</dt><dd className="text-[#68736c]">{specification.value || '—'}</dd></div>)}</dl></div>
                <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wider">Product overview</p><p className="mt-2 line-clamp-5 whitespace-pre-line text-xs leading-5 text-[#68736c]">{draft.description || 'Your product description will appear here.'}</p></div>
              </div>
            </article>
            <p className="mt-3 text-xs leading-5 text-[#68736c]">Changes in this preview are saved to the catalog only after you click the save button.</p>
          </aside>
        </form>
      </div>
    </div>}
  </main>
}

// ---------------------------------------------------------------- overview ---
function OverviewSection({ products }: { products: Product[] }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  useEffect(() => {
    adminFetch<DashboardStats>('/api/admin/dashboard').then(setStats).catch(() => undefined)
  }, [products])
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat title="Products" value={stats?.products ?? products.length} note="Products in your catalog" />
      <Stat title="Units in stock" value={(stats?.unitsInStock ?? products.reduce((sum, product) => sum + (product.stockQuantity ?? 0), 0)).toLocaleString('en-PK')} note="Available inventory" />
      <Stat title="Orders" value={stats?.orders ?? '—'} note={`${stats?.pendingOrders ?? 0} awaiting confirmation`} />
      <Stat title="Revenue" value={stats ? formatPKR(stats.revenue) : '—'} note="Non-cancelled orders" />
    </div>
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      <div className="border border-[#dfe4dc] bg-white p-5">
        <h2 className="font-display text-lg font-bold">Low stock</h2>
        {stats?.lowStock.length ? <ul className="mt-3 divide-y divide-[#edf0eb] text-sm">{stats.lowStock.map(item => <li key={item.slug} className="flex items-center justify-between gap-3 py-2.5"><span className="font-semibold">{item.name}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{item.stockQuantity} left</span></li>)}</ul> : <p className="mt-3 text-sm text-[#68736c]">Inventory looks healthy.</p>}
      </div>
      <div className="border border-[#dfe4dc] bg-white p-5">
        <h2 className="font-display text-lg font-bold">Recent orders</h2>
        {stats?.recentOrders.length ? <ul className="mt-3 divide-y divide-[#edf0eb] text-sm">{stats.recentOrders.map(order => <li key={order.orderNumber} className="flex items-center justify-between gap-3 py-2.5"><span><strong>{order.orderNumber}</strong><span className="ml-2 text-xs capitalize text-[#68736c]">{order.status}</span></span><strong>{formatPKR(order.total)}</strong></li>)}</ul> : <p className="mt-3 text-sm text-[#68736c]">No orders yet.</p>}
      </div>
    </div>
    <p className="mt-5 text-xs text-[#68736c]">Product changes are saved in the Flask database and shown on the storefront.</p>
  </>
}

// ----------------------------------------------------------------- catalog ---
function CatalogSection(props: {
  categories: string[]; categoryFilter: string; onCategoryFilter: (value: string) => void
  query: string; onQuery: (value: string) => void; matchingProducts: Product[]
  onEdit: (product: Product) => void; onRestock: (product: Product) => void; onDelete: (product: Product) => void
  products: Product[]; onProductsChange: (products: Product[]) => void; onError: (message: string) => void
}) {
  const { categories, categoryFilter, onCategoryFilter, query, onQuery, matchingProducts, onEdit, onRestock, onDelete, products, onProductsChange, onError } = props
  const [contentSlug, setContentSlug] = useState<string | null>(null)
  const contentProduct = products.find(product => product.slug === contentSlug) ?? null
  return <>
    <div className="mb-4 flex items-center gap-2 border border-[#dfe4dc] bg-white px-3"><Search size={17} className="text-[#7a857d]"/><input aria-label="Search products" value={query} onChange={event => onQuery(event.target.value)} placeholder="Search name, brand, or category" className="h-11 min-w-0 flex-1 outline-none"/></div>
    <div className="mb-4 flex gap-2 overflow-x-auto pb-2">{categories.map(category => <button key={category} onClick={() => onCategoryFilter(category)} className={`filter-chip ${categoryFilter === category ? 'filter-chip-active' : ''}`}>{category}{category === 'All types' ? '' : ` · ${products.filter(product => product.category === category).length}`}</button>)}</div>
    <div className="overflow-x-auto border border-[#dfe4dc] bg-white"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-[#f7f8f5] text-xs uppercase tracking-wide text-[#68736c]"><tr><th className="p-4">Product</th><th className="p-4">Category</th><th className="p-4">Brand</th><th className="p-4">Price</th><th className="p-4">In stock</th><th className="p-4">Actions</th></tr></thead><tbody>{matchingProducts.map(product => <tr key={product.slug} className="border-t border-[#edf0eb]"><td className="p-4 font-semibold">{product.name}</td><td className="p-4">{product.category}</td><td className="p-4">{product.brand}</td><td className="p-4">{product.price}{product.compareAtPrice != null && product.compareAtPrice > product.priceValue && <s className="ml-2 text-xs font-normal text-[#9aa29b]">{product.compareAt}</s>}</td><td className="p-4"><span className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-xs font-bold ${(product.stockQuantity ?? 0) > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{product.stockQuantity ?? 0}</span></td><td className="whitespace-nowrap p-4"><button onClick={() => void onRestock(product)} className="mr-3 font-semibold text-[#347346]">+ Stock</button><button onClick={() => setContentSlug(product.slug)} className="mr-3 font-semibold text-[#6a4bd0]">Content</button><button onClick={() => onEdit(product)} className="mr-3 font-semibold text-[#315ee8]">Edit</button><button aria-label={`Delete ${product.name}`} onClick={() => void onDelete(product)} className="text-red-700"><Trash2 size={17}/></button></td></tr>)}</tbody></table>{!matchingProducts.length && <p className="p-8 text-center text-sm text-[#68736c]">No matching products.</p>}</div>
    {contentProduct && <ProductContentModal
      product={contentProduct}
      onClose={() => setContentSlug(null)}
      onSaved={(saved) => { onProductsChange(products.map(item => item.slug === saved.slug ? saved : item)); setContentSlug(null) }}
      onError={onError}
    />}
  </>
}

function ProductContentModal({ product, onClose, onSaved, onError }: { product: Product; onClose: () => void; onSaved: (product: Product) => void; onError: (message: string) => void }) {
  const initial: ProductContent = product.content ?? blankProductContent
  const [eyebrow, setEyebrow] = useState(initial.eyebrow)
  const [subtitle, setSubtitle] = useState(initial.subtitle)
  const [size, setSize] = useState(initial.size)
  const [intro, setIntro] = useState(initial.intro)
  const [gallery, setGallery] = useState(initial.gallery.join('\n'))
  const [notes, setNotes] = useState<Array<{ label: string; value: string }>>(initial.notes.length ? initial.notes : [{ label: '', value: '' }])
  const [busy, setBusy] = useState(false)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const saved = await adminFetch<Product>(`/api/admin/products/${product.slug}/content`, {
        method: 'PUT',
        body: JSON.stringify({
          eyebrow, subtitle, size, intro,
          gallery: gallery.split('\n').map(line => line.trim()).filter(Boolean),
          notes: notes.filter(note => note.label.trim() || note.value.trim()),
        }),
      })
      onSaved(saved)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Product content was not saved.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#15201c]/60 p-2 sm:p-5">
    <form onSubmit={save} className="mx-auto my-5 max-w-5xl border border-[#dfe4dc] bg-white p-5 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><p className="section-kicker">Product page blocks</p><h2 className="font-display text-xl font-bold">{product.name}</h2><p className="mt-1 text-xs text-[#68736c]">Extra sections shown on this product&apos;s page. Leave blank to hide.</p></div>
        <button type="button" onClick={onClose} aria-label="Close content editor" className="grid size-10 shrink-0 place-items-center border border-[#dfe4dc] hover:bg-[#f5f6f2]"><X size={19}/></button>
      </div>
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-2">
      <div className="grid gap-4">
        <Field label="Eyebrow" hint="Small kicker above the product name."><input maxLength={200} value={eyebrow} onChange={event => setEyebrow(event.target.value)} placeholder="Staff pick · Limited stock" className={inputClass}/></Field>
        <Field label="Subtitle" hint="Shown under the name instead of the short detail line."><input maxLength={500} value={subtitle} onChange={event => setSubtitle(event.target.value)} className={inputClass}/></Field>
        <Field label="Size / variant label" hint="Example: 1TB · ATX · 27-inch."><input maxLength={100} value={size} onChange={event => setSize(event.target.value)} className={inputClass}/></Field>
        <label className="block text-sm font-semibold">Intro highlight<span className="mt-1 block text-xs font-normal leading-5 text-[#68736c]">Highlighted box at the top of the product overview.</span><textarea maxLength={2000} rows={3} value={intro} onChange={event => setIntro(event.target.value)} placeholder="One or two sentences highlighted at the top of the overview." className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 text-sm font-normal leading-6 outline-none focus:border-[#315ee8]"/></label>
        <label className="block text-sm font-semibold">Gallery URLs <span className="font-normal text-[#9aa29b]">(one per line, up to 8)</span><textarea rows={4} value={gallery} onChange={event => setGallery(event.target.value)} placeholder="https://…/photo-2.jpg" className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 text-sm font-normal leading-6 outline-none focus:border-[#315ee8]"/></label>
        <div>
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Info notes</p><button type="button" onClick={() => setNotes([...notes, { label: '', value: '' }])} className="inline-flex h-9 items-center gap-2 border border-[#cfd6ce] px-3 text-xs font-semibold hover:border-[#315ee8]"><Plus size={14}/>Add row</button></div>
          <div className="mt-3 space-y-2">{notes.map((note, index) => <div key={index} className="grid grid-cols-[minmax(95px,.6fr)_minmax(0,1.4fr)_36px] gap-2">
            <input aria-label={`Note ${index + 1} label`} maxLength={120} value={note.label} onChange={event => setNotes(notes.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="Warranty" className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
            <input aria-label={`Note ${index + 1} value`} maxLength={500} value={note.value} onChange={event => setNotes(notes.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} placeholder="1-year local warranty" className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
            <button type="button" onClick={() => setNotes(notes.filter((_, i) => i !== index))} aria-label={`Remove note ${index + 1}`} className="grid size-9 place-self-center text-[#68736c] hover:text-red-700"><Trash2 size={16}/></button>
          </div>)}</div>
        </div>
      </div>
      <div className="lg:sticky lg:top-5">
        <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-[#68736c]">Live preview</p><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#68736c]"><Eye size={14}/>Preview only</span></div>
        <ProductContentPreview product={product} eyebrow={eyebrow} subtitle={subtitle} size={size} intro={intro} gallery={gallery} notes={notes} />
      </div>
      </div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="h-11 border border-[#cfd6ce] px-5 text-sm font-semibold">Cancel</button><button disabled={busy} className="h-11 bg-[#142c24] px-6 text-sm font-semibold text-white hover:bg-[#315ee8] disabled:opacity-60">{busy ? 'Saving…' : 'Save page content'}</button></div>
    </form>
  </div>
}

function ProductContentPreview({ product, eyebrow, subtitle, size, intro, gallery, notes }: {
  product: Product; eyebrow: string; subtitle: string; size: string; intro: string; gallery: string; notes: Array<{ label: string; value: string }>
}) {
  const images = gallery.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 8)
  const liveNotes = notes.filter(note => note.label.trim() || note.value.trim())
  return <article className="overflow-hidden border border-[#dfe4dc] bg-white text-left">
    <div className="grid min-h-40 place-items-center bg-[#f5f6f2] p-4">
      {product.image ? <img src={product.image} alt={product.imageAlt || product.name} className="max-h-44 w-full object-contain" /> : <p className="text-xs text-[#929b94]">No product image</p>}
    </div>
    <div className="border-t border-[#e7eae4] p-4">
      {eyebrow.trim() && <p className="text-[10px] font-bold uppercase tracking-widest text-[#315ee8]">{eyebrow}</p>}
      <h4 className="mt-1 font-display text-lg font-bold leading-tight">{product.name}</h4>
      <p className="mt-1 text-xs font-semibold text-[#455149]">{subtitle.trim() || product.detail || 'Short detail line'}</p>
      {size.trim() && <p className="mt-2 inline-block bg-[#eef0eb] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#455149]">{size}</p>}
      <p className="mt-2 font-display text-xl font-bold">{product.price}</p>
      {intro.trim() && <p className="mt-3 border-l-2 border-[#c7f464] bg-[#fafbf9] p-2 text-xs leading-5 text-[#455149]">{intro}</p>}
      {images.length > 0 && <div className="mt-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#68736c]">Gallery ({images.length})</p><div className="mt-1.5 grid grid-cols-4 gap-1.5">{images.map((url, index) => <img key={index} src={url} alt="" className="aspect-square w-full border border-[#edf0eb] object-cover" loading="lazy" />)}</div></div>}
      {liveNotes.length > 0 && <dl className="mt-3 space-y-1.5">{liveNotes.map((note, index) => <div key={index} className="grid grid-cols-[.6fr_1.4fr] gap-2 border-b border-[#edf0eb] pb-1.5 text-xs"><dt className="font-semibold text-[#566159]">{note.label || `Note ${index + 1}`}</dt><dd className="text-[#68736c]">{note.value || '\u2014'}</dd></div>)}</dl>}
      {!intro.trim() && !images.length && !liveNotes.length && <p className="mt-3 text-xs text-[#9aa29b]">Fill in the fields to preview this product&apos;s extra page blocks.</p>}
    </div>
  </article>
}

// ------------------------------------------------------------------ orders ---
function OrdersSection({ onError }: { onError: (message: string) => void }) {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function load(targetPage = 1) {
    try {
      const params = new URLSearchParams({ page: String(targetPage), pageSize: '15' })
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      if (paymentStatus) params.set('payment_status', paymentStatus)
      const data = await adminFetch<{ total: number; page: number; orders: OrderSummary[] }>(`/api/admin/orders?${params}`)
      setOrders(data.orders); setTotal(data.total); setPage(data.page); onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not load orders.')
    }
  }

  useEffect(() => { void load(1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function patchOrder(orderNumber: string, patch: Record<string, string>) {
    setBusy(orderNumber)
    try {
      const saved = await adminFetch<OrderSummary>(`/api/admin/orders/${orderNumber}`, { method: 'PATCH', body: JSON.stringify(patch) })
      setOrders(current => current.map(order => order.orderNumber === orderNumber ? saved : order))
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not update the order.')
    } finally {
      setBusy(null)
    }
  }

  async function exportCsv() {
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      if (paymentStatus) params.set('payment_status', paymentStatus)
      const response = await fetch(`${apiUrl}/api/admin/orders/export.csv?${params}`, { credentials: 'include' })
      if (!response.ok) throw new Error('Export failed.')
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'technobaazar-orders.csv'
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not export orders.')
    }
  }

  const pages = Math.max(1, Math.ceil(total / 15))
  return <>
    <form onSubmit={(event) => { event.preventDefault(); void load(1) }} className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_200px_auto]">
      <div className="flex items-center gap-2 border border-[#dfe4dc] bg-white px-3"><Search size={17} className="text-[#7a857d]"/><input aria-label="Search orders" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search order, name, phone, email" className="h-11 min-w-0 flex-1 outline-none"/></div>
      <select title="Filter by order status" aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)} className="h-11 border border-[#dfe4dc] bg-white px-3 text-sm outline-none"><option value="">All statuses</option>{orderStatuses.map(value => <option key={value} value={value}>{value}</option>)}</select>
      <select title="Filter by payment status" aria-label="Filter by payment" value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)} className="h-11 border border-[#dfe4dc] bg-white px-3 text-sm outline-none"><option value="">All payments</option>{paymentStatuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select>
      <div className="flex gap-2">
        <button className="h-11 bg-[#142c24] px-4 text-sm font-semibold text-white hover:bg-[#315ee8]">Search</button>
        <button type="button" onClick={exportCsv} title="Export CSV" className="grid h-11 w-11 place-items-center border border-[#cfd6ce] bg-white hover:border-[#315ee8]"><Download size={17}/></button>
      </div>
    </form>
    <p className="mb-3 text-xs text-[#68736c]">{total} orders · cancelling an order restores its stock automatically.</p>
    <div className="overflow-x-auto border border-[#dfe4dc] bg-white">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-[#f7f8f5] text-xs uppercase tracking-wide text-[#68736c]"><tr><th className="p-4">Order</th><th className="p-4">Customer</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4">Payment</th><th className="p-4">Details</th></tr></thead>
        <tbody>{orders.map(order => <Fragment key={order.orderNumber}>
          <tr className="border-t border-[#edf0eb]">
            <td className="p-4"><strong>{order.orderNumber}</strong><span className="block text-xs font-normal text-[#68736c]">{new Date(order.createdAt).toLocaleString('en-PK')}</span></td>
            <td className="p-4">{order.customerName}<span className="block text-xs font-normal text-[#68736c]">{order.city}</span></td>
            <td className="p-4 font-semibold">{formatPKR(order.total)}</td>
            <td className="p-4"><select aria-label={`Status for ${order.orderNumber}`} disabled={busy === order.orderNumber} value={order.status} onChange={event => void patchOrder(order.orderNumber, { status: event.target.value })} className="h-10 border border-[#dfe4dc] bg-white px-2 text-xs capitalize outline-none">{orderStatuses.map(value => <option key={value} value={value}>{value}</option>)}</select></td>
            <td className="p-4"><select aria-label={`Payment for ${order.orderNumber}`} disabled={busy === order.orderNumber} value={order.paymentStatus} onChange={event => void patchOrder(order.orderNumber, { paymentStatus: event.target.value })} className="h-10 border border-[#dfe4dc] bg-white px-2 text-xs outline-none">{paymentStatuses.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></td>
            <td className="p-4"><button onClick={() => setExpanded(current => current === order.orderNumber ? null : order.orderNumber)} className="text-xs font-semibold text-[#315ee8]">{expanded === order.orderNumber ? 'Hide' : 'View'}</button></td>
          </tr>
          {expanded === order.orderNumber && <tr className="border-t border-[#edf0eb] bg-[#fafbf9]"><td colSpan={6} className="p-4 text-xs leading-6 text-[#566159]">
            <OrderDetail orderNumber={order.orderNumber} />
          </td></tr>}
        </Fragment>)}</tbody>
      </table>
      {!orders.length && <p className="p-8 text-center text-sm text-[#68736c]">No matching orders.</p>}
    </div>
    <div className="mt-4 flex items-center justify-between text-sm">
      <button disabled={page <= 1} onClick={() => void load(page - 1)} className="h-10 border border-[#cfd6ce] bg-white px-4 font-semibold disabled:opacity-40">Previous</button>
      <span className="text-xs text-[#68736c]">Page {page} of {pages}</span>
      <button disabled={page >= pages} onClick={() => void load(page + 1)} className="h-10 border border-[#cfd6ce] bg-white px-4 font-semibold disabled:opacity-40">Next</button>
    </div>
  </>
}

function OrderDetail({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<(OrderSummary & { customerName: string; phone: string; email: string; address: string; city: string; postalCode: string; note: string; subtotal: number; discountAmount: number; shipping: number; couponCode: string }) | null>(null)
  useEffect(() => {
    adminFetch<{ orders: typeof order[] }>(`/api/admin/orders?search=${encodeURIComponent(orderNumber)}&pageSize=1`)
      .then(data => setOrder(data.orders[0] ?? null))
      .catch(() => setOrder(null))
  }, [orderNumber])
  if (!order) return <span>Loading…</span>
  return <div className="grid gap-4 sm:grid-cols-2">
    <div>
      <p className="font-bold uppercase tracking-wider text-[#68736c]">Delivery</p>
      <p className="mt-1">{order.customerName} · {order.phone}{order.email ? ` · ${order.email}` : ''}</p>
      <p>{order.address}{order.city ? `, ${order.city}` : ''}{order.postalCode ? ` ${order.postalCode}` : ''}</p>
      {order.note && <p className="mt-1 italic">Note: {order.note}</p>}
      <p className="mt-1">{order.paymentMethod === 'bank_transfer_manual' ? 'Bank transfer' : 'Cash on delivery'} · {order.paymentStatus.replaceAll('_', ' ')}</p>
    </div>
    <div>
      <p className="font-bold uppercase tracking-wider text-[#68736c]">Items</p>
      <ul className="mt-1">{order.items.map((item, index) => <li key={index}>{item.name} × {item.quantity} — {formatPKR(item.unitPrice * item.quantity)}</li>)}</ul>
      <p className="mt-2">Subtotal {formatPKR(order.subtotal)}{order.discountAmount > 0 ? ` · Discount −${formatPKR(order.discountAmount)} (${order.couponCode})` : ''} · Delivery {order.shipping === 0 ? 'Free' : formatPKR(order.shipping)} · <strong>Total {formatPKR(order.total)}</strong></p>
    </div>
  </div>
}

// ----------------------------------------------------------------- content ---
const CONTENT_GROUPS: Array<{ title: string; note: string; preview?: 'search-snippet'; fields: Array<{ key: string; label: string; multiline?: boolean; hint?: string }> }> = [
  { title: 'Announcement bar', note: 'The strip above the header.', fields: [{ key: 'announcement', label: 'Announcement text', hint: 'One short line, e.g. a sale or delivery promise.' }] },
  {
    title: 'Hero', note: 'The big blue panel on the homepage.',
    fields: [
      { key: 'hero_eyebrow', label: 'Eyebrow badge', hint: 'Small label above the title.' },
      { key: 'hero_title_top', label: 'Title, first line', hint: 'Dark text, e.g. the main headline.' },
      { key: 'hero_title_bottom', label: 'Title, second line (white)', hint: 'White text on the blue panel.' },
      { key: 'hero_title_accent', label: 'Title accent (lime)', hint: 'Highlighted word or phrase shown in lime.' },
      { key: 'hero_subtitle', label: 'Subtitle', multiline: true, hint: 'One or two sentences under the title.' },
      { key: 'hero_cta_text', label: 'Button text', hint: 'Keep it short, e.g. “Shop now”.' },
      { key: 'hero_cta_url', label: 'Button link (path or URL)', hint: 'Where the button goes, e.g. /products or a full https:// link.' },
      { key: 'hero_social_proof', label: 'Social proof line', hint: 'Trust line under the button, e.g. ratings or order count.' },
      { key: 'hero_image', label: 'Hero image URL', hint: 'Paste an image address or a /api/media/ URL from the library below.' },
      { key: 'hero_image_alt', label: 'Hero image alt text', hint: 'Short description for screen readers and SEO.' },
      { key: 'hero_card_kicker', label: 'Overlay card kicker', hint: 'Small label on the floating card.' },
      { key: 'hero_card_title', label: 'Overlay card title', hint: 'Main line on the floating card.' },
      { key: 'hero_badge', label: 'Corner badge', hint: 'Ribbon on the hero corner, e.g. “New”.' },
    ],
  },
  {
    title: 'Header & footer', note: 'Brand text, search boxes, and footer links.',
    fields: [
      { key: 'header_brand_prefix', label: 'Brand name, first part (blue)', hint: 'Shown before the accent word, e.g. “Techno”.' },
      { key: 'header_brand_accent', label: 'Brand name, accent part (lime)', hint: 'Shown after the first part, e.g. “Baazar”.' },
      { key: 'header_tagline', label: 'Header tagline', hint: 'Small line under the brand in the header and menu.' },
      { key: 'header_search_placeholder', label: 'Desktop search hint', hint: 'Grey hint inside the desktop search box.' },
      { key: 'header_mobile_search_placeholder', label: 'Mobile search hint', hint: 'Grey hint inside the mobile search box.' },
      { key: 'header_about_text', label: '“About” link text', hint: 'Rename the About link in the menu if you need to.' },
      { key: 'footer_brand_text', label: 'Footer brand line', hint: 'Bold brand line at the top of the footer.' },
      { key: 'footer_home_text', label: 'Footer “Home” label', hint: 'Rename the Home link in the footer.' },
      { key: 'footer_admin_text', label: 'Footer “Admin” label', hint: 'Rename the staff sign-in link in the footer.' },
      { key: 'footer_tagline', label: 'Footer tagline', hint: 'One line under the footer brand.' },
    ],
  },
  {
    title: 'Homepage sections', note: 'Headings for the department and product sections.',
    fields: [
      { key: 'departments_kicker', label: 'Departments kicker', hint: 'Small label above the departments heading.' },
      { key: 'departments_title', label: 'Departments title', hint: 'Main heading above the category tiles.' },
      { key: 'featured_kicker', label: 'Products kicker', hint: 'Small label above the products heading.' },
      { key: 'featured_title', label: 'Products title', hint: 'Main heading above the product grid.' },
      { key: 'featured_subtitle', label: 'Products subtitle', multiline: true, hint: 'Supporting line under the products heading.' },
    ],
  },
  {
    title: 'Checkout & footer', note: 'Notes shown during checkout and in the footer.',
    fields: [
      { key: 'checkout_note', label: 'Checkout note', multiline: true, hint: 'Reminder shown on the checkout page.' },
      { key: 'delivery_note', label: 'Delivery note', hint: 'Delivery promise shown near checkout.' },
      { key: 'payment_note', label: 'Payment note', multiline: true, hint: 'Explains the accepted payment methods.' },
      { key: 'order_confirmation_note', label: 'Order confirmation note', multiline: true, hint: 'Shown after an order is placed.' },
    ],
  },
]

function ContentSection({ onError }: { onError: (message: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [benefits, setBenefits] = useState<Array<{ title: string; detail: string }>>([])
  const [hasDraft, setHasDraft] = useState(false)
  const [note, setNote] = useState('')
  const [history, setHistory] = useState<ContentRevision[]>([])
  const [busy, setBusy] = useState('')

  async function load() {
    try {
      const data = await adminFetch<Record<string, unknown>>('/api/admin/site-content')
      const next: Record<string, string> = {}
      for (const group of CONTENT_GROUPS) for (const field of group.fields) {
        next[field.key] = typeof data[field.key] === 'string' ? (data[field.key] as string) : ''
      }
      setValues(next)
      try {
        const parsed = JSON.parse(typeof data.benefits === 'string' ? data.benefits : '[]')
        setBenefits(Array.isArray(parsed) && parsed.length ? parsed : [{ title: '', detail: '' }])
      } catch { setBenefits([{ title: '', detail: '' }]) }
      setHasDraft(data._has_draft === true)
      setHistory(await adminFetch<ContentRevision[]>('/api/admin/site-content/history'))
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not load landing content.')
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveDraft() {
    setBusy('draft')
    try {
      await adminFetch('/api/admin/site-content', { method: 'PUT', body: JSON.stringify({ values: { ...values, benefits: JSON.stringify(benefits.filter(benefit => benefit.title.trim() || benefit.detail.trim())) }, note }) })
      setNote('')
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Draft was not saved.')
    } finally {
      setBusy('')
    }
  }

  async function publish() {
    setBusy('publish')
    try {
      await adminFetch('/api/admin/site-content/publish', { method: 'POST' })
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Content was not published.')
    } finally {
      setBusy('')
    }
  }

  async function discard() {
    if (!window.confirm('Discard the unpublished draft?')) return
    setBusy('discard')
    try {
      await adminFetch('/api/admin/site-content/discard', { method: 'POST' })
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Draft was not discarded.')
    } finally {
      setBusy('')
    }
  }

  async function restore(revisionId: number) {
    setBusy(`restore-${revisionId}`)
    try {
      await adminFetch(`/api/admin/site-content/history/${revisionId}/restore`, { method: 'POST' })
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Revision was not restored.')
    } finally {
      setBusy('')
    }
  }

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
    <div className="space-y-5">
      {hasDraft && <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You have unpublished changes. Publish to show them on the storefront.</p>}
      {CONTENT_GROUPS.map(group => <section key={group.title} className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">{group.title}</h2>
        <p className="mt-1 text-xs text-[#68736c]">{group.note}</p>
        <div className="mt-4 grid gap-4">
          {group.fields.map(field => field.multiline
            ? <label key={field.key} className="block text-sm font-semibold">{field.label}<textarea rows={2} value={values[field.key] ?? ''} onChange={event => setValues({ ...values, [field.key]: event.target.value })} className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 text-sm font-normal leading-6 outline-none focus:border-[#315ee8]"/>{field.hint && <span className="mt-1 block text-xs font-normal leading-5 text-[#68736c]">{field.hint}</span>}</label>
            : <Field key={field.key} label={field.label} hint={field.hint}><input value={values[field.key] ?? ''} onChange={event => setValues({ ...values, [field.key]: event.target.value })} className={inputClass}/></Field>)}
        </div>
        {group.preview === 'search-snippet' && <SearchSnippetPreview values={values} />}
      </section>)}
      <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold">Shopping benefits</h2><p className="mt-1 text-xs text-[#68736c]">Up to 6 rows under the product grid.</p></div>
          <button type="button" onClick={() => benefits.length < 6 && setBenefits([...benefits, { title: '', detail: '' }])} className="inline-flex h-9 items-center gap-2 border border-[#cfd6ce] px-3 text-xs font-semibold hover:border-[#315ee8]"><Plus size={14}/>Add row</button>
        </div>
        <div className="mt-4 space-y-2">{benefits.map((benefit, index) => <div key={index} className="grid grid-cols-[minmax(120px,.7fr)_minmax(0,1.3fr)_36px] gap-2">
          <input aria-label={`Benefit ${index + 1} title`} maxLength={80} value={benefit.title} onChange={event => setBenefits(benefits.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} placeholder="Title" className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
          <input aria-label={`Benefit ${index + 1} detail`} maxLength={200} value={benefit.detail} onChange={event => setBenefits(benefits.map((item, i) => i === index ? { ...item, detail: event.target.value } : item))} placeholder="Detail" className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
          <button type="button" onClick={() => setBenefits(benefits.filter((_, i) => i !== index))} aria-label={`Remove benefit ${index + 1}`} className="grid size-9 place-self-center text-[#68736c] hover:text-red-700"><Trash2 size={16}/></button>
        </div>)}</div>
      </section>
      <div className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <Field label="Revision note" hint="Optional note stored with this draft."><input maxLength={240} value={note} onChange={event => setNote(event.target.value)} placeholder="Summer hero refresh" className={inputClass}/></Field>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={saveDraft} disabled={busy !== ''} className="h-11 bg-[#142c24] px-5 text-sm font-semibold text-white hover:bg-[#315ee8] disabled:opacity-60">{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
          <button onClick={publish} disabled={busy !== '' || !hasDraft} className="h-11 bg-[#c7f464] px-5 text-sm font-semibold text-[#142c24] disabled:opacity-60">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button>
          <button onClick={discard} disabled={busy !== '' || !hasDraft} className="h-11 border border-[#cfd6ce] px-5 text-sm font-semibold disabled:opacity-60">{busy === 'discard' ? 'Discarding…' : 'Discard draft'}</button>
        </div>
      </div>
      <MediaSection onError={onError} />
    </div>
    <aside className="space-y-5 xl:sticky xl:top-5">
      <div className="border border-[#dfe4dc] bg-white p-5">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-lg font-bold">Live preview</h2><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#68736c]"><Eye size={14}/>Preview only</span></div>
        <p className="mb-3 text-xs leading-5 text-[#68736c]">Updates as you type. Publish to show it on the storefront.</p>
        <LandingPreview values={values} benefits={benefits} />
      </div>
      <div className="border border-[#dfe4dc] bg-white p-5">
      <h2 className="font-display text-lg font-bold">Revision history</h2>
      <ul className="mt-3 space-y-2">{history.map(revision => <li key={revision.id} className="border border-[#edf0eb] p-3 text-xs leading-5">
        <p><strong>#{revision.id}</strong> <span className={`ml-1 rounded-full px-2 py-0.5 font-bold ${revision.status === 'published' ? 'bg-green-50 text-green-800' : revision.status === 'draft' ? 'bg-amber-50 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>{revision.status}</span></p>
        <p className="mt-1 text-[#68736c]">{revision.editor} · {new Date(revision.createdAt).toLocaleString('en-PK')}</p>
        {revision.note && <p className="mt-0.5 italic">{revision.note}</p>}
        <button onClick={() => void restore(revision.id)} disabled={busy !== ''} className="mt-1.5 font-semibold text-[#315ee8] disabled:opacity-50">{busy === `restore-${revision.id}` ? 'Restoring…' : 'Restore as draft'}</button>
      </li>)}</ul>
      {!history.length && <p className="mt-3 text-sm text-[#68736c]">No revisions yet.</p>}
      </div>
    </aside>
  </div>
}

function SearchSnippetPreview({ values }: { values: Record<string, string> }) {
  const title = (values.seo_site_title ?? '').trim() || DEFAULT_LANDING_CONTENT.seo_site_title
  const description = (values.seo_site_description ?? '').trim() || DEFAULT_LANDING_CONTENT.seo_site_description
  const base = (values.seo_canonical_base ?? '').trim().replace(/\/$/, '') || 'technobaazar.pk'
  return <div className="mt-4 border border-[#dfe4dc] bg-[#fafbf9] p-4">
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#68736c]">Google result preview</p>
    <p className="truncate text-xs text-[#455149]">{base}</p>
    <p className="mt-0.5 line-clamp-1 text-base text-[#1a0dab]">{title}</p>
    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#545454]">{description}</p>
  </div>
}

function LandingPreview({ values, benefits }: { values: Record<string, string>; benefits: Array<{ title: string; detail: string }> }) {
  const text = (key: string) => {
    const current = (values[key] ?? '').trim()
    if (current) return current
    const fallback = (DEFAULT_LANDING_CONTENT as unknown as Record<string, string>)[key]
    return typeof fallback === 'string' ? fallback : ''
  }
  const liveBenefits = benefits.filter(benefit => benefit.title.trim() || benefit.detail.trim())
  return <div className="overflow-hidden border border-[#dfe4dc] text-left">
    <p className="bg-[#142c24] px-3 py-1.5 text-center text-[10px] font-semibold text-white">{text('announcement')}</p>
    <div className="flex items-center justify-between gap-2 bg-white px-3 py-2">
      <p className="shrink-0 text-xs font-bold"><span className="text-[#315ee8]">{text('header_brand_prefix')}</span><span className="text-[#6aa84f]">{text('header_brand_accent')}</span></p>
      <span className="truncate rounded-full border border-[#cfd6ce] px-2 py-0.5 text-[10px] text-[#9aa29b]">{text('header_search_placeholder')}</span>
    </div>
    <div className="bg-[#315ee8] px-3 py-4 text-white">
      <p className="inline-block bg-[#c7f464] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#142c24]">{text('hero_eyebrow')}</p>
      <p className="mt-2 text-sm font-bold leading-snug">{text('hero_title_top')} {text('hero_title_bottom')} <span className="text-[#c7f464]">{text('hero_title_accent')}</span></p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-white/85">{text('hero_subtitle')}</p>
      <span className="mt-2 inline-block bg-white px-2 py-1 text-[10px] font-bold text-[#142c24]">{text('hero_cta_text')}</span>
      <p className="mt-1.5 text-[9px] text-white/75">{text('hero_social_proof')}</p>
    </div>
    <div className="bg-[#f5f6f2] px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#315ee8]">{text('departments_kicker')}</p>
      <p className="text-xs font-bold">{text('departments_title')}</p>
      <div className="mt-2 grid grid-cols-4 gap-1.5">{['GPUs', 'CPUs', 'Boards', 'RAM'].map(tile => <span key={tile} className="bg-white px-1 py-2 text-center text-[9px] font-semibold text-[#68736c]">{tile}</span>)}</div>
      <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-[#315ee8]">{text('featured_kicker')}</p>
      <p className="text-xs font-bold">{text('featured_title')}</p>
      <p className="line-clamp-2 text-[10px] leading-4 text-[#68736c]">{text('featured_subtitle')}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">{[1, 2, 3].map(card => <span key={card} className="bg-white px-1 py-3 text-center text-[9px] text-[#9aa29b]">Product</span>)}</div>
      {liveBenefits.length > 0 && <ul className="mt-2 space-y-1">{liveBenefits.slice(0, 3).map((benefit, index) => <li key={index} className="bg-white px-2 py-1.5 text-[10px]"><strong>{benefit.title || 'Benefit'}</strong>{benefit.detail ? ` \u2014 ${benefit.detail}` : ''}</li>)}</ul>}
    </div>
    <div className="bg-[#142c24] px-3 py-3 text-white">
      <p className="text-[11px] font-bold">{text('footer_brand_text')}</p>
      <p className="text-[9px] text-white/75">{text('footer_tagline')}</p>
      <p className="mt-1 text-[9px] text-white/75">{text('footer_home_text')} \u00b7 {text('footer_admin_text')}</p>
    </div>
  </div>
}

const SEO_KEYS = [
  'seo_site_title', 'seo_site_description', 'seo_site_keywords', 'seo_canonical_base',
  'seo_og_image', 'seo_twitter_handle', 'seo_facebook_url', 'seo_instagram_url', 'seo_youtube_url',
  'seo_google_verification', 'seo_bing_verification', 'seo_ga_measurement_id', 'seo_gtm_id', 'seo_meta_pixel_id',
  'seo_org_name', 'seo_org_phone', 'seo_org_address', 'seo_robots_txt',
  'seo_about_title', 'seo_about_description', 'seo_cart_title', 'seo_cart_description',
  'seo_favorites_title', 'seo_favorites_description', 'seo_account_title', 'seo_account_description',
]

function SeoSection({ products, onProductsChange, onError }: { products: Product[]; onProductsChange: (products: Product[]) => void; onError: (message: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [hasDraft, setHasDraft] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const set = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }))

  async function load() {
    try {
      const data = await adminFetch<Record<string, unknown>>('/api/admin/site-content')
      const next: Record<string, string> = {}
      for (const key of SEO_KEYS) next[key] = typeof data[key] === 'string' ? (data[key] as string) : ''
      setValues(next)
      setHasDraft(data._has_draft === true)
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not load SEO settings.')
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveDraft() {
    setBusy('draft')
    try {
      await adminFetch('/api/admin/site-content', { method: 'PUT', body: JSON.stringify({ values, note }) })
      setNote('')
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Draft was not saved.')
    } finally {
      setBusy('')
    }
  }

  async function publish() {
    setBusy('publish')
    try {
      await adminFetch('/api/admin/site-content/publish', { method: 'POST' })
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'SEO settings were not published.')
    } finally {
      setBusy('')
    }
  }

  async function discard() {
    if (!window.confirm('Discard the unpublished draft?')) return
    setBusy('discard')
    try {
      await adminFetch('/api/admin/site-content/discard', { method: 'POST' })
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Draft was not discarded.')
    } finally {
      setBusy('')
    }
  }

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
    <div className="space-y-5">
      {hasDraft && <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">You have unpublished changes. Publish to apply them to the live store.</p>}
      <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">General</h2>
        <p className="mt-1 text-xs text-[#68736c]">The homepage title and description that Google shows.</p>
        <div className="mt-4 grid gap-4">
          <Field label="Site title" hint="Browser tab and Google title. Aim for under 60 characters."><input maxLength={200} value={values.seo_site_title ?? ''} onChange={event => set('seo_site_title', event.target.value)} placeholder="TechnoBaazar — Computer Store in Pakistan" className={inputClass}/><p className="mt-1 text-right text-xs font-normal text-[#68736c]">{(values.seo_site_title ?? '').length}/200</p></Field>
          <label className="block text-sm font-semibold">Site description<span className="mt-1 block text-xs font-normal leading-5 text-[#68736c]">Google snippet for the homepage. Aim for under 155 characters.</span><textarea maxLength={500} rows={3} value={values.seo_site_description ?? ''} onChange={event => set('seo_site_description', event.target.value)} className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 text-sm font-normal leading-6 outline-none focus:border-[#315ee8]"/></label>
          <Field label="Site keywords" hint="Comma-separated. A minor ranking factor, still used by some directories."><input maxLength={500} value={values.seo_site_keywords ?? ''} onChange={event => set('seo_site_keywords', event.target.value)} className={inputClass}/></Field>
          <Field label="Canonical base URL" hint="Your live domain, e.g. https://technobaazar.pk. Builds canonical links and the sitemap; blank disables them."><input maxLength={500} value={values.seo_canonical_base ?? ''} onChange={event => set('seo_canonical_base', event.target.value)} placeholder="https://technobaazar.pk" className={inputClass}/></Field>
        </div>
        <GoogleSnippetPreview base={values.seo_canonical_base ?? ''} title={values.seo_site_title ?? ''} description={values.seo_site_description ?? ''} />
      </section>

      <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Social sharing</h2>
        <p className="mt-1 text-xs text-[#68736c]">How store links look on WhatsApp, Facebook, and X.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Social share image URL" hint="1200x630 works best."><input maxLength={2000} value={values.seo_og_image ?? ''} onChange={event => set('seo_og_image', event.target.value)} className={inputClass}/></Field></div>
          <Field label="X (Twitter) handle" hint="e.g. @technobaazar."><input maxLength={60} value={values.seo_twitter_handle ?? ''} onChange={event => set('seo_twitter_handle', event.target.value)} placeholder="@technobaazar" className={inputClass}/></Field>
          <Field label="Facebook page URL" hint="Full link to your page."><input maxLength={500} value={values.seo_facebook_url ?? ''} onChange={event => set('seo_facebook_url', event.target.value)} placeholder="https://facebook.com/…" className={inputClass}/></Field>
          <Field label="Instagram URL" hint="Full link to your profile."><input maxLength={500} value={values.seo_instagram_url ?? ''} onChange={event => set('seo_instagram_url', event.target.value)} placeholder="https://instagram.com/…" className={inputClass}/></Field>
          <Field label="YouTube URL" hint="Full link to your channel."><input maxLength={500} value={values.seo_youtube_url ?? ''} onChange={event => set('seo_youtube_url', event.target.value)} placeholder="https://youtube.com/…" className={inputClass}/></Field>
        </div>
        <SocialCardPreview title={values.seo_site_title ?? ''} description={values.seo_site_description ?? ''} image={values.seo_og_image ?? ''} base={values.seo_canonical_base ?? ''} />
      </section>

      <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Search Console & analytics</h2>
        <p className="mt-1 text-xs text-[#68736c]">Verify ownership and measure traffic. Leave blank to skip.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Google verification code" hint="From Search Console → Settings → Verification. Just the code, not the full tag."><input maxLength={200} value={values.seo_google_verification ?? ''} onChange={event => set('seo_google_verification', event.target.value)} className={inputClass}/></Field>
          <Field label="Bing verification code" hint="From Bing Webmaster Tools → verification meta tag content."><input maxLength={200} value={values.seo_bing_verification ?? ''} onChange={event => set('seo_bing_verification', event.target.value)} className={inputClass}/></Field>
          <Field label="GA4 measurement ID" hint="Looks like G-XXXXXXXXXX. Loads Google Analytics on every page."><input maxLength={30} value={values.seo_ga_measurement_id ?? ''} onChange={event => set('seo_ga_measurement_id', event.target.value)} placeholder="G-XXXXXXXXXX" className={inputClass}/></Field>
          <Field label="Tag Manager ID" hint="Looks like GTM-XXXXXXX. Skip if you already use GA above."><input maxLength={30} value={values.seo_gtm_id ?? ''} onChange={event => set('seo_gtm_id', event.target.value)} placeholder="GTM-XXXXXXX" className={inputClass}/></Field>
          <div className="sm:col-span-2"><Field label="Meta Pixel ID" hint="Numbers only. Tracks visitors for Facebook/Instagram ads."><input maxLength={30} value={values.seo_meta_pixel_id ?? ''} onChange={event => set('seo_meta_pixel_id', event.target.value)} placeholder="1234567890" className={inputClass}/></Field></div>
        </div>
      </section>

      <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Business info</h2>
        <p className="mt-1 text-xs text-[#68736c]">Powers the Google knowledge panel (JSON-LD structured data).</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Business name" hint="Shown as the organization behind the store."><input maxLength={120} value={values.seo_org_name ?? ''} onChange={event => set('seo_org_name', event.target.value)} className={inputClass}/></Field>
          <Field label="Phone" hint="e.g. +92 300 1234567."><input maxLength={60} value={values.seo_org_phone ?? ''} onChange={event => set('seo_org_phone', event.target.value)} placeholder="+92 300 1234567" className={inputClass}/></Field>
          <div className="sm:col-span-2"><Field label="Address" hint="Shop or office address shown to Google."><input maxLength={300} value={values.seo_org_address ?? ''} onChange={event => set('seo_org_address', event.target.value)} placeholder="Shop 12, Tech Plaza, Karachi" className={inputClass}/></Field></div>
        </div>
        <JsonLdPreview orgName={values.seo_org_name ?? ''} phone={values.seo_org_phone ?? ''} address={values.seo_org_address ?? ''} base={values.seo_canonical_base ?? ''} facebook={values.seo_facebook_url ?? ''} instagram={values.seo_instagram_url ?? ''} youtube={values.seo_youtube_url ?? ''} />
      </section>

      <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Crawl control</h2>
        <p className="mt-1 text-xs text-[#68736c]">Tell search engines which pages to index. The sitemap builds itself from your catalog.</p>
        <label className="mt-4 block text-sm font-semibold">robots.txt<span className="mt-1 block text-xs font-normal leading-5 text-[#68736c]">One rule per line. The sitemap URL is appended automatically.</span><textarea maxLength={4000} rows={6} value={values.seo_robots_txt ?? ''} onChange={event => set('seo_robots_txt', event.target.value)} spellCheck={false} className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 font-mono text-xs font-normal leading-6 outline-none focus:border-[#315ee8]"/></label>
        <p className="mt-3 text-xs leading-6 text-[#68736c]">Live files: <a href={`${apiUrl}/robots.txt`} target="_blank" rel="noreferrer" className="font-semibold text-[#315ee8]">robots.txt</a> · <a href={`${apiUrl}/sitemap.xml`} target="_blank" rel="noreferrer" className="font-semibold text-[#315ee8]">sitemap.xml</a> ({products.length} products indexed).</p>
      </section>

      <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold">Page titles</h2>
        <p className="mt-1 text-xs text-[#68736c]">Overrides for store pages. Blank pages fall back to the site title and description.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="About — title"><input maxLength={200} value={values.seo_about_title ?? ''} onChange={event => set('seo_about_title', event.target.value)} placeholder="About | TechnoBaazar" className={inputClass}/></Field>
          <Field label="About — description"><input maxLength={500} value={values.seo_about_description ?? ''} onChange={event => set('seo_about_description', event.target.value)} className={inputClass}/></Field>
          <Field label="Cart — title"><input maxLength={200} value={values.seo_cart_title ?? ''} onChange={event => set('seo_cart_title', event.target.value)} placeholder="Cart | TechnoBaazar" className={inputClass}/></Field>
          <Field label="Cart — description"><input maxLength={500} value={values.seo_cart_description ?? ''} onChange={event => set('seo_cart_description', event.target.value)} className={inputClass}/></Field>
          <Field label="Favorites — title"><input maxLength={200} value={values.seo_favorites_title ?? ''} onChange={event => set('seo_favorites_title', event.target.value)} placeholder="Favorites | TechnoBaazar" className={inputClass}/></Field>
          <Field label="Favorites — description"><input maxLength={500} value={values.seo_favorites_description ?? ''} onChange={event => set('seo_favorites_description', event.target.value)} className={inputClass}/></Field>
          <Field label="Account — title"><input maxLength={200} value={values.seo_account_title ?? ''} onChange={event => set('seo_account_title', event.target.value)} placeholder="Account | TechnoBaazar" className={inputClass}/></Field>
          <Field label="Account — description"><input maxLength={500} value={values.seo_account_description ?? ''} onChange={event => set('seo_account_description', event.target.value)} className={inputClass}/></Field>
        </div>
      </section>

      <ProductSeoList products={products} onProductsChange={onProductsChange} onError={onError} />

      <div className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
        <Field label="Revision note" hint="Optional note stored with this draft."><input maxLength={240} value={note} onChange={event => setNote(event.target.value)} placeholder="SEO tuning for winter sale" className={inputClass}/></Field>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={saveDraft} disabled={busy !== ''} className="h-11 bg-[#142c24] px-5 text-sm font-semibold text-white hover:bg-[#315ee8] disabled:opacity-60">{busy === 'draft' ? 'Saving…' : 'Save draft'}</button>
          <button onClick={publish} disabled={busy !== '' || !hasDraft} className="h-11 bg-[#c7f464] px-5 text-sm font-semibold text-[#142c24] disabled:opacity-60">{busy === 'publish' ? 'Publishing…' : 'Publish'}</button>
          <button onClick={discard} disabled={busy !== '' || !hasDraft} className="h-11 border border-[#cfd6ce] px-5 text-sm font-semibold disabled:opacity-60">{busy === 'discard' ? 'Discarding…' : 'Discard draft'}</button>
        </div>
      </div>
    </div>
    <aside className="space-y-5 xl:sticky xl:top-5">
      <div className="border border-[#dfe4dc] bg-white p-5">
        <h2 className="font-display text-lg font-bold">SEO health</h2>
        <SeoHealth products={products} values={values} />
      </div>
      <div className="border border-[#dfe4dc] bg-white p-5">
        <h2 className="font-display text-lg font-bold">How it works</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-[#68736c]">
          <li>Titles and descriptions update the browser tab, Google results, and link previews.</li>
          <li>Blank product fields fall back to the product name, detail, and image automatically.</li>
          <li>robots.txt and sitemap.xml are served live from these settings — submit the sitemap in Search Console after publishing.</li>
          <li>Changes go live only after you press Publish.</li>
        </ul>
      </div>
    </aside>
  </div>
}

function GoogleSnippetPreview({ base, title, description }: { base: string; title: string; description: string }) {
  const host = base.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'technobaazar.pk'
  return <div className="mt-4 border border-[#dfe4dc] bg-[#fafbf9] p-4">
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#68736c]">Google result preview</p>
    <p className="truncate text-xs text-[#455149]">{host}</p>
    <p className="mt-0.5 line-clamp-1 text-base text-[#1a0dab]">{title.trim() || DEFAULT_LANDING_CONTENT.seo_site_title}</p>
    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#545454]">{description.trim() || DEFAULT_LANDING_CONTENT.seo_site_description}</p>
  </div>
}

function SocialCardPreview({ title, description, image, base }: { title: string; description: string; image: string; base: string }) {
  const host = base.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'technobaazar.pk'
  return <div className="mt-4 border border-[#dfe4dc] bg-[#fafbf9] p-4">
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#68736c]">Link preview (WhatsApp / Facebook / X)</p>
    <div className="overflow-hidden border border-[#dfe4dc] bg-white">
      {image.trim() ? <img src={image.trim()} alt="" className="aspect-[1.91/1] w-full object-cover" loading="lazy" /> : <div className="grid aspect-[1.91/1] w-full place-items-center bg-[#eef0eb] text-xs text-[#929b94]">No share image</div>}
      <div className="border-t border-[#edf0eb] p-3">
        <p className="text-[11px] uppercase tracking-wide text-[#68736c]">{host}</p>
        <p className="mt-0.5 line-clamp-1 text-sm font-bold">{title.trim() || DEFAULT_LANDING_CONTENT.seo_site_title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#68736c]">{description.trim() || DEFAULT_LANDING_CONTENT.seo_site_description}</p>
      </div>
    </div>
  </div>
}

function JsonLdPreview({ orgName, phone, address, base, facebook, instagram, youtube }: { orgName: string; phone: string; address: string; base: string; facebook: string; instagram: string; youtube: string }) {
  const sameAs = [facebook, instagram, youtube].map(url => url.trim()).filter(Boolean)
  const schema = {
    '@context': 'https://schema.org', '@type': 'Organization', name: orgName.trim() || 'TechnoBaazar',
    ...(base.trim() ? { url: base.trim() } : {}),
    ...(phone.trim() ? { telephone: phone.trim() } : {}),
    ...(address.trim() ? { address: { '@type': 'PostalAddress', streetAddress: address.trim() } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }
  return <div className="mt-4 border border-[#dfe4dc] bg-[#fafbf9] p-4">
    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#68736c]">Structured data preview (JSON-LD)</p>
    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#455149]">{JSON.stringify(schema, null, 2)}</pre>
  </div>
}

function SeoHealth({ products, values }: { products: Product[]; values: Record<string, string> }) {
  const withTitle = products.filter(product => (product.seo?.title ?? '').trim()).length
  const withDescription = products.filter(product => (product.seo?.description ?? '').trim()).length
  const withKeywords = products.filter(product => (product.seo?.keywords ?? '').trim()).length
  const checks = [
    { label: 'Site title set', done: (values.seo_site_title ?? '').trim().length > 0 },
    { label: 'Site description set', done: (values.seo_site_description ?? '').trim().length > 0 },
    { label: 'Canonical domain set', done: (values.seo_canonical_base ?? '').trim().length > 0 },
    { label: 'Share image set', done: (values.seo_og_image ?? '').trim().length > 0 },
    { label: 'Google verification', done: (values.seo_google_verification ?? '').trim().length > 0 },
    { label: 'Analytics (GA or GTM)', done: (values.seo_ga_measurement_id ?? '').trim().length > 0 || (values.seo_gtm_id ?? '').trim().length > 0 },
    { label: 'Business phone', done: (values.seo_org_phone ?? '').trim().length > 0 },
  ]
  const bar = (doneCount: number, total: number) => total === 0 ? 0 : Math.round((doneCount / total) * 100)
  return <div className="mt-3 space-y-3 text-xs">
    <ul className="space-y-1.5">{checks.map(check => <li key={check.label} className="flex items-center gap-2"><span className={`grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${check.done ? 'bg-green-100 text-green-800' : 'bg-[#eef0eb] text-[#9aa29b]'}`}>{check.done ? '\u2713' : '!'}</span><span className={check.done ? '' : 'text-[#68736c]'}>{check.label}</span></li>)}</ul>
    <div className="border-t border-[#edf0eb] pt-3">
      <p className="font-bold">Product coverage ({products.length} products)</p>
      {([['Titles', withTitle], ['Descriptions', withDescription], ['Keywords', withKeywords]] as Array<[string, number]>).map(([label, doneCount]) => <div key={label} className="mt-2">
        <div className="flex justify-between text-[#68736c]"><span>{label}</span><span>{doneCount}/{products.length}</span></div>
        <div className="mt-1 h-1.5 bg-[#eef0eb]"><div className="h-1.5 bg-[#315ee8]" style={{ width: `${bar(doneCount, products.length)}%` }} /></div>
      </div>)}
    </div>
  </div>
}

function ProductSeoList({ products, onProductsChange, onError }: { products: Product[]; onProductsChange: (products: Product[]) => void; onError: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const matching = products.filter(product => `${product.name} ${product.category} ${product.brand}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
    <h2 className="font-display text-lg font-bold">Products</h2>
    <p className="mt-1 text-xs text-[#68736c]">Tune each product&apos;s search title, description, and keywords. Changes save immediately.</p>
    <div className="mb-3 mt-4 flex items-center gap-2 border border-[#dfe4dc] px-3"><Search size={17} className="text-[#7a857d]" /><input aria-label="Search products" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search products" className="h-11 min-w-0 flex-1 text-sm outline-none" /></div>
    <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">{matching.map(product => <ProductSeoRow key={product.slug} product={product} open={openSlug === product.slug} onToggle={() => setOpenSlug(openSlug === product.slug ? null : product.slug)} onSaved={(saved) => onProductsChange(products.map(item => item.slug === saved.slug ? saved : item))} onError={onError} />)}</ul>
    {!matching.length && <p className="mt-3 text-sm text-[#68736c]">No matching products.</p>}
  </section>
}

function ProductSeoRow({ product, open, onToggle, onSaved, onError }: { product: Product; open: boolean; onToggle: () => void; onSaved: (product: Product) => void; onError: (message: string) => void }) {
  const seo = product.seo ?? { title: '', description: '', keywords: '', ogTitle: '', ogDescription: '', ogImage: '', canonicalUrl: '' }
  const [title, setTitle] = useState(seo.title)
  const [description, setDescription] = useState(seo.description)
  const [keywords, setKeywords] = useState(seo.keywords)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setTitle(seo.title); setDescription(seo.description); setKeywords(seo.keywords) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const dots: Array<[string, boolean]> = [['Title', seo.title.trim().length > 0], ['Description', seo.description.trim().length > 0], ['Keywords', seo.keywords.trim().length > 0]]

  async function save() {
    setBusy(true)
    try {
      const saved = await adminFetch<Product>(`/api/admin/products/${product.slug}`, { method: 'PUT', body: JSON.stringify({ seoTitle: title.trim(), seoDescription: description.trim(), seoKeywords: keywords.trim() }) })
      onSaved(saved)
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Product SEO was not saved.')
    } finally {
      setBusy(false)
    }
  }

  return <li className="border border-[#edf0eb]">
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left text-sm hover:bg-[#fafbf9]">
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{product.name}</span><span className="text-xs text-[#68736c]">{product.category} · {product.price}</span></span>
      <span className="flex shrink-0 gap-1">{dots.map(([label, done]) => <span key={label} title={done ? `${label} set` : `${label} missing`} className={`size-2.5 rounded-full ${done ? 'bg-green-500' : 'bg-[#dfe4dc]'}`} />)}</span>
    </button>
    {open && <div className="grid gap-3 border-t border-[#edf0eb] bg-[#fafbf9] p-3">
      <Field label="SEO title" hint="Blank falls back to “Name Price in Pakistan | TechnoBaazar”."><input maxLength={200} value={title} onChange={event => setTitle(event.target.value)} className="mt-2 h-10 w-full border border-[#cfd6ce] bg-white px-2.5 text-xs font-normal outline-none focus:border-[#315ee8]" /></Field>
      <Field label="Meta description" hint="Blank falls back to the product detail line."><textarea maxLength={500} rows={2} value={description} onChange={event => setDescription(event.target.value)} className="mt-2 w-full resize-y border border-[#cfd6ce] bg-white p-2.5 text-xs font-normal leading-5 outline-none focus:border-[#315ee8]" /></Field>
      <Field label="Keywords" hint="Comma-separated."><input maxLength={500} value={keywords} onChange={event => setKeywords(event.target.value)} className="mt-2 h-10 w-full border border-[#cfd6ce] bg-white px-2.5 text-xs font-normal outline-none focus:border-[#315ee8]" /></Field>
      <div><button onClick={save} disabled={busy} className="h-10 bg-[#142c24] px-4 text-xs font-semibold text-white hover:bg-[#315ee8] disabled:opacity-60">{busy ? 'Saving…' : 'Save product SEO'}</button></div>
    </div>}
  </li>
}

// ---------------------------------------------------------------- settings ---
function SettingsSection({ onError, onCategoriesChange }: { onError: (message: string) => void; onCategoriesChange: (categories: Category[]) => void }) {
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [deliveryFee, setDeliveryFee] = useState('')
  const [threshold, setThreshold] = useState('')
  const [lowStock, setLowStock] = useState('')
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [couponDraft, setCouponDraft] = useState({ code: '', discountType: 'percent', value: '', minimumSubtotal: '', maxUses: '', active: true })
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryName, setCategoryName] = useState('')
  const [categoryParentId, setCategoryParentId] = useState('')

  async function load() {
    try {
      const data = await adminFetch<AdminSettings>('/api/admin/settings')
      setSettings(data)
      setDeliveryFee(String(data.deliveryFee))
      setThreshold(String(data.freeDeliveryThreshold))
      setLowStock(String(data.lowStockThreshold))
      setCoupons(await adminFetch<AdminCoupon[]>('/api/admin/coupons'))
      setCategories(await adminFetch<Category[]>('/api/admin/categories'))
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not load settings.')
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveNumber(path: string, value: string, label: string) {
    try {
      await adminFetch(path, { method: 'PUT', body: JSON.stringify({ value: Number(value) }) })
      await load()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : `${label} was not saved.`)
    }
  }

  async function saveCityFee(slug: string, fee: number, active: boolean) {
    try {
      const saved = await adminFetch<Category & { fee: number; active: boolean }>(`/api/admin/settings/cities/${slug}`, { method: 'PUT', body: JSON.stringify({ fee, active }) })
      setSettings(current => current ? { ...current, cities: current.cities.map(city => city.slug === slug ? { ...city, fee: saved.fee, active: saved.active } : city) } : current)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'City was not updated.')
    }
  }

  async function saveCoupon(event: FormEvent) {
    event.preventDefault()
    const payload = {
      code: couponDraft.code, discountType: couponDraft.discountType,
      value: Number(couponDraft.value), minimumSubtotal: Number(couponDraft.minimumSubtotal || 0),
      maxUses: couponDraft.maxUses === '' ? null : Number(couponDraft.maxUses), active: couponDraft.active,
    }
    try {
      if (editingCoupon) {
        const saved = await adminFetch<AdminCoupon>(`/api/admin/coupons/${editingCoupon.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        setCoupons(coupons.map(coupon => coupon.id === saved.id ? saved : coupon))
      } else {
        const saved = await adminFetch<AdminCoupon>('/api/admin/coupons', { method: 'POST', body: JSON.stringify(payload) })
        setCoupons([...coupons, saved])
      }
      setCouponDraft({ code: '', discountType: 'percent', value: '', minimumSubtotal: '', maxUses: '', active: true })
      setEditingCoupon(null)
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Coupon was not saved.')
    }
  }

  async function deleteCoupon(coupon: AdminCoupon) {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return
    try {
      await adminFetch(`/api/admin/coupons/${coupon.id}`, { method: 'DELETE' })
      setCoupons(coupons.filter(item => item.id !== coupon.id))
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Coupon was not deleted.')
    }
  }

  async function saveCategory(category: Category, patch: { visible?: boolean; sortOrder?: number }) {
    try {
      const saved = await adminFetch<Category>(`/api/admin/categories/${category.id}`, { method: 'PUT', body: JSON.stringify(patch) })
      const updated = categories.map(item => item.id === saved.id ? saved : item)
      setCategories(updated)
      onCategoriesChange(updated)
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Category was not updated.')
    }
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault()
    try {
      const saved = await adminFetch<Category>('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: categoryName, parentId: categoryParentId ? Number(categoryParentId) : null }),
      })
      const updated = [...categories, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      setCategories(updated)
      onCategoriesChange(updated)
      setCategoryName('')
      setCategoryParentId('')
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Category was not created.')
    }
  }

  return <div className="space-y-5">
    <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">Delivery & inventory</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><Field label="Default delivery fee (PKR)" hint="Charged when the order is below the free-delivery total."><input type="number" min={0} value={deliveryFee} onChange={event => setDeliveryFee(event.target.value)} className={inputClass}/></Field><button onClick={() => void saveNumber('/api/admin/settings/delivery-fee', deliveryFee, 'Delivery fee')} className="mt-2 h-10 border border-[#cfd6ce] px-4 text-xs font-semibold">Save</button></div>
        <div><Field label="Free delivery over (PKR)" hint="0 disables free delivery."><input type="number" min={0} value={threshold} onChange={event => setThreshold(event.target.value)} className={inputClass}/></Field><button onClick={() => void saveNumber('/api/admin/settings/free-delivery-threshold', threshold, 'Threshold')} className="mt-2 h-10 border border-[#cfd6ce] px-4 text-xs font-semibold">Save</button></div>
        <div><Field label="Low-stock alert at" hint="The dashboard warns when stock falls to this number."><input type="number" min={0} value={lowStock} onChange={event => setLowStock(event.target.value)} className={inputClass}/></Field><button onClick={() => void saveNumber('/api/admin/settings/low-stock-threshold', lowStock, 'Threshold')} className="mt-2 h-10 border border-[#cfd6ce] px-4 text-xs font-semibold">Save</button></div>
      </div>
    </section>

    <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">Delivery cities</h2>
      <p className="mt-1 text-xs text-[#68736c]">Checkout suggests these cities; other cities use the default fee.</p>
      <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{settings?.cities.map(city => <CityRow key={city.slug} city={city} onSave={saveCityFee} />)}</div>
    </section>

    <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">Coupons</h2>
      <p className="mt-1 text-xs text-[#68736c]">Fill in every box, then Add. Percent takes % off the subtotal; fixed takes a rupee amount off.</p>
      <form onSubmit={saveCoupon} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_130px_110px_130px_110px_auto]">
        <label className="block text-xs font-semibold text-[#68736c]">Code<input aria-label="Coupon code" required maxLength={40} value={couponDraft.code} onChange={event => setCouponDraft({ ...couponDraft, code: event.target.value.toUpperCase() })} placeholder="SAVE10" className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 text-sm font-normal uppercase outline-none" /></label>
        <label className="block text-xs font-semibold text-[#68736c]">Type<select aria-label="Discount type" value={couponDraft.discountType} onChange={event => setCouponDraft({ ...couponDraft, discountType: event.target.value })} className="mt-1 h-11 w-full border border-[#cfd6ce] bg-white px-2 text-sm font-normal"><option value="percent">Percent %</option><option value="fixed">Fixed Rs.</option></select></label>
        <label className="block text-xs font-semibold text-[#68736c]">Value<input aria-label="Value" required type="number" min={1} value={couponDraft.value} onChange={event => setCouponDraft({ ...couponDraft, value: event.target.value })} placeholder="10" className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 text-sm font-normal outline-none" /></label>
        <label className="block text-xs font-semibold text-[#68736c]">Min. subtotal (Rs.)<input aria-label="Minimum subtotal" type="number" min={0} value={couponDraft.minimumSubtotal} onChange={event => setCouponDraft({ ...couponDraft, minimumSubtotal: event.target.value })} placeholder="0" className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 text-sm font-normal outline-none" /></label>
        <label className="block text-xs font-semibold text-[#68736c]">Max uses (blank = unlimited)<input aria-label="Max uses" type="number" min={1} value={couponDraft.maxUses} onChange={event => setCouponDraft({ ...couponDraft, maxUses: event.target.value })} placeholder="Unlimited" className="mt-1 h-11 w-full border border-[#cfd6ce] px-3 text-sm font-normal outline-none" /></label>
        <div className="flex gap-2">
          <button className="h-11 bg-[#142c24] px-4 text-sm font-semibold text-white">{editingCoupon ? 'Update' : 'Add'}</button>
          {editingCoupon && <button type="button" onClick={() => { setEditingCoupon(null); setCouponDraft({ code: '', discountType: 'percent', value: '', minimumSubtotal: '', maxUses: '', active: true }) }} className="h-11 border border-[#cfd6ce] px-3 text-sm">Cancel</button>}
        </div>
      </form>
      <ul className="mt-4 divide-y divide-[#edf0eb] text-sm">{coupons.map(coupon => <li key={coupon.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
        <span><strong>{coupon.code}</strong><span className="ml-2 text-xs text-[#68736c]">{coupon.discountType === 'percent' ? `${coupon.value}% off` : `${formatPKR(coupon.value)} off`}{coupon.minimumSubtotal > 0 ? ` · min ${formatPKR(coupon.minimumSubtotal)}` : ''} · used {coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ''}{coupon.active ? '' : ' · inactive'}</span></span>
        <span><button onClick={() => { setEditingCoupon(coupon); setCouponDraft({ code: coupon.code, discountType: coupon.discountType, value: String(coupon.value), minimumSubtotal: String(coupon.minimumSubtotal), maxUses: coupon.maxUses == null ? '' : String(coupon.maxUses), active: coupon.active }) }} className="mr-3 font-semibold text-[#315ee8]">Edit</button><button onClick={() => void deleteCoupon(coupon)} className="text-red-700"><Trash2 size={16} /></button></span>
      </li>)}</ul>
      {!coupons.length && <p className="mt-3 text-sm text-[#68736c]">No coupons yet.</p>}
    </section>

    <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
      <h2 className="font-display text-lg font-bold">Categories & custom fields</h2>
      <p className="mt-1 text-xs text-[#68736c]">Add subcategories under a main category. Visibility controls storefront navigation; custom fields remain available in product editing.</p>
      <form onSubmit={createCategory} className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Category name" required><input required maxLength={100} value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="e.g. Refurbished laptops" className={inputClass} /></Field>
        <Field label="Parent category"><select value={categoryParentId} onChange={event => setCategoryParentId(event.target.value)} className={`${inputClass} bg-white`}><option value="">Main category</option>{categories.filter(category => category.parentId === null).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
        <button className="h-11 bg-[#142c24] px-4 text-sm font-semibold text-white hover:bg-[#315ee8]">Add category</button>
      </form>
      <ul className="mt-4 grid items-start gap-2 xl:grid-cols-2">{categories.filter(category => category.parentId === null).map(category => <Fragment key={category.id}><CategoryRow category={category} onToggleVisible={(visible) => void saveCategory(category, { visible })} onError={onError} />{categories.filter(child => child.parentId === category.id).map(child => <CategoryRow key={child.id} category={child} onToggleVisible={(visible) => void saveCategory(child, { visible })} onError={onError} />)}</Fragment>)}</ul>
    </section>
  </div>
}

function CategoryRow({ category, onToggleVisible, onError }: { category: Category; onToggleVisible: (visible: boolean) => void; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false)
  return <li className={`border border-[#edf0eb] text-sm ${category.parentId !== null ? 'ml-5 border-l-2 border-l-[#c7f464]' : ''}`}>
    <div className="flex items-center justify-between gap-3 p-3">
      <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 truncate text-left font-semibold hover:text-[#315ee8]" title="Manage custom fields">{category.parentName ? `${category.parentName} / ` : ''}{category.name}</button>
      <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-xs font-semibold text-[#315ee8]">{open ? 'Hide fields' : 'Custom fields'}</button>
      <label className="flex shrink-0 items-center gap-2 text-xs text-[#68736c]"><input type="checkbox" checked={category.visible} onChange={event => onToggleVisible(event.target.checked)} className="accent-[#315ee8]" /> Visible</label>
    </div>
    {open && <CategoryFieldsManager category={category.name} onError={onError} />}
  </li>
}

function CategoryFieldsManager({ category, onError }: { category: string; onError: (message: string) => void }) {
  const [fields, setFields] = useState<CategoryField[]>([])
  const [label, setLabel] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    adminFetch<CategoryField[]>(`/api/admin/category-fields?category=${encodeURIComponent(category)}`)
      .then(rows => { setFields(rows); setLoaded(true) })
      .catch(() => onError(`Could not load custom fields for ${category}.`))
  }, [category]) // eslint-disable-line react-hooks/exhaustive-deps

  async function add(event: FormEvent) {
    event.preventDefault()
    try {
      const saved = await adminFetch<CategoryField>('/api/admin/category-fields', { method: 'POST', body: JSON.stringify({ category, label, placeholder }) })
      setFields([...fields, saved].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id))
      setLabel(''); setPlaceholder(''); onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Custom field was not added.')
    }
  }

  async function remove(field: CategoryField) {
    if (!window.confirm(`Remove "${field.label}" from ${category}?`)) return
    try {
      await adminFetch(`/api/admin/category-fields/${field.id}`, { method: 'DELETE' })
      setFields(fields.filter(item => item.id !== field.id))
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Custom field was not removed.')
    }
  }

  return <div className="border-t border-[#edf0eb] bg-[#fafbf9] p-3">
    <p className="text-xs leading-5 text-[#68736c]">One-click specification rows for every product in this category. The example value shows as a hint in the editor.</p>
    {!loaded && <p className="mt-2 text-xs text-[#68736c]">Loading\u2026</p>}
    {loaded && !fields.length && <p className="mt-2 text-xs text-[#68736c]">No custom fields yet \u2014 add the first one below.</p>}
    {fields.length > 0 && <ul className="mt-2 space-y-1.5">{fields.map(field => <li key={field.id} className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 text-xs">
      <span className="min-w-0 truncate"><strong>{field.label}</strong>{field.placeholder && <span className="ml-1.5 text-[#9aa29b]">e.g. {field.placeholder}</span>}</span>
      <button type="button" onClick={() => void remove(field)} aria-label={`Remove ${field.label}`} className="shrink-0 text-[#68736c] hover:text-red-700"><Trash2 size={15} /></button>
    </li>)}</ul>}
    <form onSubmit={add} className="mt-2.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <input aria-label={`New field label for ${category}`} required maxLength={120} value={label} onChange={event => setLabel(event.target.value)} placeholder="Label, e.g. Warranty" className="h-10 border border-[#cfd6ce] bg-white px-2.5 text-xs outline-none focus:border-[#315ee8]" />
      <input aria-label={`Example value for ${category}`} maxLength={200} value={placeholder} onChange={event => setPlaceholder(event.target.value)} placeholder="Example value (optional)" className="h-10 border border-[#cfd6ce] bg-white px-2.5 text-xs outline-none focus:border-[#315ee8]" />
      <button className="h-10 bg-[#142c24] px-3 text-xs font-semibold text-white hover:bg-[#315ee8]">Add field</button>
    </form>
  </div>
}

function CityRow({ city, onSave }: { city: { slug: string; name: string; fee: number; active?: boolean }; onSave: (slug: string, fee: number, active: boolean) => void }) {
  const [fee, setFee] = useState(String(city.fee))
  const [active, setActive] = useState(city.active ?? true)
  useEffect(() => { setFee(String(city.fee)); setActive(city.active ?? true) }, [city.fee, city.active])
  return <div className="flex items-center gap-2 border border-[#edf0eb] p-2.5 text-sm">
    <span className="min-w-0 flex-1 truncate font-semibold">{city.name}</span>
    <input aria-label={`Delivery fee for ${city.name}`} type="number" min={0} value={fee} onChange={event => setFee(event.target.value)} className="h-9 w-24 border border-[#cfd6ce] px-2 text-sm outline-none" />
    <label className="flex items-center gap-1 text-xs text-[#68736c]" title="Active"><input type="checkbox" checked={active} onChange={event => { setActive(event.target.checked); onSave(city.slug, Number(fee), event.target.checked) }} className="accent-[#315ee8]" /></label>
    <button onClick={() => onSave(city.slug, Number(fee), active)} className="h-9 border border-[#cfd6ce] px-2.5 text-xs font-semibold">Save</button>
  </div>
}

function MediaSection({ onError }: { onError: (message: string) => void }) {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setFiles(await adminFetch<MediaFile[]>('/api/admin/media'))
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not load media.')
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.set('file', file)
      const response = await fetch(`${apiUrl}/api/admin/uploads`, { method: 'POST', credentials: 'include', body: form })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? 'Upload failed.')
      await load()
      onError('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Upload failed.')
    } finally {
      setBusy(false)
      event.currentTarget.value = ''
    }
  }

  async function remove(filename: string) {
    if (!window.confirm(`Delete ${filename}?`)) return
    try {
      await adminFetch(`/api/admin/media/${filename}`, { method: 'DELETE' })
      setFiles(files.filter(file => file.filename !== filename))
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'File was not deleted.')
    }
  }

  return <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-display text-lg font-bold">Media library</h2><p className="mt-1 text-xs text-[#68736c]">Upload JPG, PNG, WebP, or GIF (max 5 MB). Copy a URL into hero, gallery, or product image fields.</p></div>
      <label className="inline-flex h-11 cursor-pointer items-center gap-2 bg-[#142c24] px-4 text-sm font-semibold text-white hover:bg-[#315ee8]">
        <ImagePlus size={17} /> {busy ? 'Uploading…' : 'Upload image'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} className="hidden" />
      </label>
    </div>
    {files.length ? <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map(file => <li key={file.filename} className="border border-[#edf0eb]">
      <img src={`${apiUrl}${file.url}`} alt={file.filename} className="aspect-square w-full object-cover" loading="lazy" />
      <div className="flex items-center justify-between gap-2 p-2">
        <button onClick={() => void navigator.clipboard?.writeText(`${apiUrl}${file.url}`).catch(() => undefined)} className="truncate text-left text-[11px] font-semibold text-[#315ee8]" title="Copy full URL">Copy URL</button>
        <button onClick={() => void remove(file.filename)} aria-label={`Delete ${file.filename}`} className="text-red-700"><Trash2 size={15} /></button>
      </div>
    </li>)}</ul> : <p className="mt-3 text-sm text-[#68736c]">No uploads yet.</p>}
  </section>
}

const inputClass = 'mt-2 h-11 w-full border border-[#cfd6ce] px-3 text-sm font-normal outline-none focus:border-[#315ee8]'

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex shrink-0 items-center gap-3 px-3 py-3 text-sm font-semibold ${active ? 'bg-[#e5eaff] text-[#315ee8]' : 'text-[#536057] hover:bg-[#f5f6f2]'}`}>{icon}{label}</button>
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold">{label}{required && <span className="ml-1 text-red-700">*</span>}{children}{hint && <span className="mt-1 block text-xs font-normal leading-5 text-[#68736c]">{hint}</span>}</label>
}

function EditorSection({ number, title, note }: { number: string; title: string; note: string }) {
  return <div className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center bg-[#e5eaff] text-[10px] font-bold text-[#315ee8]">{number}</span><div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#68736c]">{note}</p></div></div>
}

function Stat({ title, value, note }: { title: string; value: string | number; note: string }) {
  return <div className="border border-[#dfe4dc] bg-white p-5"><p className="text-sm font-semibold text-[#68736c]">{title}</p><p className="mt-3 font-display text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[#68736c]">{note}</p></div>
}

export default AdminPage
