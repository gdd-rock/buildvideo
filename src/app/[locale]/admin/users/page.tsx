'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useCallback } from 'react'
import { AppIcon } from '@/components/ui/icons'

interface UserItem {
  id: string
  name: string
  email: string | null
  role: string
  disabled: boolean
  createdAt: string
  _count: { projects: number }
}

export default function AdminUsers() {
  const t = useTranslations('admin')
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set('search', search)
    const res = await fetch(`/api/admin/users?${params}`)
    const data = await res.json()
    if (data.success) {
      setUsers(data.data.users)
      setTotal(data.data.total)
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const updateUser = async (userId: string, update: { role?: string; disabled?: boolean }) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...update }),
    })
    const data = await res.json()
    if (data.success) fetchUsers()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--glass-text-primary)]">{t('users.title')}</h1>

      {/* Search */}
      <div className="max-w-md">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('users.search')}
          className="glass-input-base w-full px-4 py-2.5 rounded-xl"
        />
      </div>

      {/* Table */}
      <div className="glass-surface rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--glass-stroke-soft)]">
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('users.name')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('users.email')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('users.role')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('users.projects')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('users.status')}</th>
                <th className="text-left px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('users.createdAt')}</th>
                <th className="text-right px-5 py-3 font-medium text-[var(--glass-text-secondary)]">{t('users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10">
                  <AppIcon name="loader" className="w-6 h-6 animate-spin text-[var(--glass-text-tertiary)] mx-auto" />
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-[var(--glass-text-tertiary)]">{t('common.noData')}</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-b border-[var(--glass-stroke-soft)] last:border-0 hover:bg-[var(--glass-bg-muted)] transition-colors">
                  <td className="px-5 py-3 font-medium text-[var(--glass-text-primary)]">{u.name}</td>
                  <td className="px-5 py-3 text-[var(--glass-text-secondary)]">{u.email || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={`glass-chip px-2 py-0.5 text-[10px] ${u.role === 'ADMIN' ? 'glass-chip-info' : 'glass-chip-default'}`}>
                      {u.role === 'ADMIN' ? t('users.admin') : t('users.user')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--glass-text-secondary)]">{u._count.projects}</td>
                  <td className="px-5 py-3">
                    <span className={`glass-chip px-2 py-0.5 text-[10px] ${u.disabled ? 'glass-chip-danger' : 'glass-chip-success'}`}>
                      {u.disabled ? t('users.disabled') : t('users.active')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--glass-text-tertiary)] text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'ADMIN' ? (
                        <button
                          onClick={() => updateUser(u.id, { role: 'USER' })}
                          className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs rounded-lg"
                        >
                          {t('users.removeAdmin')}
                        </button>
                      ) : (
                        <button
                          onClick={() => updateUser(u.id, { role: 'ADMIN' })}
                          className="glass-btn-base glass-btn-soft px-3 py-1.5 text-xs rounded-lg"
                        >
                          {t('users.setAdmin')}
                        </button>
                      )}
                      <button
                        onClick={() => updateUser(u.id, { disabled: !u.disabled })}
                        className={`glass-btn-base px-3 py-1.5 text-xs rounded-lg ${u.disabled ? 'glass-btn-soft' : 'glass-btn-danger'}`}
                      >
                        {u.disabled ? t('users.enable') : t('users.disable')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--glass-stroke-soft)]">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs rounded-lg disabled:opacity-30"
            >
              {t('common.prev')}
            </button>
            <span className="text-xs text-[var(--glass-text-tertiary)]">
              {t('common.page', { current: page, total: totalPages })}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs rounded-lg disabled:opacity-30"
            >
              {t('common.next')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
