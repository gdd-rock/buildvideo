import type { MetadataRoute } from 'next'

const BASE_URL = 'https://buildvideo.ai'
const locales = ['zh', 'en']

export default function sitemap(): MetadataRoute.Sitemap {
  const publicRoutes = ['', '/auth/signin', '/auth/signup']
  const entries: MetadataRoute.Sitemap = []

  for (const route of publicRoutes) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'weekly' : 'monthly',
        priority: route === '' ? 1.0 : 0.5,
      })
    }
  }

  return entries
}
