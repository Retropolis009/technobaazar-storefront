import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import ToastNotice from './components/ToastNotice'
import { apiRequest, type CartLine, type Customer } from './api'
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
  onAddToCart: (product: Product, quantity?: number) => void
  onToggleFavorite: (productName: string) => void
}

function CollectionRoute({ products: catalog, favorites, onAddToCart, onToggleFavorite }: PageActions) {
  const { categorySlug: slug = '' } = useParams()
  const category = categoryFromSlug(slug)

  if (!category) return <NotFoundPage />

  const collectionProducts = catalog.filter((product) => productMatchesCategory(product, category))

  return (
    <CollectionPage
      category={category}
      products={collectionProducts}
      favorites={favorites}
      onAddToCart={onAddToCart}
      onToggleFavorite={onToggleFavorite}
    />
  )
}

function ProductRoute({ products: catalog, favorites, onAddToCart, onToggleFavorite }: PageActions) {
  const { productSlug } = useParams()
  const product = catalog.find((item) => item.slug === productSlug)

  if (!product) return <NotFoundPage />

  return (
    <ProductPage
      product={product}
      relatedProducts={catalog.filter((item) => item.category === product.category && item.slug !== product.slug).slice(0, 4)}
      favorites={favorites}
      isFavorite={favorites.includes(product.slug)}
      onAddToCart={onAddToCart}
      onToggleFavorite={onToggleFavorite}
    />
  )
}

function App() {
  const [catalog, setCatalog] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>(() => readStored('tb-cart', {}))
  const [favorites, setFavorites] = useState<string[]>(() => readStored('tb-favorites', []))
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [accountReady, setAccountReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0)
  const isAdminRoute = location.pathname.startsWith('/admin')

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return catalog.filter((product) =>
      !normalizedSearch ||
      `${product.name} ${product.category} ${product.detail} ${product.brand}`.toLowerCase().includes(normalizedSearch),
    )
  }, [search, catalog])

  useEffect(() => {
    apiRequest<{ initialized: boolean; products: Product[] }>('/api/catalog')
      .then(data => { if (data?.initialized) setCatalog(data.products as Product[]) })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    let active = true
    apiRequest<{ authenticated: boolean; id: number | null; email: string | null; name: string | null }>('/api/customer/session')
      .then(async (sessionData) => {
        if (!active) return
        if (sessionData.authenticated && sessionData.id && sessionData.email && sessionData.name) {
          const [serverCart, serverFavorites] = await Promise.all([
            apiRequest<CartLine[]>('/api/customer/cart'),
            apiRequest<string[]>('/api/customer/favorites'),
          ])
          if (!active) return
          setCustomer({ id: sessionData.id, email: sessionData.email, name: sessionData.name })
          setCart(Object.fromEntries(serverCart.map(item => [item.slug, item.quantity])))
          setFavorites(serverFavorites)
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setAccountReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!accountReady) return
    if (customer) {
      void apiRequest('/api/customer/cart', { method: 'PUT', body: JSON.stringify({ items: Object.entries(cart).map(([slug, quantity]) => ({ slug, quantity })) }) }).catch(() => undefined)
    } else {
      writeStored('tb-cart', cart)
    }
  }, [accountReady, cart, customer])

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

  function addToCart(product: Product, quantity = 1) {
    const maximum = Math.min(99, product.stockQuantity ?? 99)
    const currentQuantity = cart[product.slug] ?? 0
    if (currentQuantity >= maximum || currentQuantity + quantity > maximum) {
      setNotice(maximum === 0 ? `${product.name} is currently out of stock.` : `Only ${maximum} available for ${product.name}.`)
      return
    }
    setCart((current) => ({ ...current, [product.slug]: currentQuantity + quantity }))
    setNotice(`${quantity} × ${product.name} added to your bag.`)
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

  function handleAuthenticated(nextCustomer: Customer, nextCart: Record<string, number>, nextFavorites: string[]) {
    const availableSlugs = new Set(catalog.map(product => product.slug))
    setCustomer(nextCustomer)
    setCart(current => {
      const merged = { ...current }
      for (const [slug, quantity] of Object.entries(nextCart)) {
        if (availableSlugs.has(slug)) merged[slug] = Math.min(99, (merged[slug] ?? 0) + quantity)
      }
      return merged
    })
    setFavorites(current => [...new Set([...current, ...nextFavorites].filter(slug => availableSlugs.has(slug)))])
    setAccountReady(true)
  }

  function handleLogout() {
    setCustomer(null)
    setCart({})
    setFavorites([])
  }

  async function placeOrder(details: { customerName: string; phone: string; address: string }) {
    const order = await apiRequest<{ orderNumber: string }>('/api/customer/orders', { method: 'POST', body: JSON.stringify(details) })
    setCart({})
    setNotice(`Order ${order.orderNumber} placed successfully.`)
    return order.orderNumber
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/#products')
  }

  function clearFilters() {
    setSearch('')
    navigate('/collections/all-gear')
  }

  const pageActions = { products: catalog, favorites, onAddToCart: addToCart, onToggleFavorite: toggleFavorite }

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-[#15201c]">
      {!isAdminRoute && <SiteHeader
        departments={departments}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        favoritesCount={favorites.length}
        cartCount={cartCount}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />}
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              favorites={favorites}
              products={visibleProducts}
              search={search}
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
              products={catalog.filter((product) => cart[product.slug])}
              quantities={cart}
              onRemove={removeFromCart}
              customer={customer}
              onCheckout={placeOrder}
            />
          }
        />
        <Route path="/account" element={<AccountPage customer={customer} onAuthenticated={handleAuthenticated} onLogout={handleLogout} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {!isAdminRoute && <SiteFooter />}
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
