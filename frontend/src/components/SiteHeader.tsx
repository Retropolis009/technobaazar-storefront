import type { FormEventHandler } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Heart, Menu, Search, ShoppingCart, UserRound, X } from 'lucide-react'
import { categorySlug, type Department } from '../catalog'
import { DEFAULT_LANDING_CONTENT, type LandingContent } from '../content'
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
  content?: LandingContent
}

function SiteHeader({ departments, search, onSearchChange, onSearchSubmit, favoritesCount, cartCount, menuOpen, onToggleMenu, announcement, content = DEFAULT_LANDING_CONTENT }: SiteHeaderProps) {
  return <>
    <AnnouncementBar message={announcement}/>
    <header className="sticky top-0 z-40 border-b border-[#263547] bg-[#050608] text-white shadow-sm">
      <div className="mx-auto flex min-h-[68px] max-w-[1440px] items-center gap-3 px-3 sm:px-6 lg:gap-8 lg:px-10">
        <button type="button" className="grid size-9 shrink-0 place-items-center text-white lg:hidden" aria-label={menuOpen ? 'Close categories' : 'Open categories'} aria-expanded={menuOpen} onClick={onToggleMenu}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
        <Link to="/" className="flex shrink-0 flex-col leading-none" aria-label={`${content.header_brand_prefix}${content.header_brand_accent} home`}>
          <span className="font-display text-[18px] font-extrabold tracking-[-0.08em] sm:text-[22px]">{content.header_brand_prefix}<span className="text-[#f4c62b]">{content.header_brand_accent}</span></span>
          <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.22em] text-white/55 sm:text-[9px]">{content.header_tagline}</span>
        </Link>

        <form className="mx-auto hidden h-10 w-full max-w-[560px] items-center overflow-hidden rounded-sm bg-white text-[#202a38] md:flex" role="search" onSubmit={onSearchSubmit}>
          <label className="hidden h-full shrink-0 items-center border-r border-[#dce1e8] px-3 text-[11px] font-semibold text-[#647184] lg:flex">All categories<ChevronDown size={13} className="ml-2"/></label>
          <input type="search" value={search} onChange={event => onSearchChange(event.target.value)} placeholder={content.header_search_placeholder} aria-label="Search products" className="h-full min-w-0 flex-1 px-3 text-xs outline-none placeholder:text-[#7d8795] sm:text-sm"/>
          <button type="submit" aria-label="Search" className="grid size-10 shrink-0 place-items-center bg-white text-[#647184] hover:text-[#244fa7]"><Search size={17}/></button>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
          <Link to="/account" className="header-action header-action-dark" aria-label="My account"><UserRound size={18}/></Link>
          <Link to="/favorites" className="header-action header-action-dark" aria-label={`Favorites, ${favoritesCount} items`}><Heart size={18}/>{favoritesCount > 0 && <span className="header-count">{favoritesCount}</span>}</Link>
          <Link to="/cart" className="header-action header-action-dark" aria-label={`Shopping cart, ${cartCount} items`}><ShoppingCart size={19}/><span className="header-count">{cartCount}</span></Link>
          <span className="hidden border-l border-white/15 pl-3 text-[10px] font-bold text-white/80 sm:block">PKR</span>
        </div>
      </div>

      <form className="mx-3 mb-2 flex h-9 items-center border border-white/20 bg-white px-2 md:hidden" role="search" onSubmit={onSearchSubmit}>
        <Search size={15} className="shrink-0 text-[#647184]"/><input type="search" value={search} onChange={event => onSearchChange(event.target.value)} placeholder={content.header_mobile_search_placeholder} aria-label="Search products" className="h-full w-full bg-transparent px-2 text-xs text-[#17243a] outline-none"/>
      </form>

      <nav className={`${menuOpen ? 'flex' : 'hidden'} max-h-[65vh] flex-col overflow-y-auto border-t border-white/10 bg-[#103b63] px-3 py-1 lg:flex lg:max-h-none lg:flex-row lg:items-center lg:justify-center lg:gap-1 lg:overflow-visible lg:px-6`} aria-label="Shop categories">
        <Link to="/" className="store-nav-link">Home</Link>
        <Link to="/collections/all-gear" className="store-nav-link">All categories<ChevronDown size={12}/></Link>
        {departments.map(({ name, subcategories = [] }) => <div key={name} className="group relative shrink-0">
          <Link to={`/collections/${categorySlug(name)}`} className="store-nav-link">{name}{subcategories.length > 0 && <ChevronDown size={12}/>}</Link>
          {subcategories.length > 0 && <div className="absolute left-0 top-full z-50 hidden min-w-48 border border-[#d9e1eb] bg-white py-1 text-[#263750] shadow-xl group-hover:block group-focus-within:block">{subcategories.map(subcategory => <Link key={subcategory} to={`/collections/${categorySlug(subcategory)}`} className="block px-4 py-2 text-xs font-medium hover:bg-[#edf3ff] hover:text-[#244fa7]">{subcategory}</Link>)}</div>}
        </div>)}
        <Link to="/about" className="store-nav-link">About</Link>
      </nav>
    </header>
  </>
}

export default SiteHeader
