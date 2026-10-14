import DepartmentSection from '../components/DepartmentSection'
import FeaturedProducts from '../components/FeaturedProducts'
import HeroSection from '../components/HeroSection'
import ShoppingBenefits from '../components/ShoppingBenefits'
import { departments, type Product } from '../catalog'

interface HomePageProps {
  favorites: string[]
  products: Product[]
  search: string
  onAddToCart: (product: Product) => void
  onClearFilters: () => void
  onSelectCollection: (category: string) => void
  onToggleFavorite: (productName: string) => void
}

function HomePage({
  favorites,
  products,
  search,
  onAddToCart,
  onClearFilters,
  onSelectCollection,
  onToggleFavorite,
}: HomePageProps) {
  return (
    <main id="top">
      <HeroSection onSelectCategory={onSelectCollection} />
      <DepartmentSection departments={departments} onSelectCategory={onSelectCollection} />
      <FeaturedProducts
        favorites={favorites}
        products={products}
        search={search}
        onAddToCart={onAddToCart}
        onClearFilters={onClearFilters}
        onToggleFavorite={onToggleFavorite}
      />
      <ShoppingBenefits />
    </main>
  )
}

export default HomePage