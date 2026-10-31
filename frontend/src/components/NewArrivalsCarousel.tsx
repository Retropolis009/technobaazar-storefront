import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import type { Product } from '../catalog'
import ProductCard from './ProductCard'

interface NewArrivalsCarouselProps {
  products: Product[]
  favorites: string[]
  onAddToCart: (product: Product) => void
  onToggleFavorite: (productName: string) => void
}

const NEW_ARRIVAL_BADGE = /\b(new|new arrival|new listing|just landed)\b/i

function NewArrivalsCarousel({ products, favorites, onAddToCart, onToggleFavorite }: NewArrivalsCarouselProps) {
  const track = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const [canScroll, setCanScroll] = useState(false)
  const arrivals = products.filter(product => NEW_ARRIVAL_BADGE.test(product.badge || '')).slice(0, 12)

  const move = useCallback((direction: -1 | 1) => {
    const element = track.current
    if (!element || element.scrollWidth <= element.clientWidth) return
    const firstCard = element.querySelector<HTMLElement>('[data-arrival-card]')
    const gap = Number.parseFloat(window.getComputedStyle(element).columnGap) || 0
    const step = firstCard ? firstCard.offsetWidth + gap : element.clientWidth / 2
    const lastPosition = element.scrollWidth - element.clientWidth
    if (direction > 0 && element.scrollLeft >= lastPosition - 8) {
      element.scrollTo({ left: 0, behavior: 'smooth' })
    } else if (direction < 0 && element.scrollLeft <= 8) {
      element.scrollTo({ left: lastPosition, behavior: 'smooth' })
    } else {
      element.scrollBy({ left: step * direction, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    const element = track.current
    if (!element) return
    const updateScrollState = () => setCanScroll(element.scrollWidth > element.clientWidth + 1)
    updateScrollState()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateScrollState)
    observer?.observe(element)
    Array.from(element.children).forEach(card => observer?.observe(card))
    window.addEventListener('resize', updateScrollState)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateScrollState)
    }
  }, [arrivals.length])

  useEffect(() => {
    if (paused || !canScroll || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => move(1), 4500)
    return () => window.clearInterval(timer)
  }, [paused, canScroll, move])

  if (arrivals.length < 2) return null

  return (
    <section className="bg-white py-8 sm:py-10" aria-labelledby="new-arrivals-heading">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-7 lg:px-10">
        <div className="mb-4 border-b border-[#e5e8ec] pb-4">
          <p className="section-kicker inline-flex items-center gap-1.5"><Sparkles size={13}/>Recently added to the catalog</p>
          <h2 id="new-arrivals-heading" className="section-heading">New Arrivals</h2>
        </div>
        <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false) }}>
          <div
            ref={track}
            className="new-arrivals-track flex gap-2.5 overflow-x-auto scroll-smooth"
            role="region"
            aria-label="New arrivals carousel"
          >
            {arrivals.map(product => <div key={product.slug} data-arrival-card className="new-arrival-card shrink-0 snap-start">
              <ProductCard product={product} isFavorite={favorites.includes(product.slug)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite}/>
            </div>)}
          </div>
          {canScroll && <button type="button" onClick={() => move(-1)} aria-label="Previous new arrivals" className="absolute left-1 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#d8dde5] bg-white/95 text-[#293644] shadow-md transition hover:border-[#2b64d8] hover:text-[#2b64d8] sm:left-2"><ArrowLeft size={16}/></button>}
          {canScroll && <button type="button" onClick={() => move(1)} aria-label="Next new arrivals" className="absolute right-1 top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-[#d8dde5] bg-white/95 text-[#293644] shadow-md transition hover:border-[#2b64d8] hover:text-[#2b64d8] sm:right-2"><ArrowRight size={16}/></button>}
        </div>
      </div>
    </section>
  )
}

export default NewArrivalsCarousel
