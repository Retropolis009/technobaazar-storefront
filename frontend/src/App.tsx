import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import AboutPage from './pages/AboutPage'
import AccountPage from './pages/AccountPage'
import CartPage from './pages/CartPage'
import CollectionPage from './pages/CollectionPage'
import FavoritesPage from './pages/FavoritesPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import ProductPage from './pages/ProductPage'
import AdminPage from './pages/AdminPage'
import SeoHead from './components/SeoHead'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import ToastNotice from './components/ToastNotice'
import { apiRequest, type CartLine, type Category, type Customer, type OrderSummary, type StoreSettings } from './api'
import { DEFAULT_LANDING_CONTENT, normalizeLandingContent, type LandingContent } from './content'
import {
  categoryFromSlug,
  categorySlug,
  departments,
  productMatchesCategory,
  type Product,
} from './catalog'

interface PageActions {
  products: Product[]
  favorites: string[]
  content: LandingContent
  categories: Category[]
  onAddToCart: (product: Product, quantity?: number) => void
  onToggleFavorite: (productName: string) => void
}

const DEFAULT_SETTINGS: StoreSettings = { deliveryFee: 350, freeShippingThreshold: 0, cities: [] }

function CollectionRoute({ products: catalog, categories, onAddToCart, onToggleFavorite, favorites }: PageActions) {
  const { categorySlug: slug = '' } = useParams()
  const category = categoryFromSlug(slug, categories.length ? ['All gear', ...categories.map(item => item.name)] : undefined)

  if (!category) return <NotFoundPage />

  const selectedCategory = categories.find(item => item.name === category)
  const categoryNames = selectedCategory?.parentId === null
    ? [category, ...categories.filter(item => item.parentId === selectedCategory.id).map(item => item.name)]
    : [category]
  const collectionProducts = catalog.filter((product) => categoryNames.some(name => productMatchesCategory(product, name)))

  return (
    <CollectionPage
      category={category}
      categories={categories}
      products={collectionProducts}
      favorites={favorites}
      onAddToCart={onAddToCart}
      onToggleFavorite={onToggleFavorite}
    />
  )
}

function ProductRoute({ products: catalog, favorites, content, onAddToCart, onToggleFavorite }: PageActions) {
  const { productSlug } = useParams()
  const product = catalog.find((item) => item.slug === productSlug)

  if (!product) return <NotFoundPage />

  return (
    <ProductPage
      product={product}
      relatedProducts={catalog.filter((item) => item.category === product.category && item.slug !== product.slug).slice(0, 4)}
      favorites={favorites}
      isFavorite={favorites.includes(product.slug)}
      deliveryNote={content.delivery_note}
      paymentNote={content.payment_note}
      onAddToCart={onAddToCart}
      onToggleFavorite={onToggleFavorite}
    />
  )
}

