'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect } from 'react'
import { AppIcon, type AppIconName } from '@/components/ui/icons'

const navItems: { key: string; href: string; icon: AppIconName }[] = [
  { key: 'dashboard', href: '/admin', icon: 'chart' },
  { key: 'users', href: '/admin/users', icon: 'user' },
  { key: 'projects', href: '/admin/projects', icon: 'folder' },
  { key: 'tasks', href: '/admin/tasks', icon: 'cpu' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('admin')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    } else if (status === 'authenticated' && role !== 'ADMIN') {
      router.push('/')
    }
  }, [status, role, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--glass-bg-canvas)]">
        <AppIcon name="loader" className="w-8 h-8 animate-spin text-[var(--glass-text-tertiary)]" />
      </div>
    )
  }

  if (role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--glass-bg-canvas)]">
        <div className="glass-surface rounded-2xl p-8 text-center space-y-3 max-w-md">
          <AppIcon name="lock" className="w-12 h-12 mx-auto text-[var(--glass-text-tertiary)]" />
          <h2 className="text-xl font-semibold text-[var(--glass-text-primary)]">{t('common.accessDenied')}</h2>
          <p className="text-[var(--glass-text-secondary)]">{t('common.accessDeniedDesc')}</p>
        </div>
      </div>
    )
  }

  // Normalize pathname: strip locale prefix to match nav items
  const pathWithoutLocale = (pathname || '').replace(/^\/(zh|en)/, '')

  return (
    <div className="min-h-screen bg-[var(--glass-bg-canvas)] flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 glass-surface-modal border-r border-[var(--glass-stroke-soft)] flex flex-col">
        <div className="p-5 border-b border-[var(--glass-stroke-soft)]">
          <Link href="/" className="flex items-center gap-2">
            <AppIcon name="settingsHex" className="w-6 h-6 text-[var(--glass-tone-info-fg)]" />
            <span className="font-semibold text-[var(--glass-text-primary)]">{t('sidebar.title')}</span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathWithoutLocale === item.href || (item.href !== '/admin' && pathWithoutLocale.startsWith(item.href))
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--glass-tone-info-bg)] text-[var(--glass-tone-info-fg)]'
                    : 'text-[var(--glass-text-secondary)] hover:text-[var(--glass-text-primary)] hover:bg-[var(--glass-bg-muted)]'
                }`}
              >
                <AppIcon name={item.icon} className="w-5 h-5" />
                {t(`sidebar.${item.key}`)}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-[var(--glass-stroke-soft)]">
          <Link
            href="/workspace"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-primary)] transition-colors"
          >
            <AppIcon name="arrowRight" className="w-4 h-4 rotate-180" />
            Back to Workspace
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
