import { useEffect } from 'react'

interface SeoHeadProps {
  title: string
  description: string
  keywords?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogType?: string
  canonical?: string
  noIndex?: boolean
  settings?: Record<string, string>
  productData?: { name: string; description: string; image: string; slug: string; brand: string; price: number; inStock: boolean }
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`
  const trimmed = content.trim()
  const existing = document.head.querySelector(selector)
  if (!trimmed) {
    existing?.remove()
    return
  }
  const tag = existing ?? document.createElement('meta')
  tag.setAttribute(attribute, key)
  tag.setAttribute('content', trimmed)
  if (!existing) document.head.appendChild(tag)
}

function absoluteImageUrl(image: string) {
  if (!image || image.startsWith('data:')) return undefined
  try {
    return new URL(image, window.location.origin).href
  } catch {
    return undefined
  }
}

function upsertCanonical(url: string) {
  const trimmed = url.trim()
  const existing = document.head.querySelector('link[rel="canonical"]')
  if (!trimmed) {
    existing?.remove()
    return
  }
  const link = existing ?? document.createElement('link')
  link.setAttribute('rel', 'canonical')
  link.setAttribute('href', trimmed)
  if (!existing) document.head.appendChild(link)
}

/** Keeps document title + meta/OG tags in sync with the current page (driven by the CMS SEO fields). */
function SeoHead({ title, description, keywords = '', ogTitle = '', ogDescription = '', ogImage = '', ogType = 'website', canonical = '', noIndex = false, settings = {}, productData }: SeoHeadProps) {
  useEffect(() => {
    document.title = title.trim() || 'TechnoBaazar'
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'keywords', keywords)
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : '')
    upsertMeta('property', 'og:title', ogTitle || title)
    upsertMeta('property', 'og:description', ogDescription || description)
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('property', 'og:type', ogType)
    upsertMeta('property', 'og:site_name', settings.seo_business_name || 'TechnoBaazar')
    upsertMeta('property', 'product:price:amount', productData ? String(productData.price) : '')
    upsertMeta('property', 'product:price:currency', productData ? 'PKR' : '')
    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : '')
    upsertMeta('name', 'twitter:title', ogTitle || title)
    upsertMeta('name', 'twitter:description', ogDescription || description)
    upsertMeta('name', 'twitter:image', ogImage)
    upsertMeta('name', 'twitter:site', settings.seo_twitter_handle ?? '')
    upsertCanonical(canonical)
    upsertMeta('name', 'google-site-verification', settings.seo_google_verification ?? '')
    upsertMeta('name', 'msvalidate.01', settings.seo_bing_verification ?? '')

    const trackedNodes: HTMLElement[] = []
    const addScript = (id: string, src: string, async = true) => {
      const script = document.createElement('script')
      script.id = id; script.src = src; script.async = async
      document.head.appendChild(script); trackedNodes.push(script)
    }
    const analyticsId = settings.seo_google_analytics_id ?? ''
    if (!noIndex && /^G-[A-Z0-9]+$/.test(analyticsId)) {
      addScript('tb-google-analytics', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`)
      const config = document.createElement('script')
      config.id = 'tb-google-analytics-config'
      config.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analyticsId}');`
      document.head.appendChild(config); trackedNodes.push(config)
    }
    const tagManagerId = settings.seo_google_tag_manager_id ?? ''
    if (!noIndex && /^GTM-[A-Z0-9]+$/.test(tagManagerId)) addScript('tb-google-tag-manager', `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(tagManagerId)}`)
    const pixelId = settings.seo_meta_pixel_id ?? ''
    if (!noIndex && /^[0-9]{5,20}$/.test(pixelId)) {
      const pixel = document.createElement('script')
      pixel.id = 'tb-meta-pixel'
      pixel.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`
      document.head.appendChild(pixel); trackedNodes.push(pixel)
    }
    if (!noIndex) {
      const businessName = settings.seo_business_name || 'TechnoBaazar'
      const sameAs = ['facebook', 'instagram', 'tiktok', 'youtube', 'x'].map(network => settings[`seo_social_${network}`]).filter(Boolean)
      const structuredData = [
        { '@context': 'https://schema.org', '@type': 'WebSite', name: businessName, url: canonical || settings.seo_canonical_base || undefined },
        { '@context': 'https://schema.org', '@type': 'Store', name: businessName, legalName: settings.seo_business_legal_name || undefined,
          url: settings.seo_canonical_base || undefined, logo: settings.seo_business_logo || undefined,
          telephone: settings.seo_business_phone || undefined, email: settings.seo_business_email || undefined,
          sameAs: sameAs.length ? sameAs : undefined,
          address: settings.seo_business_street || settings.seo_business_city ? { '@type': 'PostalAddress',
            streetAddress: settings.seo_business_street || undefined, addressLocality: settings.seo_business_city || undefined,
            addressRegion: settings.seo_business_region || undefined, postalCode: settings.seo_business_postal_code || undefined,
            addressCountry: settings.seo_business_country || 'PK' } : undefined },
        ...(productData ? [{
          '@context': 'https://schema.org', '@type': 'Product', name: productData.name,
          description: productData.description, sku: productData.slug,
          image: absoluteImageUrl(productData.image),
          brand: { '@type': 'Brand', name: productData.brand },
          offers: {
            '@type': 'Offer', url: canonical || window.location.href, priceCurrency: 'PKR',
            price: String(productData.price), availability: `https://schema.org/${productData.inStock ? 'InStock' : 'OutOfStock'}`,
            itemCondition: 'https://schema.org/NewCondition',
          },
        }] : []),
      ]
      const jsonLd = document.createElement('script')
      jsonLd.type = 'application/ld+json'; jsonLd.id = 'tb-business-jsonld'
      jsonLd.textContent = JSON.stringify(structuredData).replace(/</g, '\\u003c')
      document.head.appendChild(jsonLd); trackedNodes.push(jsonLd)
    }
    return () => trackedNodes.forEach(node => node.remove())
  }, [title, description, keywords, ogTitle, ogDescription, ogImage, ogType, canonical, noIndex, settings, productData])

  return null
}

export default SeoHead
