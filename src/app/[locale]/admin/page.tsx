'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { AppIcon, type AppIconName } from '@/components/ui/icons'

interface Stats {
  totalUsers: number
  totalProjects: number
  totalTasks: number
  activeUsers: number
  recentUsers: { id: string; name: string; email: string | null; role: string; createdAt: string; disabled: boolean }[]
  recentTasks: { id: string; type: string; status: string; createdAt: string; finishedAt: string | null; user: { name: string } }[]
}

const statCards: { key: keyof Pick<Stats, 'totalUsers' | 'totalProjects' | 'totalTasks' | 'activeUsers'>; icon: AppIconName }[] = [
  { key: 'totalUsers', icon: 'user' },
  { key: 'totalProjects', icon: 'folder' },
  { key: 'totalTasks', icon: 'cpu' },
  { key: 'activeUsers', icon: 'bolt' },
]

export default function AdminDashboard() {
  const t = useTranslations('admin')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(res => { if (res.success) setStats(res.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AppIcon name="loader" className="w-8 h-8 animate-spin text-[var(--glass-text-tertiary)]" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{t('dashboard.title')}</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ key, icon }) => (
          <div key={key} className="glass-surface rounded-2xl p-6 space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)] flex items-center justify-center">
                <AppIcon name={icon} className="w-5 h-5" />
              </div>
              <span className="text-sm text-[var(--glass-text-secondary)]">{t(`dashboard.${key}`)}</span>
            </div>
            <p className="text-3xl font-bold text-[var(--glass-text-primary)]">{stats[key]}</p>
          </div>
        ))}
      </div>

      {/* Recent Users & Tasks */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-surface rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--glass-text-primary)] mb-4">{t('dashboard.recentUsers')}</h3>
          <div className="space-y-3">
            {stats.recentUsers.map(u => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-[var(--glass-stroke-soft)] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[var(--glass-text-primary)]">{u.name}</p>
                  <p className="text-xs text-[var(--glass-text-tertiary)]">{u.email || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.role === 'ADMIN' && (
                    <span className="glass-chip glass-chip-info px-2 py-0.5 text-[10px]">{t('users.admin')}</span>
                  )}
                  <span className="text-xs text-[var(--glass-text-tertiary)]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <p className="text-sm text-[var(--glass-text-tertiary)]">{t('common.noData')}</p>
            )}
          </div>
        </div>

        <div className="glass-surface rounded-2xl p-6">
          <h3 className="font-semibold text-[var(--glass-text-primary)] mb-4">{t('dashboard.recentTasks')}</h3>
          <div className="space-y-3">
            {stats.recentTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-[var(--glass-stroke-soft)] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[var(--glass-text-primary)]">{task.type}</p>
                  <p className="text-xs text-[var(--glass-text-tertiary)]">{task.user.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`glass-chip px-2 py-0.5 text-[10px] ${
                    task.status === 'completed' ? 'glass-chip-success' :
                    task.status === 'failed' ? 'glass-chip-danger' :
                    task.status === 'running' ? 'glass-chip-warning' :
                    'glass-chip-info'
                  }`}>
                    {task.status}
                  </span>
                  <span className="text-xs text-[var(--glass-text-tertiary)]">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {stats.recentTasks.length === 0 && (
              <p className="text-sm text-[var(--glass-text-tertiary)]">{t('common.noData')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
