import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/workspace/', '/profile/', '/m/'],
    },
    sitemap: 'https://buildvideo.ai/sitemap.xml',
  }
}