function App() {
  const [catalog, setCatalog] = useState<Product[]>([])
  const [content, setContent] = useState<LandingContent>(DEFAULT_LANDING_CONTENT)
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS)
  const [storeCategories, setStoreCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>(() => readStored('tb-cart', {}))
  const [favorites, setFavorites] = useState<string[]>(() => readStored('tb-favorites', []))
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [accountReady, setAccountReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const cartTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0)
  const isAdminRoute = location.pathname.startsWith('/admin')

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return catalog.filter((product) =>
      !normalizedSearch ||
      `${product.name} ${product.category} ${product.detail} ${product.brand}`.toLowerCase().includes(normalizedSearch),
    )
  }, [search, catalog])

  const activeDepartments = useMemo(() => {
    if (!storeCategories.length) return departments
    return storeCategories
      .filter(category => category.parentId === null)
      .map(category => ({
        name: category.name,
        icon: departments.find(department => department.name === category.name)?.icon ?? departments[0].icon,
        subcategories: storeCategories.filter(child => child.parentId === category.id).map(child => child.name),
      }))
  }, [storeCategories])

  useEffect(() => {
    apiRequest<{ initialized: boolean; products: Product[] }>('/api/catalog')
      .then(data => { if (data?.initialized) setCatalog(data.products as Product[]) })
      .catch(() => undefined)
    apiRequest<Record<string, unknown>>('/api/site-content')
      .then(data => setContent(normalizeLandingContent(data)))
      .catch(() => undefined)
    apiRequest<StoreSettings>('/api/store-settings')
      .then(data => { if (data && typeof data.deliveryFee === 'number') setSettings(data) })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return
    apiRequest<Category[]>('/api/categories')
      .then(data => { if (Array.isArray(data)) setStoreCategories(data) })
      .catch(() => undefined)
  }, [location.pathname])

  useEffect(() => {
    let active = true
    apiRequest<{ authenticated: boolean; id: number | null; email: string | null; name: string | null }>('/api/customer/session')
      .then(async (sessionData) => {
        if (!active) return
        try {
          // Unified server cart: works for guests (cookie cart) and customers.
          const serverCart = await apiRequest<{ items: CartLine[] } | CartLine[]>('/api/cart')
          if (!active) return
          const lines = Array.isArray(serverCart) ? serverCart : serverCart.items
          if (lines.length || sessionData.authenticated) {
            setCart(Object.fromEntries(lines.map(item => [item.slug, item.quantity])))
          }
        } catch {
          // Backend unavailable: keep the localStorage cart already loaded.
        }
        if (!active) return
        if (sessionData.authenticated && sessionData.id && sessionData.email && sessionData.name) {
          try {
            const serverFavorites = await apiRequest<string[]>('/api/customer/favorites')
            if (!active) return
            setFavorites(serverFavorites)
          } catch {
            // Keep local favorites when the backend is unreachable.
          }
          if (!active) return
          setCustomer({ id: sessionData.id, email: sessionData.email, name: sessionData.name })
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setAccountReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!accountReady) return
    writeStored('tb-cart', cart)
    if (cartTimer.current) clearTimeout(cartTimer.current)
    cartTimer.current = setTimeout(() => {
      void apiRequest('/api/cart', { method: 'PUT', body: JSON.stringify({ items: Object.entries(cart).map(([slug, quantity]) => ({ slug, quantity })) }) }).catch(() => undefined)
    }, 400)
    return () => { if (cartTimer.current) clearTimeout(cartTimer.current) }
  }, [accountReady, cart])

  useEffect(() => {
    if (!accountReady) return
    if (customer) {
      void apiRequest('/api/customer/favorites', { method: 'PUT', body: JSON.stringify({ slugs: favorites }) }).catch(() => undefined)
    } else {
      writeStored('tb-favorites', favorites)
    }
  }, [accountReady, customer, favorites])

  useEffect(() => {
    setMenuOpen(false)
    if (location.hash) {
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView())
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, location.hash])

  function selectCategory(category: string) {
    setMenuOpen(false)
    navigate(`/collections/${categorySlug(category)}`)
  }

  function stockLimit(product: Product) {
    return (product.trackStock ?? true) ? Math.min(99, product.stockQuantity ?? 99) : 99
  }

  function addToCart(product: Product, quantity = 1) {
    const maximum = stockLimit(product)
    const currentQuantity = cart[product.slug] ?? 0
    if (maximum === 0) {
      setNotice(`${product.name} is currently out of stock.`)
      return
    }
    if (currentQuantity + quantity > maximum) {
      setNotice(`Only ${maximum} available for ${product.name}.`)
      setCart((current) => ({ ...current, [product.slug]: maximum }))
      return
    }
    setCart((current) => ({ ...current, [product.slug]: currentQuantity + quantity }))
    setNotice(`${quantity} × ${product.name} added to your bag.`)
  }

  function updateQuantity(productSlug: string, quantity: number) {
    const product = catalog.find((item) => item.slug === productSlug)
    const maximum = product ? stockLimit(product) : 99
    const clamped = Math.max(1, Math.min(maximum, quantity))
    setCart((current) => ({ ...current, [productSlug]: clamped }))
  }

  function removeFromCart(productSlug: string) {
    setCart((current) => {
      const next = { ...current }
      delete next[productSlug]
      return next
    })
  }

  function toggleFavorite(productSlug: string) {
    setFavorites((current) =>
      current.includes(productSlug)
        ? current.filter((slug) => slug !== productSlug)
        : [...current, productSlug],
    )
  }

  async function handleAuthenticated(nextCustomer: Customer) {
    setCustomer(nextCustomer)
    setAccountReady(true)
    // The server already merged the guest bag into the account bag on sign-in.
    try {
      const serverCart = await apiRequest<{ items: CartLine[] }>('/api/cart')
      const availableSlugs = new Set(catalog.map(product => product.slug))
      setCart(Object.fromEntries(serverCart.items.filter(item => availableSlugs.has(item.slug)).map(item => [item.slug, item.quantity])))
      const serverFavorites = await apiRequest<string[]>('/api/customer/favorites')
      setFavorites(serverFavorites.filter(slug => availableSlugs.has(slug)))
    } catch {
      // Keep the local bag when the sync fails.
    }
  }

  function handleLogout() {
    setCustomer(null)
    setCart({})
    setFavorites([])
  }

  function handleOrderPlaced(order: OrderSummary) {
    setCart({})
    setNotice(`Order ${order.orderNumber} placed successfully.`)
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/#products')
  }

  function clearFilters() {
    setSearch('')
    navigate('/collections/all-gear')
  }

  const pageSeo = useMemo(() => {
    const siteTitle = content.seo_site_title
    const siteDescription = content.seo_site_description
    const base = content.seo_canonical_base.trim().replace(/\/$/, '')
    const canonicalFor = (path: string) => (base ? `${base}${path}` : '')
    const fallback = (value: string | undefined, next: string) => (value ?? '').trim() || next
    const path = location.pathname

    const productMatch = path.match(/^\/products\/([^/]+)$/)
    if (productMatch) {
      const product = catalog.find(item => item.slug === decodeURIComponent(productMatch[1]))
      if (product) {
        const title = fallback(product.seo?.title, `Buy ${product.name} in Pakistan | Price & Specs | TechnoBaazar`)
        const productSummary = (product.detail || product.description || product.category).replace(/\s+/g, ' ').trim()
        const defaultDescription = `Shop ${product.name} in Pakistan. ${productSummary} Compare specifications and price at TechnoBaazar, with nationwide delivery.`
        const description = fallback(product.seo?.description, defaultDescription).slice(0, 160)
        return {
          title, description,
          keywords: fallback(product.seo?.keywords, content.seo_site_keywords),
          ogTitle: fallback(product.seo?.ogTitle, title),
          ogDescription: fallback(product.seo?.ogDescription, description),
          ogImage: fallback(product.seo?.ogImage, product.image || content.seo_og_image),
          ogType: 'product', canonical: fallback(product.seo?.canonicalUrl, canonicalFor(path)), noIndex: false,
          productData: {
            name: product.name, description, image: product.image || content.seo_og_image,
            slug: product.slug, brand: product.brand, price: product.priceValue,
            inStock: !(product.trackStock ?? true) || (product.stockQuantity ?? 0) > 0,
          },
        }
      }
    }

    const collectionMatch = path.match(/^\/collections\/([^/]+)$/)
    if (collectionMatch) {
      const names = storeCategories.length ? ['All gear', ...storeCategories.map(item => item.name)] : undefined
      const category = categoryFromSlug(decodeURIComponent(collectionMatch[1]), names)
      if (category) {
        const isAll = category === 'All gear'
        const title = isAll ? siteTitle : `Shop ${category} in Pakistan | TechnoBaazar`
        const description = isAll ? siteDescription : `Browse ${category} online at TechnoBaazar. Compare specifications, availability, and prices, with delivery across Pakistan.`
        return {
          title, description, keywords: content.seo_site_keywords, ogTitle: title,
          ogDescription: description, ogImage: content.seo_og_image, ogType: 'website',
          canonical: canonicalFor(path), noIndex: false,
        }
      }
    }

    if (path === '/') {
      return {
        title: siteTitle, description: siteDescription, keywords: content.seo_site_keywords,
        ogTitle: siteTitle, ogDescription: siteDescription, ogImage: content.seo_og_image,
        ogType: 'website', canonical: canonicalFor('/'), noIndex: false,
      }
    }

    if (path === '/checkout') {
      return {
        title: 'Secure Checkout | TechnoBaazar',
        description: 'Complete your TechnoBaazar order with delivery details and payment selection.',
        keywords: '', ogTitle: 'Secure Checkout | TechnoBaazar', ogDescription: '', ogImage: '',
        ogType: 'website', canonical: '', noIndex: true,
      }
    }

    const seoValues = content as unknown as Record<string, string>
    const staticPages: Record<string, { label: string; key: string }> = {
      '/about': { label: 'About', key: 'about' }, '/favorites': { label: 'Favorites', key: 'favorites' },
      '/cart': { label: 'Cart', key: 'cart' }, '/account': { label: 'Account', key: 'account' },
    }
    if (staticPages[path]) {
      const page = staticPages[path]
      const title = fallback(seoValues[`seo_${page.key}_title`], `${page.label} | TechnoBaazar`)
      const description = fallback(seoValues[`seo_${page.key}_description`], siteDescription)
      return {
        title, description, keywords: content.seo_site_keywords, ogTitle: title,
        ogDescription: description, ogImage: content.seo_og_image, ogType: 'website',
        canonical: canonicalFor(path), noIndex: ['/favorites', '/cart', '/account'].includes(path),
      }
    }

    return {
      title: path.startsWith('/admin') ? 'Admin | TechnoBaazar' : 'Not found | TechnoBaazar',
      description: siteDescription, keywords: '', ogTitle: '', ogDescription: '', ogImage: '',
      ogType: 'website', canonical: '', noIndex: true,
    }
  }, [location.pathname, catalog, content, storeCategories])

  const pageActions = { products: catalog, favorites, content, categories: storeCategories, onAddToCart: addToCart, onToggleFavorite: toggleFavorite }

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#15201c]">
      <SeoHead {...pageSeo} settings={content as unknown as Record<string, string>} />
      {!isAdminRoute && <SiteHeader
        departments={activeDepartments}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        favoritesCount={favorites.length}
        cartCount={cartCount}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        announcement={content.announcement}
        content={content}
      />}
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              favorites={favorites}
              products={visibleProducts}
              search={search}
              content={content}
              departments={activeDepartments}
              onAddToCart={addToCart}
              onClearFilters={clearFilters}
              onSelectCollection={selectCategory}
              onToggleFavorite={toggleFavorite}
            />
          }
        />
        <Route path="/collections/:categorySlug" element={<CollectionRoute {...pageActions} />} />
        <Route path="/products/:productSlug" element={<ProductRoute {...pageActions} />} />
        <Route path="/admin" element={<AdminPage products={catalog} onProductsChange={setCatalog} />} />
        <Route path="/about" element={<AboutPage />} />
        <Route
          path="/favorites"
          element={
            <FavoritesPage
              products={catalog.filter((product) => favorites.includes(product.slug))}
              onAddToCart={addToCart}
              onToggleFavorite={toggleFavorite}
            />
          }
        />
        <Route
          path="/cart"
          element={
            <CartPage
              mode="cart"
              products={catalog.filter((product) => cart[product.slug])}
              quantities={cart}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              customer={customer}
              settings={settings}
              checkoutNote={content.checkout_note}
              paymentNote={content.payment_note}
              confirmationNote={content.order_confirmation_note}
              onOrderPlaced={handleOrderPlaced}
            />
          }
        />
        <Route
          path="/checkout"
          element={
            <CartPage
              mode="checkout"
              products={catalog.filter((product) => cart[product.slug])}
              quantities={cart}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              customer={customer}
              settings={settings}
              checkoutNote={content.checkout_note}
              paymentNote={content.payment_note}
              confirmationNote={content.order_confirmation_note}
              onOrderPlaced={handleOrderPlaced}
            />
          }
        />
        <Route path="/account" element={<AccountPage customer={customer} onAuthenticated={handleAuthenticated} onLogout={handleLogout} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isAdminRoute && <SiteFooter content={content} />}
      {!isAdminRoute && <ToastNotice message={notice} onDismiss={() => setNotice('')} />}
    </div>
  )
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function writeStored<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Keep browsing usable when storage is disabled or full.
  }
}

export default App
