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

/** Keeps document title + meta/OG tags in sync with the current page (driven by the CMS SEO fields). */
function SeoHead({ title, description, keywords = '', ogTitle = '', ogDescription = '', ogImage = '', ogType = 'website', canonical = '', noIndex = false }: SeoHeadProps) {
  useEffect(() => {
    document.title = title.trim() || 'TechnoBaazar'
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'keywords', keywords)
    upsertMeta('name', 'robots', noIndex ? 'noindex, nofollow' : '')
    upsertMeta('property', 'og:title', ogTitle || title)
    upsertMeta('property', 'og:description', ogDescription || description)
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('property', 'og:type', ogType)
    upsertMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : '')
    upsertMeta('name', 'twitter:title', ogTitle || title)
    upsertMeta('name', 'twitter:description', ogDescription || description)
    upsertMeta('name', 'twitter:image', ogImage)
    upsertCanonical(canonical)
  }, [title, description, keywords, ogTitle, ogDescription, ogImage, ogType, canonical, noIndex])

  return null
}

export default SeoHead
