import DepartmentSection from '../components/DepartmentSection'
import FeaturedProducts from '../components/FeaturedProducts'
import HeroSection from '../components/HeroSection'
import ShoppingBenefits from '../components/ShoppingBenefits'
import { type Department, type Product } from '../catalog'
import type { LandingContent } from '../content'

interface HomePageProps {
  favorites: string[]
  products: Product[]
  search: string
  content: LandingContent
  departments: Department[]
  onAddToCart: (product: Product) => void
  onClearFilters: () => void
  onSelectCollection: (category: string) => void
  onToggleFavorite: (productName: string) => void
}

function HomePage({
  favorites,
  products,
  search,
  content,
  departments,
  onAddToCart,
  onClearFilters,
  onSelectCollection,
  onToggleFavorite,
}: HomePageProps) {
  return (
    <main id="top">
      <HeroSection content={content} onSelectCategory={onSelectCollection} />
      <FeaturedProducts
        favorites={favorites}
        products={products}
        search={search}
        kicker={content.featured_kicker}
        title={content.featured_title}
        subtitle={content.featured_subtitle}
        onAddToCart={onAddToCart}
        onClearFilters={onClearFilters}
        onToggleFavorite={onToggleFavorite}
      />
      <DepartmentSection
        departments={departments}
        kicker={content.departments_kicker}
        title={content.departments_title}
        onSelectCategory={onSelectCollection}
      />
      <ShoppingBenefits benefits={content.benefits} />
    </main>
  )
}

export default HomePage
