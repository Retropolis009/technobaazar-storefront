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
  const arrivals = products.filter(product => NEW_ARRIVAL_BADGE.test(product.badge || '')).slice(0, 12)

  const move = useCallback((direction: -1 | 1) => {
    const element = track.current
    if (!element || element.scrollWidth <= element.clientWidth) return
    const firstCard = element.querySelector<HTMLElement>('[data-arrival-card]')
    const step = firstCard ? firstCard.offsetWidth : element.clientWidth / 2
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
    if (paused || arrivals.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => move(1), 4500)
    return () => window.clearInterval(timer)
  }, [paused, arrivals.length, move])

  if (!arrivals.length) return null

  return (
    <section className="bg-white py-8 sm:py-10" aria-labelledby="new-arrivals-heading">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-7 lg:px-10">
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-[#e5e8ec] pb-4">
          <div>
            <p className="section-kicker inline-flex items-center gap-1.5"><Sparkles size={13}/>Recently added to the catalog</p>
            <h2 id="new-arrivals-heading" className="section-heading">New Arrivals</h2>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => move(-1)} aria-label="Previous new arrivals" className="grid size-9 place-items-center border border-[#d8dde5] bg-white text-[#293644] hover:border-[#2b64d8] hover:text-[#2b64d8]"><ArrowLeft size={16}/></button>
            <button type="button" onClick={() => move(1)} aria-label="Next new arrivals" className="grid size-9 place-items-center border border-[#d8dde5] bg-white text-[#293644] hover:border-[#2b64d8] hover:text-[#2b64d8]"><ArrowRight size={16}/></button>
          </div>
        </div>
        <div
          ref={track}
          className="new-arrivals-track -mx-1.5 flex overflow-x-auto scroll-smooth"
          role="region"
          aria-label="New arrivals carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false) }}
        >
          {arrivals.map(product => <div key={product.slug} data-arrival-card className="w-1/2 shrink-0 snap-start px-1.5">
            <ProductCard compact product={product} isFavorite={favorites.includes(product.slug)} onAddToCart={onAddToCart} onToggleFavorite={onToggleFavorite}/>
          </div>)}
        </div>
      </div>
    </section>
  )
}

export default NewArrivalsCarousel
