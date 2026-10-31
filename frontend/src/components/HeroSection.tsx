import { ArrowRight, BadgeCheck, ShieldCheck, Truck } from 'lucide-react'
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
      document.getElementById(url.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    } else if (url) {
      navigate(url)
    } else {
      onSelectCategory('All gear')
    }
  }

  const assurances = [
    { icon: Truck, title: content.benefits[0]?.title ?? 'Nationwide delivery', detail: content.benefits[0]?.detail ?? content.delivery_note },
    { icon: ShieldCheck, title: content.benefits[1]?.title ?? 'Trusted products', detail: content.benefits[1]?.detail ?? 'Clear details, no surprises.' },
    { icon: BadgeCheck, title: content.benefits[2]?.title ?? 'Local support', detail: content.benefits[2]?.detail ?? 'Help when you need it.' },
  ]

  return (
    <section className="bg-white" aria-label="Nationwide delivery">
      <div className="delivery-hero relative isolate flex min-h-[370px] items-center overflow-hidden bg-[#05080e] sm:min-h-[440px] lg:min-h-[490px]">
        <img src={content.hero_image} alt="" aria-hidden="true" className="absolute inset-0 -z-20 size-full object-cover object-center" fetchPriority="high" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#05080e_0%,rgba(5,8,14,.98)_25%,rgba(5,8,14,.76)_48%,rgba(5,8,14,.08)_100%)]" aria-hidden="true" />
        <div className="mx-auto w-full max-w-[1440px] px-5 py-12 sm:px-10 lg:px-14">
          <div className="max-w-[660px]">
            <p className="inline-flex items-center gap-2 border border-[#f4c62b]/50 bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#f4c62b] sm:text-xs"><Truck size={14}/>{content.hero_eyebrow}</p>
            <h1 className="mt-5 font-display text-[44px] font-extrabold uppercase leading-[0.94] tracking-[-0.055em] text-white sm:text-[64px] lg:text-[76px]">
              <span className="block">{content.hero_title_top}</span>
              <span className="mt-1 block text-[#f4c62b]">{content.hero_title_bottom}{content.hero_title_accent && <span className="ml-2 text-white">{content.hero_title_accent}</span>}</span>
            </h1>
            <p className="mt-5 max-w-[500px] text-sm leading-6 text-white/75 sm:text-base sm:leading-7">{content.hero_subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={handleCta} className="inline-flex h-12 items-center gap-3 bg-[#f4c62b] px-5 text-sm font-bold text-[#101418] transition hover:bg-[#ffda54]">{content.hero_cta_text}<ArrowRight size={17}/></button>
              <button type="button" onClick={() => onSelectCategory('All gear')} className="inline-flex h-12 items-center border border-white/40 px-5 text-sm font-bold text-white transition hover:border-white hover:bg-white/10">Shop categories</button>
            </div>
            <p className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-white/65"><BadgeCheck size={15} className="text-[#f4c62b]"/>{content.hero_social_proof}</p>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-[#f4c62b] via-[#f4c62b]/45 to-transparent" aria-hidden="true" />
      </div>

      <div className="mx-auto grid max-w-[1220px] border-b border-[#e4e6ea] bg-white px-4 sm:grid-cols-3 sm:px-6">
        {assurances.map(({ icon: Icon, title, detail }, index) => <div key={`${title}-${index}`} className="flex items-center gap-3 border-b border-[#eff0f2] px-3 py-4 last:border-0 sm:border-b-0 sm:border-r sm:px-6 sm:py-5 sm:last:border-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#dfe2e7] text-[#1a2532]"><Icon size={19}/></span>
          <span><strong className="block text-xs font-bold text-[#1d2733] sm:text-sm">{title}</strong><span className="mt-0.5 block text-[10px] leading-4 text-[#707984] sm:text-[11px]">{detail}</span></span>
        </div>)}
      </div>
      <div className="delivery-ticker overflow-hidden bg-[#151719] py-2.5 text-[#f4c62b]" aria-label="Delivery and payment information">
        <div className="delivery-ticker-track flex w-max items-center gap-10 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.18em] sm:text-[10px]">
          {[0, 1, 2, 3].map(index => <span key={index} aria-hidden={index !== 0} className="inline-flex items-center gap-3"><Truck size={13}/>{content.delivery_note}<span className="text-white/45">•</span>{content.payment_note}<span className="text-white/45">•</span>Shop TechnoBaazar</span>)}
        </div>
      </div>
    </section>
  )
}

export default HeroSection
