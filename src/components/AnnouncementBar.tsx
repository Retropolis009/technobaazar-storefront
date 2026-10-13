import { Zap } from 'lucide-react'

function AnnouncementBar() {
  return (
    <div className="flex min-h-9 items-center justify-center gap-2 bg-[#142c24] px-4 text-center text-[11px] font-semibold tracking-[0.08em] text-white sm:text-xs">
      <Zap size={13} className="text-[#c7f464]" aria-hidden="true" />
      <span>GOOD GEAR, DELIVERED NATIONWIDE</span>
      <span className="hidden text-white/40 sm:inline">/</span>
      <span className="hidden text-white/75 sm:inline">Free delivery over Rs. 25,000</span>
    </div>
  )
}

export default AnnouncementBar