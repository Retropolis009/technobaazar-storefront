import type { FormEventHandler } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { categorySlug, type Department } from '../catalog'
import AnnouncementBar from './AnnouncementBar'

interface SiteHeaderProps {
  departments: Department[]
  search: string
  onSearchChange: (value: string) => void
  onSearchSubmit: FormEventHandler<HTMLFormElement>
  favoritesCount: number
  cartCount: number
  menuOpen: boolean
  onToggleMenu: () => void
  announcement?: string
}

function SiteHeader({
  departments,
  search,
  onSearchChange,
  onSearchSubmit,
  favoritesCount,
  cartCount,
  menuOpen,
  onToggleMenu,
  announcement,
}: SiteHeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#e1e5df] bg-[#f5f6f2]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-3 sm:px-7 lg:px-10">
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-sm border border-[#dfe4dc] lg:hidden"
            aria-label={menuOpen ? 'Close departments' : 'Open departments'}
            aria-expanded={menuOpen}
            onClick={onToggleMenu}
          >
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="TechnoBaazar home">
            <span className="grid size-9 place-items-center bg-[#c7f464] text-[#15201c] transition-transform group-hover:-rotate-6">
              <Zap size={20} fill="currentColor" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="font-display text-[17px] font-bold leading-none tracking-[-0.06em] sm:text-[19px]">
              TECHNO<span className="text-[#315ee8]">BAAZAR</span>
              <span className="hidden font-sans text-[9px] font-bold tracking-[0.2em] text-[#69736d] sm:block sm:pt-1">
                SUPPLY CO.
              </span>
            </span>
          </Link>

          <form
            className="mx-auto hidden h-11 w-full max-w-[520px] items-center border border-[#dfe4dc] bg-white px-3.5 focus-within:border-[#315ee8] md:flex"
            role="search"
            onSubmit={onSearchSubmit}
          >
            <Search size={17} className="shrink-0 text-[#69736d]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search laptops, components, gear..."
              aria-label="Search products"
              className="search-field h-full w-full bg-transparent px-3 text-sm outline-none placeholder:text-[#929a94]"
            />
            <kbd className="hidden whitespace-nowrap border border-[#e1e5df] px-1.5 py-1 text-[10px] text-[#89918b] lg:block">
              ENTER
            </kbd>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Link to="/account" className="header-action header-action-secondary" aria-label="Account">
              <UserRound size={19} strokeWidth={1.7} />
            </Link>
            <Link to="/favorites" className="header-action header-action-secondary" aria-label={`Favorites, ${favoritesCount} items`}>
              <Heart size={19} strokeWidth={1.7} />
              {favoritesCount > 0 && <span className="action-count">{favoritesCount}</span>}
            </Link>
            <Link to="/cart" className="header-action" aria-label={`Shopping bag, ${cartCount} items`}>
              <ShoppingBag size={19} strokeWidth={1.7} />
              <span className="action-count">{cartCount}</span>
            </Link>
          </div>
        </div>

        <form className="mx-4 mb-3 flex h-10 items-center border border-[#dfe4dc] bg-white px-3 md:hidden" role="search" onSubmit={onSearchSubmit}>
          <Search size={16} className="shrink-0 text-[#69736d]" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search the store"
            aria-label="Search products"
            className="search-field h-full w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-[#929a94]"
          />
        </form>

        <nav
          className={`${menuOpen ? 'grid' : 'hidden'} border-t border-[#e1e5df] px-4 py-2 lg:flex lg:justify-center lg:gap-8 lg:px-10 lg:py-0`}
          aria-label="Shop departments"
        >
          <Link to="/collections/all-gear" className="category-link">All gear</Link>
          {departments.map(({ name }) => (
            <Link to={`/collections/${categorySlug(name)}`} key={name} className="category-link">
              {name}
            </Link>
          ))}
          <Link to="/about" className="category-link category-link-wide">
            Why TechnoBaazar <ArrowUpRight size={13} />
          </Link>
        </nav>
      </header>
      <AnnouncementBar message={announcement} />
    </>
  )
}

export default SiteHeader