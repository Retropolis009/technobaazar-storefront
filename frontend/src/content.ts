import type { Benefit } from './api'

/** Landing-page content served by the backend CMS (GET /api/site-content). */
export interface LandingContent {
  announcement: string
  hero_eyebrow: string
  hero_title_top: string
  hero_title_bottom: string
  hero_title_accent: string
  hero_subtitle: string
  hero_cta_text: string
  hero_cta_url: string
  hero_social_proof: string
  hero_image: string
  hero_image_alt: string
  hero_card_kicker: string
  hero_card_title: string
  hero_badge: string
  departments_kicker: string
  departments_title: string
  featured_kicker: string
  featured_title: string
  featured_subtitle: string
  benefits: Benefit[]
  checkout_note: string
  delivery_note: string
  payment_note: string
  order_confirmation_note: string
  footer_tagline: string
}

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  announcement: 'GOOD GEAR, DELIVERED NATIONWIDE',
  hero_eyebrow: 'THE NEXT BUILD STARTS HERE',
  hero_title_top: 'Make your',
  hero_title_bottom: 'setup',
  hero_title_accent: 'unstoppable.',
  hero_subtitle: 'From your first build to your next big upgrade, find the gear that keeps up with you.',
  hero_cta_text: 'Explore All Gear',
  hero_cta_url: '/collections/all-gear',
  hero_social_proof: 'Picked by people who know their specs.',
  hero_image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1400&q=90',
  hero_image_alt: 'A high-performance gaming PC setup with illuminated components',
  hero_card_kicker: 'YOUR NEXT UPGRADE',
  hero_card_title: 'Starts with one part.',
  hero_badge: 'BUILD YOUR WAY',
  departments_kicker: 'Find your frequency',
  departments_title: 'Shop by department',
  featured_kicker: 'The good stuff',
  featured_title: 'Worth a closer look.',
  featured_subtitle: 'Hand-picked tech for work, play, and everything between.',
  benefits: [
    { title: 'Across Pakistan', detail: 'Carefully packed, right to your door.' },
    { title: 'Gear you can trust', detail: 'Authentic products with local warranty.' },
    { title: 'Real human help', detail: 'Get advice before you hit checkout.' },
  ],
  checkout_note: 'Cash on delivery available. Final stock and prices are confirmed by the store.',
  delivery_note: 'Nationwide delivery across Pakistan.',
  payment_note: 'Pay cash on delivery, or transfer to the account shared after checkout.',
  order_confirmation_note: 'After your order, our team contacts you by phone or WhatsApp to confirm delivery.',
  footer_tagline: 'Good gear for whatever you\u2019re building.',
}

function parseBenefits(raw: unknown): Benefit[] {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(value)) return DEFAULT_LANDING_CONTENT.benefits
    const cleaned = value
      .filter((item): item is Benefit => !!item && typeof item.title === 'string' && typeof item.detail === 'string')
      .map((item) => ({ title: item.title, detail: item.detail }))
    return cleaned.length ? cleaned : DEFAULT_LANDING_CONTENT.benefits
  } catch {
    return DEFAULT_LANDING_CONTENT.benefits
  }
}

/** Merge raw CMS content over the defaults so the storefront never renders blank. */
export function normalizeLandingContent(raw: unknown): LandingContent {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const content = { ...DEFAULT_LANDING_CONTENT }
  for (const key of Object.keys(DEFAULT_LANDING_CONTENT) as Array<keyof LandingContent>) {
    if (key === 'benefits') continue
    const value = source[key]
    if (typeof value === 'string' && value.trim()) content[key] = value as never
  }
  content.benefits = parseBenefits(source.benefits)
  return content
}
