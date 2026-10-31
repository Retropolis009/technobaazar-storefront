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
  announcement: 'DELIVERY ACROSS PAKISTAN  •  CASH ON DELIVERY AVAILABLE',
  hero_eyebrow: 'WE DELIVER ACROSS PAKISTAN',
  hero_title_top: 'ALL OVER',
  hero_title_bottom: 'PAKISTAN',
  hero_title_accent: '',
  hero_subtitle: 'Order computer components, laptops, and everyday tech online. Explore the TechnoBaazar catalog and get your gear delivered across Pakistan.',
  hero_cta_text: 'Shop computer gear',
  hero_cta_url: '/collections/all-gear',
  hero_social_proof: 'Browse current products with clear pricing and availability.',
  hero_image: '/images/pakistan-delivery-hero.jpg',
  hero_image_alt: 'Gold delivery routes across Pakistan alongside computer hardware',
  hero_card_kicker: 'TECHNOBAAZAR STORE',
  hero_card_title: 'Computer gear, delivered.',
  hero_badge: 'SHOP THE CATALOG',
  departments_kicker: 'Explore the store',
  departments_title: 'Shop by category',
  featured_kicker: 'From the catalog',
  featured_title: 'Find your next upgrade.',
  featured_subtitle: 'Explore computer components, laptops, and accessories currently listed by TechnoBaazar.',
  benefits: [
    { title: 'Across Pakistan', detail: 'Carefully packed delivery to your door.' },
    { title: 'Easy ways to pay', detail: 'Cash on delivery and bank transfer.' },
    { title: 'Clear product details', detail: 'Compare specs and availability before ordering.' },
  ],
  checkout_note: 'Cash on delivery is available. Final stock and prices are confirmed by the store.',
  delivery_note: 'Delivery across Pakistan.',
  payment_note: 'Cash on delivery and bank transfer are available.',
  order_confirmation_note: 'After your order, our team contacts you to confirm delivery.',
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
  seo_site_title: 'Computer Parts & Laptops Online in Pakistan | TechnoBaazar',
  seo_site_description: 'Shop PC components, laptops, monitors, and accessories at TechnoBaazar. Compare specs, prices, and availability, with delivery across Pakistan.',
  seo_site_keywords: 'computer parts Pakistan, laptops online Pakistan, computer accessories, processors, graphics cards, monitors, TechnoBaazar',
  seo_og_image: '/images/pakistan-delivery-hero.jpg',
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
