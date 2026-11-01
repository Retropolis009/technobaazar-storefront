import { CreditCard, PackageCheck, Truck, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DEFAULT_LANDING_CONTENT, type LandingContent } from '../content'

function SiteFooter({ content = DEFAULT_LANDING_CONTENT }: { content?: LandingContent }) {
  return (
    <footer className="mt-10 bg-[#202124] text-white">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.45fr_.8fr_.8fr_1fr] lg:gap-12 lg:px-10 lg:py-12">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label={`${content.footer_brand_text} home`}>
            <span className="grid size-8 place-items-center bg-[#f4c62b] text-[#202124]"><Zap size={17} fill="currentColor"/></span>
            <span className="font-display text-base font-bold tracking-[-0.04em]">{content.footer_brand_text}</span>
          </Link>
          <p className="mt-4 max-w-sm text-xs leading-6 text-white/65">{content.footer_tagline}</p>
          <p className="mt-3 max-w-sm text-[11px] leading-5 text-white/50">TechnoBaazar brings together computer components, laptops, and everyday technology from the store catalog.</p>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.13em]">Shop</h2>
          <ul className="mt-4 space-y-2.5 text-xs text-white/65">
            <li><Link to="/collections/all-gear" className="hover:text-[#f4c62b]">All products</Link></li>
            <li><Link to="/favorites" className="hover:text-[#f4c62b]">Saved favorites</Link></li>
            <li><Link to="/cart" className="hover:text-[#f4c62b]">Shopping cart</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.13em]">Information</h2>
          <ul className="mt-4 space-y-2.5 text-xs text-white/65">
            <li><Link to="/about" className="hover:text-[#f4c62b]">About TechnoBaazar</Link></li>
            <li><Link to="/account" className="hover:text-[#f4c62b]">My account</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.13em]">Order with confidence</h2>
          <ul className="mt-4 space-y-3 text-[11px] leading-5 text-white/65">
            <li className="flex items-start gap-2"><Truck size={15} className="mt-0.5 shrink-0 text-[#f4c62b]"/>{content.delivery_note}</li>
            <li className="flex items-start gap-2"><CreditCard size={15} className="mt-0.5 shrink-0 text-[#f4c62b]"/>{content.payment_note}</li>
            <li className="flex items-start gap-2"><PackageCheck size={15} className="mt-0.5 shrink-0 text-[#f4c62b]"/>Check product details and availability before ordering.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-4 text-[10px] text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>© 2026 TechnoBaazar. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
