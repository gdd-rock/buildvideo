'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/icons'

interface UserDetail {
  id: string
  name: string
  email: string | null
  role: string
  disabled: boolean
  createdAt: string
  updatedAt: string
  balance: { balance: number; frozenAmount: number; totalSpent: number } | null
  preferences: {
    analysisModel: string | null
    characterModel: string | null
    locationModel: string | null
    storyboardModel: string | null
    editModel: string | null
    videoModel: string | null
    lipSyncModel: string | null
    videoRatio: string | null
    videoResolution: string | null
    imageResolution: string | null
    artStyle: string | null
    ttsRate: number | null
    llmBaseUrl: string | null
  } | null
  apiKeyStatus: Record<string, boolean>
  projects: { id: string; name: string; createdAt: string; _count: { usageCosts: number } }[]
  tasks: { id: string; type: string; status: string; createdAt: string; finishedAt: string | null }[]
  _count: { projects: number; tasks: number; usageCosts: number }
  usageSummary: { apiType: string; totalCost: number; count: number }[]
  transactions: { id: string; type: string; amount: number; balanceAfter: number; description: string | null; taskType: string | null; createdAt: string }[]
}

const modelKeys = [
  'analysisModel', 'characterModel', 'locationModel',
  'storyboardModel', 'editModel', 'videoModel', 'lipSyncModel',
] as const

const apiKeyNames: Record<string, string> = {
  llmApiKey: 'LLM API Key',
  falApiKey: 'fal.ai Key',
  googleAiKey: 'Google AI Key',
  arkApiKey: 'Ark Key',
  qwenApiKey: 'Qwen Key',
}

const statusColors: Record<string, string> = {
  queued: 'glass-chip-default',
  running: 'glass-chip-warning',
  completed: 'glass-chip-success',
  failed: 'glass-chip-danger',
}

