import { Check, X } from 'lucide-react'

interface ToastNoticeProps {
  message: string
  onDismiss: () => void
}

function ToastNotice({ message, onDismiss }: ToastNoticeProps) {
  if (!message) return null

  return (
    <div
      className="fixed bottom-5 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 bg-[#142c24] px-4 py-3 text-sm text-white shadow-xl sm:right-6"
      role="status"
    >
      <span className="grid size-6 shrink-0 place-items-center bg-[#c7f464] text-[#142c24]"><Check size={14} /></span>
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="ml-1 text-white/70 hover:text-white">
        <X size={16} />
      </button>
    </div>
  )
}

export default ToastNotice