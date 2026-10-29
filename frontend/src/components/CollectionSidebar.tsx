import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Category } from '../api'
import { categorySlug, departments } from '../catalog'

const fallbackCategories: Category[] = [
  ...departments.flatMap((department, index) => [
    { id: index + 1, name: department.name, slug: categorySlug(department.name), sortOrder: index * 10, visible: true, parentId: null, parentName: null },
    ...(department.subcategories ?? []).map((name, childIndex) => ({ id: 1000 + index * 10 + childIndex, name, slug: categorySlug(name), sortOrder: childIndex * 10, visible: true, parentId: index + 1, parentName: department.name })),
  ]),
  { id: 99, name: 'Accessories', slug: 'accessories', sortOrder: 999, visible: true, parentId: null, parentName: null },
]

interface CollectionSidebarProps {
  idPrefix: string
  activeCategory: string
  categories: Category[]
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
  categories,
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
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const categoryItems = categories.length ? categories : fallbackCategories
  const parents = categoryItems.filter(category => category.parentId === null)
  return (
    <div className="space-y-7 text-sm">
      <section aria-labelledby={`${idPrefix}-sidebar-categories`}>
        <h2 id={`${idPrefix}-sidebar-categories`} className="mb-3 text-xs font-bold uppercase tracking-[0.12em]">Categories</h2>
        <nav className="space-y-1" aria-label="Shop categories">
          <Link to="/collections/all-gear" aria-current={activeCategory === 'All gear' ? 'page' : undefined} className={`flex min-h-9 items-center justify-between border-l-2 px-3 text-xs transition ${activeCategory === 'All gear' ? 'border-[#315ee8] bg-white font-bold text-[#315ee8]' : 'border-transparent text-[#5c675f] hover:bg-white hover:text-[#15201c]'}`}>
            All gear<span className="text-[10px] text-[#9aa29b]">›</span>
          </Link>
          {parents.map((category) => {
            const children = categoryItems.filter(child => child.parentId === category.id)
            const isExpanded = expanded[category.id] ?? true
            return <div key={category.id}>
            <div className={`flex min-h-9 items-center justify-between border-l-2 pl-3 pr-1 text-xs transition ${category.name === activeCategory ? 'border-[#315ee8] bg-white font-bold text-[#315ee8]' : 'border-transparent text-[#5c675f] hover:bg-white hover:text-[#15201c]'}`}>
              <Link to={`/collections/${categorySlug(category.name)}`} aria-current={category.name === activeCategory ? 'page' : undefined} className="flex min-h-9 flex-1 items-center">
                {category.name}
              </Link>
              {children.length > 0 && <button type="button" aria-label={`${isExpanded ? 'Hide' : 'Show'} ${category.name} subcategories`} aria-expanded={isExpanded} onClick={() => setExpanded(current => ({ ...current, [category.id]: !isExpanded }))} className="grid size-8 place-items-center text-[#68736c] hover:text-[#315ee8]">{isExpanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>}
            </div>
            {children.length > 0 && isExpanded && <div className="ml-4 border-l border-[#dfe4dc] pl-2">
              {children.map(child => <Link key={child.id} to={`/collections/${categorySlug(child.name)}`} aria-current={child.name === activeCategory ? 'page' : undefined} className={`flex min-h-8 items-center px-2 text-xs transition ${child.name === activeCategory ? 'font-bold text-[#315ee8]' : 'text-[#68736c] hover:text-[#315ee8]'}`}>{child.name}</Link>)}
            </div>}
            </div>
          })}
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
