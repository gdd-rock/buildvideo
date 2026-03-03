'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/icons'

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  mode: string
  createdAt: string
  updatedAt: string
  user: { id: string; name: string }
  novelPromotionData: {
    videoRatio: string
    videoResolution: string
    imageResolution: string
    artStyle: string
    artStylePrompt: string | null
    ttsRate: string
    workflowMode: string
    characters: { id: string; name: string; aliases: string | null; profileConfirmed: boolean; appearances: { imageUrl: string | null }[] }[]
    locations: { id: string; name: string; summary: string | null; images: { imageUrl: string | null }[] }[]
    episodes: { id: string; name: string | null; episodeNumber: number; createdAt: string }[]
  } | null
  _count: { usageCosts: number }
  usageSummary: { apiType: string; totalCost: number; count: number }[]
}

export default function AdminProjectDetail() {
  const t = useTranslations('admin')
  const params = useParams()
  const projectId = (params?.id ?? '') as string

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchProject = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/projects/${projectId}`)
      const data = await res.json()
      if (data.success) setProject(data.data)
      else setError(data.error || 'Failed to load project')
    } catch { setError('Network error') }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchProject() }, [fetchProject])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AppIcon name="loader" className="w-8 h-8 animate-spin text-[var(--glass-text-tertiary)]" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Link href="/admin/projects" className="inline-flex items-center gap-1.5 text-sm text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors">
          <AppIcon name="arrowRight" className="w-4 h-4 rotate-180" />
          {t('projectDetail.back')}
        </Link>
        <div className="glass-surface rounded-2xl p-8 text-center text-[var(--glass-text-tertiary)]">{error || t('common.noData')}</div>
      </div>
    )
  }

  const npd = project.novelPromotionData
  const fmtDate = (d: string) => new Date(d).toLocaleDateString()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/projects" className="inline-flex items-center gap-1.5 text-sm text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors">
          <AppIcon name="arrowRight" className="w-4 h-4 rotate-180" />
          {t('projectDetail.back')}
        </Link>
        <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{project.name}</h1>
      </div>

      {/* Basic Info */}
      <div className="glass-surface rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('projectDetail.basicInfo')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-[var(--glass-text-tertiary)] text-xs">{t('projectDetail.owner')}</div>
            <Link href={`/admin/users/${project.user.id}`} className="text-[var(--glass-tone-info-fg)] hover:underline">{project.user.name}</Link>
          </div>
          <div>
            <div className="text-[var(--glass-text-tertiary)] text-xs">{t('projectDetail.mode')}</div>
            <div className="text-[var(--glass-text-primary)]">{project.mode}</div>
          </div>
          <div>
            <div className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.createdAt')}</div>
            <div className="text-[var(--glass-text-primary)]">{fmtDate(project.createdAt)}</div>
          </div>
          <div>
            <div className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.usageCount')}</div>
            <div className="text-[var(--glass-text-primary)]">{project._count.usageCosts}</div>
          </div>
        </div>
        {project.description && (
          <p className="text-sm text-[var(--glass-text-secondary)]">{project.description}</p>
        )}
      </div>

      {/* Project Config */}
      {npd && (
        <div className="glass-surface rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('projectDetail.config')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {[
              ['videoRatio', npd.videoRatio],
              ['videoResolution', npd.videoResolution],
              ['imageResolution', npd.imageResolution],
              ['artStyle', npd.artStyle],
              ['ttsRate', npd.ttsRate],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[var(--glass-text-tertiary)] text-xs">{t(`userDetail.${label}`)}</div>
                <div className="text-[var(--glass-text-primary)]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Episodes */}
      {npd && npd.episodes.length > 0 && (
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--glass-stroke-soft)]">
            <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
              {t('projectDetail.episodes')} ({npd.episodes.length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">#</th>
                <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('projectDetail.episodeName')}</th>
                <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {npd.episodes.map(ep => (
                <tr key={ep.id} className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors">
                  <td className="px-5 py-2.5 text-[var(--glass-text-tertiary)]">{ep.episodeNumber + 1}</td>
                  <td className="px-5 py-2.5 text-[var(--glass-text-primary)]">{ep.name || `Episode ${ep.episodeNumber + 1}`}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--glass-text-tertiary)] text-xs">{fmtDate(ep.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Characters */}
      {npd && npd.characters.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
            {t('projectDetail.characters')} ({npd.characters.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {npd.characters.map(c => {
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
                  <div className="p-2 text-center">
                    <div className="text-xs font-medium text-[var(--glass-text-primary)] truncate">{c.name}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Locations */}
      {npd && npd.locations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
            {t('projectDetail.locations')} ({npd.locations.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {npd.locations.map(loc => {
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
                  <div className="p-2 text-center">
                    <div className="text-xs font-medium text-[var(--glass-text-primary)] truncate">{loc.name}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Usage Summary */}
      {project.usageSummary.length > 0 && (
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--glass-stroke-soft)]">
            <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('userDetail.usageSummary')}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.apiType')}</th>
                <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.callCount')}</th>
                <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.totalCost')}</th>
              </tr>
            </thead>
            <tbody>
              {project.usageSummary.map(s => (
                <tr key={s.apiType} className="border-b border-[var(--glass-stroke-soft)] last:border-0">
                  <td className="px-5 py-2.5 text-[var(--glass-text-primary)]">{s.apiType}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--glass-text-secondary)]">{s.count}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--glass-text-primary)] font-medium">{Number(s.totalCost).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
