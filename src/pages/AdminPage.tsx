import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Eye, LayoutDashboard, LogOut, PackagePlus, Plus, Search, ShieldCheck, Trash2, Truck, X } from 'lucide-react'
import type { Product } from '../catalog'
import { apiUrl } from '../api'

interface Props { products: Product[]; onProductsChange: (products: Product[]) => void }
type Draft = {
  slug: string; name: string; category: string; brand: string; price: string; badge: string
  detail: string; description: string; image: string; imageAlt: string; stockQuantity: string
  active: boolean; specifications: Array<{ label: string; value: string }>
}
const productCategories = ['Graphics Cards', 'Processors', 'Motherboards', 'Memory', 'Storage', 'Power Supplies', 'Cases & Cooling', 'Laptops', 'Monitors', 'Audio', 'Accessories']
const emptyDraft: Draft = {
  slug: '', name: '', category: 'Graphics Cards', brand: '', price: '', badge: '', detail: '',
  description: '', image: '', imageAlt: '', stockQuantity: '0', active: true, specifications: [{ label: '', value: '' }],
}

function AdminPage({ products, onProductsChange }: Props) {
  const navigate = useNavigate()
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [section, setSection] = useState<'overview' | 'catalog'>('overview')
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All types')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
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
    async function loadServerCatalog() {
      try {
        const response = await fetch(`${apiUrl}/api/catalog`, { credentials: 'include' })
        if (!response.ok) throw new Error()
        const catalog = await response.json() as { initialized: boolean; products: Product[] }
        if (!catalog.initialized) throw new Error('Catalog is not initialized. Run `flask --app app seed-catalog` in the backend folder.')
        onProductsChange(catalog.products)
      } catch (cause) { setError(cause instanceof Error && cause.message ? cause.message : 'Could not sync the catalog with Flask. Check that the backend is running.') }
    }
    void loadServerCatalog()
  }, [authenticated, onProductsChange])

  async function login(event: FormEvent) {
    event.preventDefault()
    try {
      const response = await fetch(`${apiUrl}/api/admin/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await response.json()
      if (!response.ok) { setError(data.error ?? 'Sign-in failed.'); return }
      setAuthenticated(true); setEmail(data.email); setError('')
    } catch { setError('Flask API is unavailable. Start the backend, then try signing in again.') }
  }

  function openCreate() { setEditing(null); setDraft({ ...emptyDraft, specifications: [{ label: '', value: '' }] }); setError(''); setFormOpen(true) }
  function openEdit(product: Product) {
    setEditing(product)
    setDraft({
      slug: product.slug, name: product.name, category: product.category, brand: product.brand,
      price: String(product.priceValue), badge: product.badge, detail: product.detail,
      description: product.description, image: product.image, imageAlt: product.imageAlt,
      stockQuantity: String(product.stockQuantity ?? 0), active: product.active ?? true,
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
    const specifications = draft.specifications
      .filter(specification => specification.label.trim() || specification.value.trim())
      .map(specification => specification.label.trim() ? `${specification.label.trim()}: ${specification.value.trim()}` : specification.value.trim())
    if (!draft.name.trim() || !productCategories.includes(draft.category) || !draft.brand.trim() || !Number.isInteger(priceValue) || priceValue < 1 || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
      setError('Choose an existing category and enter a product name, brand, whole-number price, and valid stock quantity.')
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
      price: `Rs. ${priceValue.toLocaleString('en-PK')}`, priceValue, badge: draft.badge.trim(),
      image: draft.image.trim(), imageAlt: draft.imageAlt.trim() || draft.name.trim(), stockQuantity, active: draft.active,
    }
    setSaving(true)
    try {
      const response = await fetch(editing ? `${apiUrl}/api/admin/products/${editing.slug}` : `${apiUrl}/api/admin/products`, { method: editing ? 'PUT' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product) })
      if (!response.ok) { const data = await response.json(); setError(data.error ?? 'Could not save product.'); return }
      const saved = await response.json() as Product
      onProductsChange(editing ? products.map(item => item.slug === editing.slug ? saved : item) : [saved, ...products])
      setFormOpen(false); setError('')
    } catch { setError('Flask API is unavailable. Product was not saved.') }
    finally { setSaving(false) }
  }

  async function restockProduct(product: Product) {
    const answer = window.prompt(`How many units of ${product.name} should be added?`, '1')
    if (answer === null || answer.trim() === '') return
    const amount = Number(answer)
    if (!Number.isInteger(amount) || amount < 1 || amount + (product.stockQuantity ?? 0) > 1_000_000) { setError('Enter a whole number that keeps stock at or below 1,000,000.'); return }
    const stockQuantity = (product.stockQuantity ?? 0) + amount
    try {
      const response = await fetch(`${apiUrl}/api/admin/products/${product.slug}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stockQuantity }) })
      if (!response.ok) { const data = await response.json(); setError(data.error ?? 'Could not restock product.'); return }
      const saved = await response.json() as Product
      onProductsChange(products.map(item => item.slug === product.slug ? saved : item)); setError('')
    } catch { setError('Flask API is unavailable. Inventory was not changed.') }
  }

  async function deleteProduct(product: Product) {
    try {
      const response = await fetch(`${apiUrl}/api/admin/products/${product.slug}`, { method: 'DELETE', credentials: 'include' })
      if (response.ok) onProductsChange(products.filter(item => item.slug !== product.slug))
      else setError('Could not delete product from Flask.')
    } catch { setError('Flask API is unavailable. Product was not deleted.') }
  }

  if (!authenticated) return <main className="grid min-h-[70vh] place-items-center px-4 py-16"><form onSubmit={login} className="w-full max-w-md border border-[#dfe4dc] bg-white p-8 shadow-sm">
    <div className="mb-5 grid h-12 w-12 place-items-center bg-[#e5eaff] text-[#315ee8]"><ShieldCheck /></div><p className="section-kicker">Restricted area</p><h1 className="font-display text-3xl font-bold">Admin sign in</h1><p className="mt-2 text-sm text-[#68736c]">Store staff only. Sign in to manage the product catalog.</p>
    <label className="mt-6 block text-sm font-semibold" htmlFor="admin-email">Admin email</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 h-11 w-full border border-[#cfd6ce] px-3 outline-none focus:border-[#315ee8]" /><label className="mt-4 block text-sm font-semibold" htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 h-11 w-full border border-[#cfd6ce] px-3 outline-none focus:border-[#315ee8]" />
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button className="mt-5 h-11 w-full bg-[#142c24] font-semibold text-white hover:bg-[#315ee8]">Sign in</button><button type="button" onClick={() => navigate('/')} className="mt-4 w-full text-sm text-[#68736c]">Back to store</button>
  </form></main>

  return <main className="min-h-[80vh] bg-[#f5f6f2]"><div className="mx-auto flex max-w-[1440px] flex-col md:flex-row">
    <aside className="w-full border-b border-[#dfe4dc] bg-white p-5 md:min-h-[75vh] md:w-64 md:border-b-0 md:border-r"><div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-[#142c24] text-[#c7f464]"><ShieldCheck size={20}/></div><div><strong className="block">Store Admin</strong><span className="text-xs text-[#68736c]">Management console</span></div></div>
      <nav className="flex gap-2 md:flex-col"><button onClick={() => setSection('overview')} className={`flex items-center gap-3 px-3 py-3 text-sm font-semibold ${section === 'overview' ? 'bg-[#e5eaff] text-[#315ee8]' : 'text-[#536057] hover:bg-[#f5f6f2]'}`}><LayoutDashboard size={17}/>Overview</button><button onClick={() => setSection('catalog')} className={`flex items-center gap-3 px-3 py-3 text-sm font-semibold ${section === 'catalog' ? 'bg-[#e5eaff] text-[#315ee8]' : 'text-[#536057] hover:bg-[#f5f6f2]'}`}><Boxes size={17}/>Products</button></nav>
      <button onClick={() => navigate('/')} className="mt-3 hidden px-3 py-3 text-left text-sm text-[#68736c] hover:text-[#315ee8] md:block">← Back to storefront</button>
      <button onClick={async () => { try { await fetch(`${apiUrl}/api/admin/logout`, { method: 'POST', credentials: 'include' }) } finally { setAuthenticated(false); navigate('/admin') } }} className="mt-8 hidden items-center gap-3 px-3 py-3 text-sm text-[#68736c] hover:text-red-700 md:flex"><LogOut size={17}/>Sign out</button>
    </aside>
    <div className="min-w-0 flex-1 p-5 sm:p-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">Store operations</p><h1 className="font-display text-3xl font-bold">{section === 'overview' ? 'Overview' : 'Products'}</h1><p className="mt-2 text-sm text-[#68736c]">{section === 'overview' ? 'A quick look at your catalog and inventory.' : 'Manage products, prices, and available stock.'}</p></div>{section === 'catalog' && <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 bg-[#142c24] px-4 text-sm font-semibold text-white hover:bg-[#315ee8]"><PackagePlus size={17}/>Add product</button>}</div>
      {error && authenticated && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {section === 'overview' ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat title="Products" value={products.length} note="Products in your catalog"/><Stat title="Units in stock" value={products.reduce((sum, product) => sum + (product.stockQuantity ?? 0), 0).toLocaleString('en-PK')} note="Available inventory"/><Stat title="Categories" value={new Set(products.map(product => product.category)).size} note="Active product types"/><Stat title="Catalog value" value={`Rs. ${products.reduce((sum, product) => sum + product.priceValue, 0).toLocaleString('en-PK')}`} note="Sum of listed prices"/></div><div className="mt-7 border border-[#dfe4dc] bg-white p-5"><h2 className="font-display text-lg font-bold">Quick actions</h2><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => setSection('catalog')} className="border border-[#cfd6ce] px-4 py-3 text-sm font-semibold hover:border-[#315ee8]">Browse products</button><button onClick={openCreate} className="bg-[#e5f4c6] px-4 py-3 text-sm font-semibold text-[#29441d]">Add a product</button></div></div><p className="mt-5 text-xs text-[#68736c]">Product changes are saved in the Flask database and shown on the storefront.</p></> : <>
        <div className="mb-4 flex items-center gap-2 border border-[#dfe4dc] bg-white px-3"><Search size={17} className="text-[#7a857d]"/><input aria-label="Search products" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, brand, or category" className="h-11 min-w-0 flex-1 outline-none"/></div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">{categories.map(category => <button key={category} onClick={() => setCategoryFilter(category)} className={`filter-chip ${categoryFilter === category ? 'filter-chip-active' : ''}`}>{category}{category === 'All types' ? '' : ` · ${products.filter(product => product.category === category).length}`}</button>)}</div>
        <div className="overflow-x-auto border border-[#dfe4dc] bg-white"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-[#f7f8f5] text-xs uppercase tracking-wide text-[#68736c]"><tr><th className="p-4">Product</th><th className="p-4">Category</th><th className="p-4">Brand</th><th className="p-4">Price</th><th className="p-4">In stock</th><th className="p-4">Actions</th></tr></thead><tbody>{matchingProducts.map(product => <tr key={product.slug} className="border-t border-[#edf0eb]"><td className="p-4 font-semibold">{product.name}</td><td className="p-4">{product.category}</td><td className="p-4">{product.brand}</td><td className="p-4">{product.price}</td><td className="p-4"><span className={`inline-flex min-w-10 justify-center rounded-full px-2.5 py-1 text-xs font-bold ${(product.stockQuantity ?? 0) > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{product.stockQuantity ?? 0}</span></td><td className="p-4"><button onClick={() => void restockProduct(product)} className="mr-3 font-semibold text-[#347346]">+ Stock</button><button onClick={() => openEdit(product)} className="mr-3 font-semibold text-[#315ee8]">Edit</button><button aria-label={`Delete ${product.name}`} onClick={() => void deleteProduct(product)} className="text-red-700"><Trash2 size={17}/></button></td></tr>)}</tbody></table>{!matchingProducts.length && <p className="p-8 text-center text-sm text-[#68736c]">No matching products.</p>}</div>
      </>}
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
                <Field label="Category" required><select required value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} className={`${inputClass} bg-white`}>{productCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></Field>
                <Field label="Product URL slug" required hint={editing ? 'The published URL stays the same when editing this listing.' : 'Used in the product page URL.'}><input required readOnly={Boolean(editing)} maxLength={180} pattern="[A-Za-z0-9-]+" value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} className={`${inputClass} read-only:bg-[#f5f6f2] read-only:text-[#68736c]`}/></Field>
                <Field label="Short detail line" hint="Displayed directly below the product name." ><input maxLength={300} value={draft.detail} onChange={event => setDraft({ ...draft, detail: event.target.value })} placeholder="Example: 16GB GDDR6 · Triple-fan cooling" className={inputClass}/></Field>
                <Field label="Badge" hint="Optional label such as New arrival or Bestseller."><input maxLength={100} value={draft.badge} onChange={event => setDraft({ ...draft, badge: event.target.value })} className={inputClass}/></Field>
              </div>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="02" title="Product description" note="Write a clear overview customers can read before the specifications." />
              <label className="mt-5 block text-sm font-semibold">Description<textarea maxLength={5000} rows={6} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Describe what this product is, what it is designed for, and what is included. Add only confirmed product information." className="mt-2 w-full resize-y border border-[#cfd6ce] p-3 text-sm font-normal leading-6 outline-none focus:border-[#315ee8]"/></label>
              <p className="mt-1 text-right text-xs text-[#68736c]">{draft.description.length}/5000</p>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><EditorSection number="03" title="Specifications" note="Each row appears in Key specifications and Full specifications."/><button type="button" onClick={() => setDraft({ ...draft, specifications: [...draft.specifications, { label: '', value: '' }] })} className="inline-flex h-9 items-center gap-2 border border-[#cfd6ce] px-3 text-xs font-semibold hover:border-[#315ee8]"><Plus size={14}/>Add row</button></div>
              <div className="mt-5 space-y-3">{draft.specifications.map((specification, index) => <div key={index} className="grid grid-cols-[minmax(95px,.7fr)_minmax(0,1.3fr)_36px] gap-2">
                <input aria-label={`Specification ${index + 1} label`} maxLength={100} value={specification.label} onChange={event => setDraft({ ...draft, specifications: draft.specifications.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} placeholder="Label" className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
                <input aria-label={`Specification ${index + 1} value`} maxLength={300} value={specification.value} onChange={event => setDraft({ ...draft, specifications: draft.specifications.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) })} placeholder="Specification value" className="h-11 min-w-0 border border-[#cfd6ce] px-3 text-sm outline-none focus:border-[#315ee8]"/>
                <button type="button" onClick={() => setDraft({ ...draft, specifications: draft.specifications.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove specification ${index + 1}`} className="grid size-9 place-self-center text-[#68736c] hover:text-red-700"><Trash2 size={16}/></button>
              </div>)}</div>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="04" title="Price and inventory" note="Set the selling price and available quantity for checkout." />
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Price (PKR)" required><input required type="number" min={1} step={1} value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} className={inputClass}/></Field>
                <Field label="Stock quantity" required><input required type="number" min={0} max={1000000} step={1} value={draft.stockQuantity} onChange={event => setDraft({ ...draft, stockQuantity: event.target.value })} className={inputClass}/></Field>
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 border border-[#dfe4dc] p-3"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} className="mt-1 accent-[#315ee8]"/><span><span className="block text-sm font-semibold">Publish this listing</span><span className="mt-0.5 block text-xs text-[#68736c]">Turn off to hide this product from the storefront.</span></span></label>
            </section>

            <section className="border border-[#dfe4dc] bg-white p-5 sm:p-6">
              <EditorSection number="05" title="Product image" note="Paste a direct image URL and add accessible alternative text." />
              <div className="mt-5 grid gap-4">
                <Field label="Image URL"><input type="url" maxLength={2000} value={draft.image} onChange={event => setDraft({ ...draft, image: event.target.value })} placeholder="https://example.com/product-image.jpg" className={inputClass}/></Field>
                <Field label="Image alternative text"><input maxLength={300} value={draft.imageAlt} onChange={event => setDraft({ ...draft, imageAlt: event.target.value })} placeholder={draft.name || 'Describe the product image'} className={inputClass}/></Field>
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
                <div className="mt-4 border-y border-[#e2e6df] py-3"><p className="font-display text-2xl font-bold">{Number(draft.price) > 0 ? `Rs. ${Number(draft.price).toLocaleString('en-PK')}` : 'Price'}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#347346]"><Truck size={14}/>{Number(draft.stockQuantity) > 0 ? `${draft.stockQuantity} in stock · Nationwide delivery` : 'Currently out of stock'}</p></div>
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

const inputClass = 'mt-2 h-11 w-full border border-[#cfd6ce] px-3 text-sm font-normal outline-none focus:border-[#315ee8]'

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
