'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'

interface TaskItem {
  id: string
  type: string
  status: string
  createdAt: string
  finishedAt: string | null
  user: { name: string }
}

const statusFilters = ['', 'pending', 'running', 'completed', 'failed'] as const

export default function AdminTasks() {
  const t = useTranslations('admin')
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status) params.set('status', status)
    const res = await fetch(`/api/admin/tasks?${params}`)
    const data = await res.json()
    if (data.success) {
      setTasks(data.data.tasks)
      setTotal(data.data.total)
    }
    setLoading(false)
  }, [page, status])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const getDuration = (task: TaskItem) => {
    if (!task.finishedAt) return '-'
    const ms = new Date(task.finishedAt).getTime() - new Date(task.createdAt).getTime()
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const statusChipClass = (s: string) => {
    switch (s) {
      case 'completed': return 'glass-chip-success'
      case 'failed': return 'glass-chip-danger'
      case 'running': return 'glass-chip-warning'
      default: return 'glass-chip-info'
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{t('tasks.title')}</h1>

      {/* Status Filter */}
      <div className="flex gap-2">
        {statusFilters.map(s => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              status === s
                ? 'bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]'
                : 'glass-surface text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)]'
            }`}
          >
            {t(`tasks.${s || 'all'}`)}
          </button>
        ))}
      </div>

      <div className="glass-surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('tasks.type')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('tasks.status')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('tasks.user')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('tasks.duration')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('tasks.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10">
                  <AppIcon name="loader" className="w-6 h-6 animate-spin text-[var(--glass-text-tertiary)] mx-auto" />
                </td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-[var(--glass-text-tertiary)]">{t('common.noData')}</td></tr>
              ) : tasks.map(task => (
                <tr key={task.id} className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors">
                  <td className="px-5 py-3 font-medium text-[var(--glass-text-primary)]">{task.type}</td>
                  <td className="px-5 py-3">
                    <span className={`glass-chip px-2 py-0.5 text-[10px] ${statusChipClass(task.status)}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--glass-text-secondary)]">{task.user.name}</td>
                  <td className="px-5 py-3 text-[var(--glass-text-secondary)]">{getDuration(task)}</td>
                  <td className="px-5 py-3 text-[var(--glass-text-tertiary)] text-xs">{new Date(task.createdAt).toLocaleString()}</td>
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
