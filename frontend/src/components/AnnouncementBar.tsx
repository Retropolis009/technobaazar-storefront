import { Truck } from 'lucide-react'

function AnnouncementBar({ message = 'DELIVERY ACROSS PAKISTAN' }: { message?: string }) {
  return (
    <div className="flex min-h-[27px] items-center justify-center gap-2 bg-[#173d63] px-4 py-1 text-center text-[9px] font-semibold tracking-[0.1em] text-white sm:min-h-[30px] sm:text-[10px]">
      <Truck size={13} className="text-[#f4c62b]" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export default AnnouncementBar
