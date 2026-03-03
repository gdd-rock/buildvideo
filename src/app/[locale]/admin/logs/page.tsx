'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'

interface LogEntry {
  id: string
  ts: string
  level: string
  module: string
  taskId: string
  message: string
  details: Record<string, unknown> | null
}

const levelFilters = ['', 'ERROR', 'WARN', 'INFO'] as const

export default function AdminLogs() {
  const t = useTranslations('admin')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [level, setLevel] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (level) params.set('level', level)
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/logs?${params}`)
    const data = await res.json()
    if (data.success) {
      setLogs(data.data.logs)
      setTotal(data.data.total)
    }
    setLoading(false)
  }, [page, level, search])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const levelColor = (l: string) => {
    switch (l) {
      case 'ERROR': return 'glass-chip-danger'
      case 'WARN': return 'glass-chip-warning'
      case 'INFO': return 'glass-chip-success'
      default: return 'glass-chip-info'
    }
  }

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch { return ts }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{t('logs.title')}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {levelFilters.map(l => (
            <button
              key={l || 'all'}
              onClick={() => { setLevel(l); setPage(1) }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                level === l
                  ? 'bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]'
                  : 'glass-surface text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)]'
              }`}
            >
              {l || t('logs.all')}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={t('logs.search')}
            className="glass-surface px-4 py-2 rounded-xl text-sm text-[var(--glass-text-primary)] placeholder:text-[var(--glass-text-tertiary)] w-64 outline-none focus:ring-1 focus:ring-[var(--glass-tone-info-fg)]"
          />
          <button
            onClick={handleSearch}
            className="glass-surface px-3 py-2 rounded-xl text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors"
          >
            <AppIcon name="search" className="w-4 h-4" />
          </button>
          <button
            onClick={fetchLogs}
            className="glass-surface px-3 py-2 rounded-xl text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors"
          >
            <AppIcon name="refresh" className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--glass-text-secondary)] w-20">{t('logs.level')}</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--glass-text-secondary)] w-40">{t('logs.time')}</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--glass-text-secondary)] w-40">{t('logs.module')}</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--glass-text-secondary)]">{t('logs.message')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-10">
                  <AppIcon name="loader" className="w-6 h-6 animate-spin text-[var(--glass-text-tertiary)] mx-auto" />
                </td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-[var(--glass-text-tertiary)]">{t('common.noData')}</td></tr>
              ) : logs.map(log => (
                <tr
                  key={log.id}
                  className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors cursor-pointer"
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <td className="px-4 py-3">
                    <span className={`glass-chip px-2 py-0.5 text-[10px] ${levelColor(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--glass-text-tertiary)] text-xs font-mono whitespace-nowrap">
                    {formatTime(log.ts)}
                  </td>
                  <td className="px-4 py-3 text-[var(--glass-text-secondary)] text-xs font-mono">
                    {log.module}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[var(--glass-text-primary)] text-xs break-all line-clamp-2">
                      {log.message}
                    </div>
                    {expandedId === log.id && log.details && (
                      <pre className="mt-2 p-3 rounded-lg bg-[var(--glass-bg-canvas)] text-[10px] text-[var(--glass-text-secondary)] font-mono overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </td>
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
