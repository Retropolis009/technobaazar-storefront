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
  seo_google_verification: string
  seo_bing_verification: string
  seo_ga_measurement_id: string
  seo_gtm_id: string
  seo_meta_pixel_id: string
  seo_twitter_handle: string
  seo_facebook_url: string
  seo_instagram_url: string
  seo_youtube_url: string
  seo_org_name: string
  seo_org_phone: string
  seo_org_address: string
  seo_robots_txt: string
  seo_about_title: string
  seo_about_description: string
  seo_cart_title: string
  seo_cart_description: string
  seo_favorites_title: string
  seo_favorites_description: string
  seo_account_title: string
  seo_account_description: string
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
  header_brand_prefix: 'TECHNO',
  header_brand_accent: 'BAAZAR',
  header_tagline: 'SUPPLY CO.',
  header_search_placeholder: 'Search laptops, components, gear...',
  header_mobile_search_placeholder: 'Search the store',
  header_about_text: 'Why TechnoBaazar',
  footer_brand_text: 'TECHNOBAAZAR',
  footer_tagline: 'Good gear for whatever you\u2019re building.',
  footer_admin_text: 'Admin',
  footer_home_text: 'Back to home',
  seo_site_title: 'TechnoBaazar — Computer Store in Pakistan',
  seo_site_description: 'Shop graphics cards, processors, laptops, and gaming gear online in Pakistan with nationwide delivery and local warranty.',
  seo_site_keywords: 'computer store pakistan, gaming pc, graphics cards, laptops, processors, technobaazar',
  seo_og_image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80',
  seo_canonical_base: '',
  seo_google_verification: '',
  seo_bing_verification: '',
  seo_ga_measurement_id: '',
  seo_gtm_id: '',
  seo_meta_pixel_id: '',
  seo_twitter_handle: '',
  seo_facebook_url: '',
  seo_instagram_url: '',
  seo_youtube_url: '',
  seo_org_name: 'TechnoBaazar',
  seo_org_phone: '',
  seo_org_address: '',
  seo_robots_txt: 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /account',
  seo_about_title: '',
  seo_about_description: '',
  seo_cart_title: '',
  seo_cart_description: '',
  seo_favorites_title: '',
  seo_favorites_description: '',
  seo_account_title: '',
  seo_account_description: '',
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
