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
  header_brand_prefix: string
  header_brand_accent: string
  header_tagline: string
  header_search_placeholder: string
  header_mobile_search_placeholder: string
  header_about_text: string
  footer_brand_text: string
  footer_tagline: string
  footer_admin_text: string
  footer_home_text: string
  seo_site_title: string
  seo_site_description: string
  seo_site_keywords: string
  seo_og_image: string
  seo_canonical_base: string
}

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  announcement: 'GOOD GEAR, DELIVERED NATIONWIDE',
  hero_eyebrow: 'PC PARTS, LAPTOPS & MORE',
  hero_title_top: 'Build your',
  hero_title_bottom: 'next',
  hero_title_accent: 'great setup.',
  hero_subtitle: 'Explore computer components, laptops, gaming gear, and everyday tech. Compare specifications and find what fits your setup.',
  hero_cta_text: 'Shop the catalog',
  hero_cta_url: '/collections/all-gear',
  hero_social_proof: 'Browse the current catalog and compare your options.',
  hero_image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1400&q=90',
  hero_image_alt: 'A high-performance gaming PC setup with illuminated components',
  hero_card_kicker: 'TECHNOBAAZAR STORE',
  hero_card_title: 'Parts for every setup.',
  hero_badge: 'SHOP BY CATEGORY',
  departments_kicker: 'Browse the store',
  departments_title: 'Shop by category',
  featured_kicker: 'Featured products',
  featured_title: 'Find the right gear for your setup.',
  featured_subtitle: 'Compare current computer components, laptops, and accessories from the store catalog.',
  benefits: [
    { title: 'Across Pakistan', detail: 'Carefully packed, right to your door.' },
    { title: 'Gear you can trust', detail: 'Authentic products with local warranty.' },
    { title: 'Real human help', detail: 'Get advice before you hit checkout.' },
  ],
  checkout_note: 'Cash on delivery available. Final stock and prices are confirmed by the store.',
  delivery_note: 'Nationwide delivery across Pakistan.',
  payment_note: 'Pay cash on delivery, or transfer to the account shared after checkout.',
  order_confirmation_note: 'After your order, our team contacts you by phone or WhatsApp to confirm delivery.',
  header_brand_prefix: 'TECHNO',
  header_brand_accent: 'BAAZAR',
  header_tagline: 'COMPUTERS & TECH',
  header_search_placeholder: 'Search products, brands, and categories...',
  header_mobile_search_placeholder: 'Search products and brands',
  header_about_text: 'Why TechnoBaazar',
  footer_brand_text: 'TECHNOBAAZAR',
  footer_tagline: 'Good gear for whatever you\u2019re building.',
  footer_admin_text: 'Admin',
  footer_home_text: 'Back to home',
  seo_site_title: 'TechnoBaazar | Computer Parts, Laptops & Gaming PCs in Pakistan',
  seo_site_description: 'Shop computer components, gaming PCs, laptops, and accessories at TechnoBaazar. Compare specifications and prices, with nationwide delivery across Pakistan.',
  seo_site_keywords: 'computer store pakistan, computer components, gaming pc, laptops, graphics cards, processors, monitors, technobaazar',
  seo_og_image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80',
  seo_canonical_base: '',
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
