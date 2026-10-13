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
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import ToastNotice from './components/ToastNotice'
import {
  categoryFromSlug,
  categorySlug,
  departments,
  products,
  productMatchesCategory,
  type Product,
} from './data/storeData'

interface PageActions {
  favorites: string[]
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

function CollectionRoute({ favorites, onAddToCart, onToggleFavorite }: PageActions) {
  const { categorySlug: slug = '' } = useParams()
  const category = categoryFromSlug(slug)

  if (!category) return <NotFoundPage />

  const collectionProducts = products.filter((product) => productMatchesCategory(product, category))

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

function ProductRoute({ favorites, onAddToCart, onToggleFavorite }: PageActions) {
  const { productSlug } = useParams()
  const product = products.find((item) => item.slug === productSlug)

  if (!product) return <NotFoundPage />

  return (
    <ProductPage
      product={product}
      relatedProducts={products.filter((item) => item.category === product.category && item.slug !== product.slug).slice(0, 4)}
      favorites={favorites}
      isFavorite={favorites.includes(product.name)}
      onAddToCart={onAddToCart}
      onToggleFavorite={onToggleFavorite}
    />
  )
}

function App() {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [favorites, setFavorites] = useState<string[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0)

  const visibleProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return products.filter((product) =>
      !normalizedSearch ||
      `${product.name} ${product.category} ${product.detail} ${product.brand}`.toLowerCase().includes(normalizedSearch),
    )
  }, [search])

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

  function addToCart(product: Product) {
    setCart((current) => ({ ...current, [product.slug]: (current[product.slug] ?? 0) + 1 }))
    setNotice(`${product.name} added to your bag.`)
  }

  function removeFromCart(productSlug: string) {
    setCart((current) => {
      const next = { ...current }
      delete next[productSlug]
      return next
    })
  }

  function toggleFavorite(productName: string) {
    setFavorites((current) =>
      current.includes(productName)
        ? current.filter((name) => name !== productName)
        : [...current, productName],
    )
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate('/#products')
  }

  function clearFilters() {
    setSearch('')
    navigate('/collections/all-gear')
  }

  const pageActions = { favorites, onAddToCart: addToCart, onToggleFavorite: toggleFavorite }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f6f2] text-[#15201c]">
      <SiteHeader
        departments={departments}
        search={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearch}
        favoritesCount={favorites.length}
        cartCount={cartCount}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />
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
        <Route path="/about" element={<AboutPage />} />
        <Route
          path="/favorites"
          element={
            <FavoritesPage
              products={products.filter((product) => favorites.includes(product.name))}
              onAddToCart={addToCart}
              onToggleFavorite={toggleFavorite}
            />
          }
        />
        <Route
          path="/cart"
          element={
            <CartPage
              products={products.filter((product) => cart[product.slug])}
              quantities={cart}
              onRemove={removeFromCart}
            />
          }
        />
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <SiteFooter />
      <ToastNotice message={notice} onDismiss={() => setNotice('')} />
    </div>
  )
}

export default App