'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/icons'

interface CharacterItem {
  id: string
  name: string
  aliases: string | null
  profileConfirmed: boolean
  voiceType: string | null
  createdAt: string
  folder: { name: string } | null
  appearances: { imageUrl: string | null; description: string | null }[]
}

interface LocationItem {
  id: string
  name: string
  summary: string | null
  createdAt: string
  folder: { name: string } | null
  images: { imageUrl: string | null; description: string | null }[]
}

interface VoiceItem {
  id: string
  name: string
  description: string | null
  voiceType: string
  gender: string | null
  language: string
  createdAt: string
  folder: { name: string } | null
}

interface AssetsData {
  userName: string
  characters: CharacterItem[]
  locations: LocationItem[]
  voices: VoiceItem[]
}

export default function AdminUserAssets() {
  const t = useTranslations('admin')
  const params = useParams()
  const userId = (params?.id ?? '') as string

  const [data, setData] = useState<AssetsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/assets`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch { /* ignore */ }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AppIcon name="loader" className="w-8 h-8 animate-spin text-[var(--glass-text-tertiary)]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link href={`/admin/users/${userId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors">
          <AppIcon name="arrowRight" className="w-4 h-4 rotate-180" />
          {t('userAssets.back')}
        </Link>
        <div className="glass-surface rounded-2xl p-8 text-center text-[var(--glass-text-tertiary)]">{t('common.noData')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/users/${userId}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors">
          <AppIcon name="arrowRight" className="w-4 h-4 rotate-180" />
          {t('userAssets.back')}
        </Link>
        <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">
          {data.userName} - {t('userAssets.title')}
        </h1>
      </div>

      {/* Characters */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
          {t('userAssets.characters')} ({data.characters.length})
        </h2>
        {data.characters.length === 0 ? (
          <div className="glass-surface rounded-2xl p-6 text-center text-sm text-[var(--glass-text-tertiary)]">{t('common.noData')}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.characters.map(c => {
              const img = c.appearances[0]?.imageUrl
              return (
                <div key={c.id} className="glass-surface rounded-xl overflow-hidden">
                  <div className="aspect-square bg-[var(--glass-bg-muted)] flex items-center justify-center">
                    {img ? (
                      <img src={img} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <AppIcon name="user" className="w-8 h-8 text-[var(--glass-text-tertiary)]" />
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="text-sm font-medium text-[var(--glass-text-primary)] truncate">{c.name}</div>
                    {c.aliases && (
                      <div className="text-[10px] text-[var(--glass-text-tertiary)] truncate">{c.aliases}</div>
                    )}
                    {c.folder && (
                      <span className="glass-chip glass-chip-default px-1.5 py-0.5 text-[10px]">{c.folder.name}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Locations */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
          {t('userAssets.locations')} ({data.locations.length})
        </h2>
        {data.locations.length === 0 ? (
          <div className="glass-surface rounded-2xl p-6 text-center text-sm text-[var(--glass-text-tertiary)]">{t('common.noData')}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.locations.map(loc => {
              const img = loc.images[0]?.imageUrl
              return (
                <div key={loc.id} className="glass-surface rounded-xl overflow-hidden">
                  <div className="aspect-video bg-[var(--glass-bg-muted)] flex items-center justify-center">
                    {img ? (
                      <img src={img} alt={loc.name} className="w-full h-full object-cover" />
                    ) : (
                      <AppIcon name="folder" className="w-8 h-8 text-[var(--glass-text-tertiary)]" />
                    )}
                  </div>
                  <div className="p-2.5 space-y-1">
                    <div className="text-sm font-medium text-[var(--glass-text-primary)] truncate">{loc.name}</div>
                    {loc.summary && (
                      <div className="text-[10px] text-[var(--glass-text-tertiary)] line-clamp-2">{loc.summary}</div>
                    )}
                    {loc.folder && (
                      <span className="glass-chip glass-chip-default px-1.5 py-0.5 text-[10px]">{loc.folder.name}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Voices */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
          {t('userAssets.voices')} ({data.voices.length})
        </h2>
        {data.voices.length === 0 ? (
          <div className="glass-surface rounded-2xl p-6 text-center text-sm text-[var(--glass-text-tertiary)]">{t('common.noData')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.voices.map(v => (
              <div key={v.id} className="glass-surface rounded-xl p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--glass-bg-muted)] flex items-center justify-center shrink-0">
                  <AppIcon name="mic" className="w-5 h-5 text-[var(--glass-text-tertiary)]" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-medium text-[var(--glass-text-primary)] truncate">{v.name}</div>
                  {v.description && (
                    <div className="text-[10px] text-[var(--glass-text-tertiary)] line-clamp-1">{v.description}</div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <span className={`glass-chip px-1.5 py-0.5 text-[10px] ${v.voiceType === 'custom' ? 'glass-chip-warning' : 'glass-chip-info'}`}>
                      {v.voiceType === 'custom' ? t('userAssets.custom') : t('userAssets.designed')}
                    </span>
                    {v.gender && (
                      <span className="glass-chip glass-chip-default px-1.5 py-0.5 text-[10px]">{v.gender}</span>
                    )}
                    <span className="glass-chip glass-chip-default px-1.5 py-0.5 text-[10px]">{v.language}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
