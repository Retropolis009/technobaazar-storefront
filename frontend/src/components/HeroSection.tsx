import { ArrowRight, BadgeCheck, Cpu, ShieldCheck, Truck } from 'lucide-react'
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

  return (
    <section className="mx-auto max-w-[1440px] px-4 pb-7 pt-5 sm:px-7 sm:pt-7 lg:px-10 lg:pb-10">
      <div className="relative grid overflow-hidden border border-[#dfe4dc] bg-white lg:min-h-[500px] lg:grid-cols-[1fr_1.08fr]">
        <div className="relative z-10 flex flex-col items-start justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14 xl:px-[72px]">
          <p className="inline-flex items-center gap-2 rounded-sm bg-[#edf3ff] px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] text-[#2451aa] sm:text-[11px]">
            <span className="size-1.5 rounded-full bg-[#315ee8]" />{content.hero_eyebrow}
          </p>
          <h1 className="mt-5 max-w-[600px] font-display text-[42px] font-bold leading-[1.02] tracking-[-0.055em] sm:text-[58px] xl:text-[68px]">
            {content.hero_title_top} {content.hero_title_bottom} <span className="text-[#315ee8]">{content.hero_title_accent}</span>
          </h1>
          <p className="mt-5 max-w-[460px] text-sm leading-6 text-[#5b665e] sm:text-base sm:leading-7">{content.hero_subtitle}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleCta} className="inline-flex h-12 items-center gap-3 rounded-sm bg-[#244fa7] px-5 text-sm font-bold text-white transition hover:bg-[#173d88]">
              {content.hero_cta_text}<ArrowRight size={17}/>
            </button>
            <button type="button" onClick={() => onSelectCategory('All gear')} className="inline-flex h-12 items-center gap-2 px-3 text-sm font-bold text-[#243148] hover:text-[#315ee8]">
              Shop all categories<ArrowRight size={15}/>
            </button>
          </div>
          <p className="mt-7 inline-flex items-center gap-2 text-xs font-semibold text-[#59645d]"><BadgeCheck size={16} className="text-[#315ee8]"/>{content.hero_social_proof}</p>
        </div>

        <div className="relative min-h-[270px] overflow-hidden bg-[#edf2fb] sm:min-h-[360px] lg:min-h-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_40%,#fff_0,transparent_42%),linear-gradient(135deg,#eaf0fb,#dce6f6)]" aria-hidden="true"/>
          <div className="pointer-events-none absolute right-8 top-8 size-44 rounded-full border border-[#315ee8]/10 sm:right-14 sm:top-12 sm:size-64" aria-hidden="true"/>
          <img src={content.hero_image} alt={content.hero_image_alt} className="absolute inset-0 size-full object-cover object-center mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#edf2fb]/40 via-transparent to-[#142c24]/10" aria-hidden="true"/>
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 sm:bottom-7 sm:left-7 sm:right-7">
            <div className="flex items-center gap-3 border border-white/70 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm">
              <span className="grid size-10 place-items-center rounded-sm bg-[#edf3ff] text-[#244fa7]"><Cpu size={20}/></span>
              <span><span className="block text-[9px] font-bold uppercase tracking-[0.13em] text-[#647065]">{content.hero_card_kicker}</span><span className="mt-0.5 block text-sm font-bold text-[#15201c]">{content.hero_card_title}</span></span>
            </div>
            <span className="hidden items-center gap-2 bg-[#244fa7] px-3 py-2 text-[10px] font-bold tracking-[0.08em] text-white sm:inline-flex"><ShieldCheck size={14}/>{content.hero_badge}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 border-x border-b border-[#dfe4dc] bg-white sm:grid-cols-3">
        {[
          { icon: Truck, title: content.benefits[0]?.title ?? 'Delivery across Pakistan', detail: content.benefits[0]?.detail ?? content.delivery_note },
          { icon: ShieldCheck, title: content.benefits[1]?.title ?? 'Warranty support', detail: content.benefits[1]?.detail ?? 'Shop with confidence.' },
          { icon: BadgeCheck, title: content.benefits[2]?.title ?? 'Local customer care', detail: content.benefits[2]?.detail ?? 'We are here to help.' },
        ].map(({ icon: Icon, title, detail }) => <div key={title} className="flex items-center gap-3 border-b border-[#edf0eb] px-4 py-3.5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#edf3ff] text-[#244fa7]"><Icon size={17}/></span><span className="min-w-0"><strong className="block truncate text-xs text-[#18243a]">{title}</strong><span className="mt-0.5 block truncate text-[10px] text-[#6b756d]">{detail}</span></span>
        </div>)}
      </div>
    </section>
  )
}

export default HeroSection
