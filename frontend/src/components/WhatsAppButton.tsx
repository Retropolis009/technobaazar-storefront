import { MessageCircle, Phone } from 'lucide-react'

const WHATSAPP_HOSTS = new Set(['wa.me', 'api.whatsapp.com', 'web.whatsapp.com', 'whatsapp.com', 'www.whatsapp.com', 'chat.whatsapp.com'])

function safeWhatsAppUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' && WHATSAPP_HOSTS.has(url.hostname.toLowerCase()) ? url.href : ''
  } catch {
    return ''
  }
}

function WhatsAppButton({ url }: { url: string }) {
  const href = safeWhatsAppUrl(url)
  if (!href) return null

  return <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with TechnoBaazar on WhatsApp"
    title="Chat with us on WhatsApp"
    className="whatsapp-float fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_5px_18px_rgba(0,0,0,.24)] transition hover:scale-105 hover:bg-[#1db954] focus-visible:outline-white"
  >
    <MessageCircle size={31} strokeWidth={1.8} aria-hidden="true" />
    <Phone size={13} strokeWidth={3} className="absolute" aria-hidden="true" />
    <span className="sr-only">Opens WhatsApp in a new tab</span>
  </a>
}

export default WhatsAppButton
