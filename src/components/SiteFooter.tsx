import { ArrowUpRight, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

function SiteFooter() {
  return (
    <footer className="bg-[#142c24] text-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-7 lg:px-10">
        <Link to="/" className="flex items-center gap-2.5" aria-label="TechnoBaazar home">
          <span className="grid size-8 place-items-center bg-[#c7f464] text-[#142c24]">
            <Zap size={17} fill="currentColor" />
          </span>
          <span className="font-display text-sm font-bold tracking-[-0.04em]">TECHNOBAAZAR</span>
        </Link>
        <p className="text-xs text-white/55">Good gear for whatever you’re building. © 2026 TechnoBaazar.</p>
        <div className="flex items-center gap-5">
          <Link to="/admin" className="text-xs font-semibold text-white/65 hover:text-white">Admin</Link>
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[#c7f464]">
            Back to home <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
