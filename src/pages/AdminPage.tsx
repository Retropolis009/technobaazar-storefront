import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, LayoutDashboard, LogOut, PackagePlus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import type { Product } from '../catalog'
import { apiUrl } from '../api'

interface Props { products: Product[]; onProductsChange: (products: Product[]) => void }

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
  const [draft, setDraft] = useState({ name: '', category: 'Graphics Cards', brand: '', price: '', detail: '', image: '', stockQuantity: '0' })
  const categories = ['All types', ...Array.from(new Set(products.map(product => product.category))).sort()]
  const matchingProducts = useMemo(() => products.filter(p => (categoryFilter === 'All types' || p.category === categoryFilter) && `${p.name} ${p.category} ${p.brand}`.toLowerCase().includes(query.toLowerCase())), [products, query, categoryFilter])

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
        if (!response.ok) throw new Error('Could not load products from Flask.')
        const catalog = await response.json() as { initialized: boolean; products: Product[] }
        if (!catalog.initialized) throw new Error('Catalog is not initialized. Run `flask --app app seed-catalog` in the backend folder.')
        onProductsChange(catalog.products)
      } catch { setError('Could not sync the catalog with Flask. Check that the backend is running.') }
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
  function openCreate() { setEditing(null); setDraft({ name: '', category: 'Graphics Cards', brand: '', price: '', detail: '', image: '', stockQuantity: '0' }); setFormOpen(true) }
  function openEdit(product: Product) { setEditing(product); setDraft({ name: product.name, category: product.category, brand: product.brand, price: String(product.priceValue), detail: product.detail, image: product.image, stockQuantity: String(product.stockQuantity ?? 0) }); setFormOpen(true) }
  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    const priceValue = Number(draft.price)
    if (!draft.name.trim() || !priceValue || !draft.brand.trim()) return
    const slug = editing?.slug ?? `${draft.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const product: Product = editing ? { ...editing, ...draft, slug, priceValue, stockQuantity: Number(draft.stockQuantity), price: `Rs. ${priceValue.toLocaleString('en-PK')}` } : {
      slug, name: draft.name.trim(), category: draft.category, brand: draft.brand.trim(), detail: draft.detail.trim() || 'New arrival', stockQuantity: Number(draft.stockQuantity),
      description: `${draft.name.trim()} from ${draft.brand.trim()}.`, specifications: [], price: `Rs. ${priceValue.toLocaleString('en-PK')}`,
      priceValue, badge: 'New arrival', image: draft.image.trim() || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=760&q=85', imageAlt: draft.name.trim(),
    }
    try {
      const response = await fetch(editing ? `${apiUrl}/api/admin/products/${editing.slug}` : `${apiUrl}/api/admin/products`, {
        method: editing ? 'PUT' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
      })
      if (!response.ok) { const data = await response.json(); setError(data.error ?? 'Could not save product.'); return }
      const saved = await response.json() as Product
      onProductsChange(editing ? products.map(p => p.slug === editing.slug ? saved : p) : [saved, ...products]); setFormOpen(false); setError('')
    } catch { setError('Flask API is unavailable. Product was not saved.') }
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
    <label className="mt-6 block text-sm font-semibold" htmlFor="admin-email">Admin email</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-11 w-full border border-[#cfd6ce] px-3 outline-none focus:border-[#315ee8]" /><label className="mt-4 block text-sm font-semibold" htmlFor="admin-password">Admin password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-11 w-full border border-[#cfd6ce] px-3 outline-none focus:border-[#315ee8]" />
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button className="mt-5 h-11 w-full bg-[#142c24] font-semibold text-white hover:bg-[#315ee8]">Sign in</button><button type="button" onClick={() => navigate('/')} className="mt-4 w-full text-sm text-[#68736c]">Back to store</button>
  </form></main>

  return <main className="min-h-[80vh] bg-[#f5f6f2]"><div className="mx-auto flex max-w-[1440px] flex-col md:flex-row">
    <aside className="w-full border-b border-[#dfe4dc] bg-white p-5 md:min-h-[75vh] md:w-64 md:border-b-0 md:border-r"><div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-[#142c24] text-[#c7f464]"><ShieldCheck size={20}/></div><div><strong className="block">Store Admin</strong><span className="text-xs text-[#68736c]">Management console</span></div></div>
      <nav className="flex gap-2 md:flex-col"><button onClick={() => setSection('overview')} className={`flex items-center gap-3 px-3 py-3 text-sm font-semibold ${section === 'overview' ? 'bg-[#e5eaff] text-[#315ee8]' : 'text-[#536057] hover:bg-[#f5f6f2]'}`}><LayoutDashboard size={17}/>Overview</button><button onClick={() => setSection('catalog')} className={`flex items-center gap-3 px-3 py-3 text-sm font-semibold ${section === 'catalog' ? 'bg-[#e5eaff] text-[#315ee8]' : 'text-[#536057] hover:bg-[#f5f6f2]'}`}><Boxes size={17}/>Products</button></nav>
      <button onClick={() => navigate('/')} className="mt-3 hidden px-3 py-3 text-left text-sm text-[#68736c] hover:text-[#315ee8] md:block">← Back to storefront</button>
      <button onClick={async () => { try { await fetch(`${apiUrl}/api/admin/logout`, { method: 'POST', credentials: 'include' }) } finally { setAuthenticated(false); navigate('/admin') } }} className="mt-8 hidden items-center gap-3 px-3 py-3 text-sm text-[#68736c] hover:text-red-700 md:flex"><LogOut size={17}/>Sign out</button>
    </aside>
    <div className="min-w-0 flex-1 p-5 sm:p-8"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="section-kicker">Store operations</p><h1 className="font-display text-3xl font-bold">{section === 'overview' ? 'Overview' : 'Products'}</h1><p className="mt-2 text-sm text-[#68736c]">{section === 'overview' ? 'A quick look at your catalog.' : 'Create, update, and remove products from the storefront.'}</p></div>{section === 'catalog' && <button onClick={openCreate} className="inline-flex h-11 items-center gap-2 bg-[#142c24] px-4 text-sm font-semibold text-white hover:bg-[#315ee8]"><PackagePlus size={17}/>Add product</button>}</div>
      {error && authenticated && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {section === 'overview' ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Stat title="Products" value={products.length} note="Products in your catalog"/><Stat title="Categories" value={new Set(products.map(p => p.category)).size} note="Active product types"/><Stat title="Catalog value" value={`Rs. ${products.reduce((sum,p)=>sum+p.priceValue,0).toLocaleString('en-PK')}`} note="Sum of listed prices"/></div><div className="mt-7 border border-[#dfe4dc] bg-white p-5"><h2 className="font-display text-lg font-bold">Quick actions</h2><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => setSection('catalog')} className="border border-[#cfd6ce] px-4 py-3 text-sm font-semibold hover:border-[#315ee8]">Browse products</button><button onClick={openCreate} className="bg-[#e5f4c6] px-4 py-3 text-sm font-semibold text-[#29441d]">Add a product</button></div></div><p className="mt-5 text-xs text-[#68736c]">Product changes are saved in the Flask database and shown on the storefront.</p></> : <><div className="mb-4 flex items-center gap-2 border border-[#dfe4dc] bg-white px-3"><Search size={17} className="text-[#7a857d]"/><input aria-label="Search products" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, brand, or category" className="h-11 min-w-0 flex-1 outline-none"/></div><div className="mb-4 flex gap-2 overflow-x-auto pb-2">{categories.map(category=><button key={category} onClick={()=>setCategoryFilter(category)} className={`filter-chip ${categoryFilter===category?'filter-chip-active':''}`}>{category}{category==='All types'?'':` · ${products.filter(product=>product.category===category).length}`}</button>)}</div><div className="overflow-x-auto border border-[#dfe4dc] bg-white"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[#f7f8f5] text-xs uppercase tracking-wide text-[#68736c]"><tr><th className="p-4">Product</th><th className="p-4">Category</th><th className="p-4">Brand</th><th className="p-4">Price</th><th className="p-4">Actions</th></tr></thead><tbody>{matchingProducts.map(p=><tr key={p.slug} className="border-t border-[#edf0eb]"><td className="p-4 font-semibold">{p.name}</td><td className="p-4">{p.category}</td><td className="p-4">{p.brand}</td><td className="p-4">{p.price}</td><td className="p-4"><button onClick={()=>openEdit(p)} className="mr-4 font-semibold text-[#315ee8]">Edit</button><button aria-label={`Delete ${p.name}`} onClick={()=>deleteProduct(p)} className="text-red-700"><Trash2 size={17}/></button></td></tr>)}</tbody></table>{!matchingProducts.length&&<p className="p-8 text-center text-sm text-[#68736c]">No matching products.</p>}</div></>}
    </div></div>
    {formOpen&&<div className="fixed inset-0 z-50 grid place-items-center bg-[#15201c]/55 p-4"><form onSubmit={saveProduct} className="max-h-[90vh] w-full max-w-xl overflow-y-auto bg-white p-6"><div className="flex justify-between"><h2 className="font-display text-xl font-bold">{editing?'Edit product':'Add product'}</h2><button type="button" onClick={()=>setFormOpen(false)} aria-label="Close" className="text-2xl">×</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{([['name','Product name'],['brand','Brand'],['price','Price (PKR)'],['detail','Short detail'],['image','Image URL'],['stockQuantity','Stock quantity']] as const).map(([field,label])=><label key={field} className="text-sm font-semibold">{label}<input required={field==='name'||field==='brand'||field==='price'||field==='stockQuantity'} type={field==='price'||field==='stockQuantity'?'number':'text'} min={field==='price'?1:field==='stockQuantity'?0:undefined} value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})} className="mt-1 h-10 w-full border border-[#cfd6ce] px-3 font-normal"/></label>)}<label className="text-sm font-semibold">Category<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} className="mt-1 h-10 w-full border border-[#cfd6ce] bg-white px-3 font-normal">{['Graphics Cards','Processors','Motherboards','Memory','Storage','Power Supplies','Cases & Cooling','Laptops','Monitors','Audio','Accessories'].map(c=><option key={c}>{c}</option>)}</select></label></div><button className="mt-6 h-11 w-full bg-[#142c24] font-semibold text-white">Save product</button></form></div>}
  </main>
}
function Stat({title,value,note}:{title:string;value:string|number;note:string}){return <div className="border border-[#dfe4dc] bg-white p-5"><p className="text-sm font-semibold text-[#68736c]">{title}</p><p className="mt-3 font-display text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[#68736c]">{note}</p></div>}
export default AdminPage
