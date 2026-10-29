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
  googleVerification?: string
  bingVerification?: string
  twitterHandle?: string
  gaMeasurementId?: string
  gtmId?: string
  metaPixelId?: string
  jsonLd?: string
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

function upsertScript(id: string, src: string | null, inline: string | null) {
  const existing = document.head.querySelector(`script[data-seo="${id}"]`)
  if (!src && !inline) {
    existing?.remove()
    return
  }
  if (existing) return // already loaded; analytics snippets must not reload per page
  const tag = document.createElement('script')
  tag.setAttribute('data-seo', id)
  if (src) {
    tag.async = true
    tag.src = src
  } else if (inline) {
    tag.textContent = inline
  }
  document.head.appendChild(tag)
}

function upsertJsonLd(payload: string) {
  const existing = document.head.querySelector('script[data-seo="jsonld"]')
  const trimmed = payload.trim()
  if (!trimmed) {
    existing?.remove()
    return
  }
  const tag = existing ?? document.createElement('script')
  tag.setAttribute('type', 'application/ld+json')
  tag.setAttribute('data-seo', 'jsonld')
  if (tag.textContent !== trimmed) tag.textContent = trimmed
  if (!existing) document.head.appendChild(tag)
}

/** Keeps document title + meta/OG tags in sync with the current page (driven by the CMS SEO fields). */
function SeoHead({
  title, description, keywords = '', ogTitle = '', ogDescription = '', ogImage = '',
  ogType = 'website', canonical = '', noIndex = false, googleVerification = '', bingVerification = '',
  twitterHandle = '', gaMeasurementId = '', gtmId = '', metaPixelId = '', jsonLd = '',
}: SeoHeadProps) {
  useEffect(() => {
    document.title = title.trim() || 'TechnoBaazar'
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'keywords', keywords)
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : '')
    upsertMeta('name', 'google-site-verification', googleVerification)
    upsertMeta('name', 'msvalidate.01', bingVerification)
    upsertMeta('property', 'og:title', ogTitle || title)
    upsertMeta('property', 'og:description', ogDescription || description)
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('property', 'og:type', ogType)
    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : '')
    upsertMeta('name', 'twitter:title', ogTitle || title)
    upsertMeta('name', 'twitter:description', ogDescription || description)
    upsertMeta('name', 'twitter:image', ogImage)
    upsertMeta('name', 'twitter:site', twitterHandle)
    upsertCanonical(canonical)
    upsertJsonLd(jsonLd)
  }, [title, description, keywords, ogTitle, ogDescription, ogImage, ogType, canonical, noIndex,
    googleVerification, bingVerification, twitterHandle, jsonLd])

  useEffect(() => {
    const gaId = gaMeasurementId.trim()
    upsertScript('ga-src', gaId ? `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}` : null, null)
    upsertScript('ga-inline', null, gaId
      ? `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId.replace(/'/g, '')}');`
      : null)
    const container = gtmId.trim()
    upsertScript('gtm-inline', null, container
      ? `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${container.replace(/'/g, '')}');`
      : null)
    const pixel = metaPixelId.trim()
    upsertScript('pixel-inline', null, pixel
      ? `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel.replace(/'/g, '')}');fbq('track','PageView');`
      : null)
  }, [gaMeasurementId, gtmId, metaPixelId])

  return null
}

export default SeoHead