export default function AdminUserDetail() {
  const t = useTranslations('admin')
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchUser = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      const data = await res.json()
      if (data.success) {
        setUser(data.data)
      } else {
        setError(data.error || 'Failed to load user')
      }
    } catch {
      setError('Network error')
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchUser() }, [fetchUser])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AppIcon name="loader" className="w-8 h-8 animate-spin text-[var(--glass-text-tertiary)]" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors">
          <AppIcon name="arrowRight" className="w-4 h-4 rotate-180" />
          {t('userDetail.back')}
        </Link>
        <div className="glass-surface rounded-2xl p-8 text-center text-[var(--glass-text-tertiary)]">
          {error || t('common.noData')}
        </div>
      </div>
    )
  }

  const fmt = (d: string) => new Date(d).toLocaleString()
  const fmtDate = (d: string) => new Date(d).toLocaleDateString()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] transition-colors">
            <AppIcon name="arrowRight" className="w-4 h-4 rotate-180" />
            {t('userDetail.back')}
          </Link>
          <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{user.name}</h1>
          <span className={`glass-chip px-2 py-0.5 text-[10px] ${user.role === 'ADMIN' ? 'glass-chip-info' : 'glass-chip-default'}`}>
            {user.role === 'ADMIN' ? t('users.admin') : t('users.user')}
          </span>
          {user.disabled && (
            <span className="glass-chip glass-chip-danger px-2 py-0.5 text-[10px]">{t('users.disabled')}</span>
          )}
        </div>
      </div>

      {/* Top row: Basic Info + Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="glass-surface rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('userDetail.basicInfo')}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[var(--glass-text-tertiary)] text-xs">{t('users.email')}</div>
              <div className="text-[var(--glass-text-primary)]">{user.email || '-'}</div>
            </div>
            <div>
              <div className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.registeredAt')}</div>
              <div className="text-[var(--glass-text-primary)]">{fmt(user.createdAt)}</div>
            </div>
            <div>
              <div className="text-[var(--glass-text-tertiary)] text-xs">{t('users.projects')}</div>
              <div className="text-[var(--glass-text-primary)]">{user._count.projects}</div>
            </div>
            <div>
              <div className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.lastActiveAt')}</div>
              <div className="text-[var(--glass-text-primary)]">{fmt(user.updatedAt)}</div>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="glass-surface rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('userDetail.balanceInfo')}</h2>
          {user.balance ? (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.currentBalance')}</div>
                <div className="text-[var(--glass-text-primary)] font-medium text-lg">{Number(user.balance.balance).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.frozenAmount')}</div>
                <div className="text-[var(--glass-text-primary)]">{Number(user.balance.frozenAmount).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.totalSpent')}</div>
                <div className="text-[var(--glass-text-primary)]">{Number(user.balance.totalSpent).toFixed(2)}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--glass-text-tertiary)]">{t('userDetail.noBalance')}</p>
          )}
        </div>
      </div>

      {/* Preferences: Models + API Keys */}
      <div className="glass-surface rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('userDetail.preferences')}</h2>
        {user.preferences ? (
          <div className="space-y-4">
            {/* Model Config */}
            <div>
              <h3 className="text-xs font-medium text-[var(--glass-text-secondary)] mb-2">{t('userDetail.modelConfig')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {modelKeys.map(k => (
                  <div key={k}>
                    <div className="text-[var(--glass-text-tertiary)] text-xs">{t(`userDetail.${k}`)}</div>
                    <div className="text-[var(--glass-text-primary)] truncate">{user.preferences?.[k] || <span className="text-[var(--glass-text-tertiary)]">{t('userDetail.notSet')}</span>}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Video Settings */}
            <div>
              <h3 className="text-xs font-medium text-[var(--glass-text-secondary)] mb-2">{t('userDetail.videoSettings')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                {(['videoRatio', 'videoResolution', 'imageResolution', 'artStyle', 'ttsRate'] as const).map(k => (
                  <div key={k}>
                    <div className="text-[var(--glass-text-tertiary)] text-xs">{t(`userDetail.${k}`)}</div>
                    <div className="text-[var(--glass-text-primary)]">{user.preferences?.[k] ?? <span className="text-[var(--glass-text-tertiary)]">{t('userDetail.notSet')}</span>}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* LLM Base URL */}
            {user.preferences.llmBaseUrl && (
              <div className="text-sm">
                <span className="text-[var(--glass-text-tertiary)] text-xs">{t('userDetail.llmBaseUrl')}: </span>
                <span className="text-[var(--glass-text-primary)]">{user.preferences.llmBaseUrl}</span>
              </div>
            )}

            {/* API Key Status */}
            <div>
              <h3 className="text-xs font-medium text-[var(--glass-text-secondary)] mb-2">{t('userDetail.apiKeyStatus')}</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(user.apiKeyStatus).map(([key, configured]) => (
                  <span
                    key={key}
                    className={`glass-chip px-2.5 py-1 text-xs ${configured ? 'glass-chip-success' : 'glass-chip-default'}`}
                  >
                    {apiKeyNames[key] || key}: {configured ? t('userDetail.configured') : t('userDetail.notConfigured')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--glass-text-tertiary)]">{t('userDetail.noPreferences')}</p>
        )}
      </div>

      {/* Usage Summary */}
      {user.usageSummary.length > 0 && (
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
              {user.usageSummary.map(s => (
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

      {/* Projects */}
      {user.projects.length > 0 && (
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--glass-stroke-soft)]">
            <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
              {t('userDetail.projectList')} ({user._count.projects})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.projectName')}</th>
                <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.usageCount')}</th>
                <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {user.projects.map(p => (
                <tr key={p.id} className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors">
                  <td className="px-5 py-2.5 text-[var(--glass-text-primary)]">{p.name}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--glass-text-secondary)]">{p._count.usageCosts}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--glass-text-tertiary)] text-xs">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent Tasks */}
      {user.tasks.length > 0 && (
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--glass-stroke-soft)]">
            <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">
              {t('userDetail.recentTasks')} ({user._count.tasks})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.taskType')}</th>
                <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.taskStatus')}</th>
                <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.taskTime')}</th>
                <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.finishedAt')}</th>
              </tr>
            </thead>
            <tbody>
              {user.tasks.map(tk => (
                <tr key={tk.id} className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors">
                  <td className="px-5 py-2.5 text-[var(--glass-text-primary)]">{tk.type}</td>
                  <td className="px-5 py-2.5">
                    <span className={`glass-chip px-2 py-0.5 text-[10px] ${statusColors[tk.status] || 'glass-chip-default'}`}>
                      {tk.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right text-[var(--glass-text-tertiary)] text-xs">{fmt(tk.createdAt)}</td>
                  <td className="px-5 py-2.5 text-right text-[var(--glass-text-tertiary)] text-xs">{tk.finishedAt ? fmt(tk.finishedAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      {user.transactions.length > 0 && (
        <div className="glass-surface rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--glass-stroke-soft)]">
            <h2 className="text-sm font-semibold text-[var(--glass-text-primary)]">{t('userDetail.transactions')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-stroke-soft)]">
                  <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.txType')}</th>
                  <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.txAmount')}</th>
                  <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.txBalanceAfter')}</th>
                  <th className="text-left px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.txDescription')}</th>
                  <th className="text-right px-5 py-2.5 font-medium text-[var(--glass-text-secondary)]">{t('userDetail.txTime')}</th>
                </tr>
              </thead>
              <tbody>
                {user.transactions.map(tx => (
                  <tr key={tx.id} className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors">
                    <td className="px-5 py-2.5">
                      <span className={`glass-chip px-2 py-0.5 text-[10px] ${tx.type === 'RECHARGE' ? 'glass-chip-success' : 'glass-chip-warning'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`px-5 py-2.5 text-right font-medium ${Number(tx.amount) >= 0 ? 'text-[var(--glass-tone-success-fg)]' : 'text-[var(--glass-tone-danger-fg)]'}`}>
                      {Number(tx.amount) >= 0 ? '+' : ''}{Number(tx.amount).toFixed(4)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-[var(--glass-text-secondary)]">{Number(tx.balanceAfter).toFixed(2)}</td>
                    <td className="px-5 py-2.5 text-[var(--glass-text-secondary)] max-w-[200px] truncate">{tx.description || '-'}</td>
                    <td className="px-5 py-2.5 text-right text-[var(--glass-text-tertiary)] text-xs">{fmt(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
