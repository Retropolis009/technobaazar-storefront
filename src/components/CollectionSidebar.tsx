import { Link } from 'react-router-dom'
import { categories, categorySlug } from '../catalog'

interface CollectionSidebarProps {
  idPrefix: string
  activeCategory: string
  brands: string[]
  minPrice: string
  maxPrice: string
  selectedBrands: string[]
  sortBy: string
  onMinPriceChange: (value: string) => void
  onMaxPriceChange: (value: string) => void
  onToggleBrand: (brand: string) => void
  onSortChange: (value: string) => void
  onReset: () => void
}

function CollectionSidebar({
  idPrefix,
  activeCategory,
  brands,
  minPrice,
  maxPrice,
  selectedBrands,
  sortBy,
  onMinPriceChange,
  onMaxPriceChange,
  onToggleBrand,
  onSortChange,
  onReset,
}: CollectionSidebarProps) {
  return (
    <div className="space-y-7 text-sm">
      <section aria-labelledby={`${idPrefix}-sidebar-categories`}>
        <h2 id={`${idPrefix}-sidebar-categories`} className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">Categories</h2>
        <nav className="space-y-1" aria-label="Shop categories">
          {categories.map((category) => (
            <Link
              key={category}
              to={`/collections/${categorySlug(category)}`}
              aria-current={category === activeCategory ? 'page' : undefined}
              className={`flex min-h-9 items-center justify-between border-l-2 px-3 text-xs transition ${category === activeCategory ? 'border-[#315ee8] bg-white font-bold text-[#315ee8]' : 'border-transparent text-[#5c675f] hover:bg-white hover:text-[#15201c]'}`}
            >
              {category}<span className="text-[10px] text-[#9aa29b]">›</span>
            </Link>
          ))}
        </nav>
      </section>

      <section aria-labelledby={`${idPrefix}-sidebar-sort`}>
        <label id={`${idPrefix}-sidebar-sort`} htmlFor={`${idPrefix}-collection-sort`} className="mb-2 block text-xs font-bold uppercase tracking-[0.12em]">Sort by</label>
        <select
          id={`${idPrefix}-collection-sort`}
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value)}
          className="h-10 w-full border border-[#dfe4dc] bg-white px-3 text-xs text-[#27332c] outline-none focus:border-[#315ee8]"
        >
          <option value="featured">Featured</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="name-a-z">Name: A to Z</option>
          <option value="name-z-a">Name: Z to A</option>
        </select>
      </section>

      <section aria-labelledby={`${idPrefix}-sidebar-price`}>
        <h2 id={`${idPrefix}-sidebar-price`} className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">Price range</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-semibold text-[#68736c]">
            Minimum
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={minPrice}
              onChange={(event) => onMinPriceChange(event.target.value)}
              placeholder="Rs. 0"
              className="mt-1 h-10 w-full border border-[#dfe4dc] bg-white px-2 text-xs text-[#27332c] outline-none focus:border-[#315ee8]"
            />
          </label>
          <label className="text-[10px] font-semibold text-[#68736c]">
            Maximum
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={maxPrice}
              onChange={(event) => onMaxPriceChange(event.target.value)}
              placeholder="No limit"
              className="mt-1 h-10 w-full border border-[#dfe4dc] bg-white px-2 text-xs text-[#27332c] outline-none focus:border-[#315ee8]"
            />
          </label>
        </div>
      </section>

      <section aria-labelledby={`${idPrefix}-sidebar-brand`}>
        <h2 id={`${idPrefix}-sidebar-brand`} className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">Brand</h2>
        <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
          {brands.map((brand) => (
            <label key={brand} className="flex cursor-pointer items-center gap-2 text-xs text-[#4d5951]">
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand)}
                onChange={() => onToggleBrand(brand)}
                className="size-4 accent-[#315ee8]"
              />
              <span>{brand}</span>
            </label>
          ))}
        </div>
      </section>

      <button type="button" onClick={onReset} className="text-xs font-semibold text-[#315ee8] underline underline-offset-4">
        Reset filters
      </button>
    </div>
  )
}

export default CollectionSidebar
