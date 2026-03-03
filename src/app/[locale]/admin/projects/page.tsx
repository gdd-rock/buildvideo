'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/icons'

interface ProjectItem {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  user: { name: string }
  _count: { usageCosts: number }
}

export default function AdminProjects() {
  const t = useTranslations('admin')
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/projects?${params}`)
    const data = await res.json()
    if (data.success) {
      setProjects(data.data.projects)
      setTotal(data.data.total)
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{t('projects.title')}</h1>

      <div className="max-w-md">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('projects.search')}
          className="glass-input-base w-full px-4 py-2.5 rounded-xl"
        />
      </div>

      <div className="glass-surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('projects.name')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('projects.owner')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('projects.usageCosts')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('projects.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10">
                  <AppIcon name="loader" className="w-6 h-6 animate-spin text-[var(--glass-text-tertiary)] mx-auto" />
                </td></tr>
              ) : projects.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-[var(--glass-text-tertiary)]">{t('common.noData')}</td></tr>
              ) : projects.map(p => (
                <tr key={p.id} className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/admin/projects/${p.id}`} className="text-[var(--glass-tone-info-fg)] hover:underline">{p.name}</Link>
                  </td>
                  <td className="px-5 py-3 text-[var(--glass-text-secondary)]">{p.user.name}</td>
                  <td className="px-5 py-3 text-[var(--glass-text-secondary)]">{p._count.usageCosts}</td>
                  <td className="px-5 py-3 text-[var(--glass-text-tertiary)] text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--glass-stroke-soft)]">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs rounded-lg disabled:opacity-30">{t('common.prev')}</button>
            <span className="text-xs text-[var(--glass-text-tertiary)]">{t('common.page', { current: page, total: totalPages })}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs rounded-lg disabled:opacity-30">{t('common.next')}</button>
          </div>
        )}
      </div>
    </div>
  )
}
