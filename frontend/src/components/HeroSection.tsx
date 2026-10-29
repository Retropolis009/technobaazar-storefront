import { ArrowRight, ArrowUpRight, Cpu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { LandingContent } from '../content'

interface HeroSectionProps {
  content: LandingContent
  onSelectCategory: (category: string) => void
}

function HeroSection({ content, onSelectCategory }: HeroSectionProps) {
  const navigate = useNavigate()

  function handleCta() {
    const url = content.hero_cta_url.trim()
    if (url.startsWith('http') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      window.location.href = url
    } else if (url.startsWith('#')) {
      document.getElementById(url.slice(1))?.scrollIntoView()
    } else if (url) {
      navigate(url)
    } else {
      onSelectCategory('All gear')
    }
  }

  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-8 pt-5 sm:px-7 sm:pt-7 lg:px-10 lg:pb-12">
      <div className="hero-panel relative grid min-h-[520px] overflow-hidden bg-[#315ee8] text-white md:min-h-[500px] md:grid-cols-[0.92fr_1.08fr] lg:min-h-[570px]">
        <div className="hero-lines pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex flex-col items-start justify-center px-6 py-11 sm:px-10 md:px-12 lg:px-[72px]">
          <p className="mb-6 inline-flex items-center gap-2 border border-white/35 px-3 py-1.5 text-[10px] font-bold tracking-[0.17em] text-white sm:text-[11px]">
            <span className="size-1.5 bg-[#c7f464]" />
            {content.hero_eyebrow}
          </p>
          <h1 className="max-w-[560px] font-display text-[48px] font-bold leading-[0.98] tracking-[-0.055em] sm:text-[64px] lg:text-[76px]">
            {content.hero_title_top}
            <br />
            {content.hero_title_bottom} <span className="text-[#c7f464]">{content.hero_title_accent}</span>
          </h1>
          <p className="mt-5 max-w-[410px] text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
            {content.hero_subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCta}
              className="inline-flex h-12 items-center gap-4 bg-[#c7f464] px-5 text-sm font-bold text-[#142c24] transition hover:bg-white"
            >
              {content.hero_cta_text} <ArrowRight size={17} />
            </button>
          </div>
          <div className="mt-9 flex items-center gap-3 text-xs text-white/75">
            <span className="flex -space-x-2" aria-hidden="true">
              <span className="grid size-7 place-items-center rounded-full border-2 border-[#315ee8] bg-[#d2e8e2] text-[9px] font-bold text-[#142c24]">PC</span>
              <span className="grid size-7 place-items-center rounded-full border-2 border-[#315ee8] bg-[#f1bc72] text-[9px] font-bold text-[#142c24]">GS</span>
              <span className="grid size-7 place-items-center rounded-full border-2 border-[#315ee8] bg-[#d8ddff] text-[9px] font-bold text-[#142c24]">+</span>
            </span>
            <span>{content.hero_social_proof}</span>
          </div>
        </div>
        <div className="hero-visual relative min-h-[280px] overflow-hidden md:min-h-0">
          <img
            src={content.hero_image}
            alt={content.hero_image_alt}
            className="absolute inset-0 size-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#315ee8]/45 via-transparent to-[#122451]/10" aria-hidden="true" />
          <div className="absolute bottom-5 left-5 flex items-center gap-3 bg-[#f5f6f2] px-4 py-3 text-[#15201c] sm:bottom-8 sm:left-8">
            <span className="grid size-9 place-items-center bg-[#c7f464]"><Cpu size={19} /></span>
            <span>
              <span className="block text-[9px] font-bold tracking-[0.15em] text-[#69736d]">{content.hero_card_kicker}</span>
              <span className="mt-0.5 block text-sm font-bold">{content.hero_card_title}</span>
            </span>
          </div>
          <span className="absolute right-5 top-5 bg-[#c7f464] px-3 py-2 text-[10px] font-bold tracking-[0.1em] text-[#142c24] sm:right-8 sm:top-8">
            {content.hero_badge} <ArrowUpRight size={12} className="ml-1 inline" />
          </span>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
