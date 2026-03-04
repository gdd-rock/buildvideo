'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { AppIcon } from '@/components/ui/icons'

interface VersionItem {
    id: string
    version: number
    avatarImageUrl: string | null
    avatarImageUrls: string[]
    createdAt: string
}

interface DigitalHuman {
    id: string
    name: string
    description: string | null
    photoUrl: string | null
    avatarImageUrl: string | null
    avatarImageUrls: string[]
    status: string
    gender: string | null
    folderId: string | null
}

interface DigitalHumanCardProps {
    digitalHuman: DigitalHuman
    onImageClick?: (url: string) => void
}

export function DigitalHumanCard({ digitalHuman, onImageClick }: DigitalHumanCardProps) {
    const t = useTranslations('assetHub')
    const queryClient = useQueryClient()
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [activeViewIndex, setActiveViewIndex] = useState(0)
    const [showVersions, setShowVersions] = useState(false)

    const viewLabels = [
        t('digitalHuman.viewAvatar'),
        t('digitalHuman.viewFront'),
        t('digitalHuman.viewSide'),
        t('digitalHuman.viewBack'),
    ]

    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/asset-hub/digital-humans/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ digitalHumanId: digitalHuman.id }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to generate')
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.digitalHumans() })
        },
    })

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/asset-hub/digital-humans/${digitalHuman.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.digitalHumans() })
            setShowDeleteConfirm(false)
        },
    })

    const versionsQuery = useQuery<{ versions: VersionItem[] }>({
        queryKey: ['digital-human-versions', digitalHuman.id],
        queryFn: async () => {
            const res = await fetch(`/api/asset-hub/digital-humans/${digitalHuman.id}/versions`)
            if (!res.ok) throw new Error('Failed to fetch versions')
            return res.json()
        },
        enabled: showVersions,
    })

    const restoreMutation = useMutation({
        mutationFn: async (versionId: string) => {
            const res = await fetch(`/api/asset-hub/digital-humans/${digitalHuman.id}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ versionId }),
            })
            if (!res.ok) throw new Error('Failed to restore version')
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.digitalHumans() })
            queryClient.invalidateQueries({ queryKey: ['digital-human-versions', digitalHuman.id] })
            setShowVersions(false)
        },
    })

    const versions = versionsQuery.data?.versions || []

    const hasMultiView = digitalHuman.avatarImageUrls && digitalHuman.avatarImageUrls.length === 4
    const displayUrl = hasMultiView
        ? digitalHuman.avatarImageUrls[activeViewIndex]
        : (digitalHuman.avatarImageUrl || digitalHuman.photoUrl)
    const statusKey = digitalHuman.status === 'ready' ? 'statusReady'
        : digitalHuman.status === 'generating' ? 'statusGenerating'
        : digitalHuman.status === 'failed' ? 'statusFailed'
        : 'statusPending'
    const statusChip = digitalHuman.status === 'ready' ? 'glass-chip-success'
        : digitalHuman.status === 'generating' ? 'glass-chip-info'
        : digitalHuman.status === 'failed' ? 'glass-chip-danger'
        : 'glass-chip-neutral'

    return (
        <div className="glass-surface overflow-hidden relative group transition-all">
            {/* 图片区域 */}
            <div
                className="relative bg-[var(--glass-bg-muted)] aspect-square flex items-center justify-center cursor-pointer"
                onClick={() => displayUrl && onImageClick?.(displayUrl)}
            >
                {displayUrl ? (
                    <img src={displayUrl} alt={digitalHuman.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-16 h-16 rounded-full glass-surface-soft flex items-center justify-center">
                        <AppIcon name="user" className="w-8 h-8 text-[var(--glass-text-tertiary)]" />
                    </div>
                )}

                {/* 状态标签 */}
                <div className={`absolute top-2 left-2 glass-chip ${statusChip} text-xs px-2 py-0.5 rounded-full`}>
                    {t(`digitalHuman.${statusKey}`)}
                </div>

                {/* 性别标签 */}
                {digitalHuman.gender && (
                    <div className="absolute top-2 right-2 glass-chip glass-chip-neutral text-xs px-2 py-0.5 rounded-full">
                        {digitalHuman.gender === 'male' ? 'M' : 'F'}
                    </div>
                )}
            </div>

            {/* 多视图缩略图 */}
            {hasMultiView && (
                <div className="flex gap-1 px-2 py-1.5 bg-[var(--glass-bg-surface-strong)]">
                    {digitalHuman.avatarImageUrls.map((url, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); setActiveViewIndex(idx) }}
                            className={`flex-1 relative rounded overflow-hidden border-2 transition-all ${
                                activeViewIndex === idx
                                    ? 'border-[var(--glass-tone-info-fg)]'
                                    : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                        >
                            <img src={url} alt={viewLabels[idx]} className="w-full aspect-square object-cover" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] leading-tight py-0.5 text-center">
                                {viewLabels[idx]}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* 信息区域 */}
            <div className="p-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-[var(--glass-text-primary)] text-sm truncate">{digitalHuman.name}</h3>
                    <div className="flex items-center gap-1">
                        {digitalHuman.status === 'ready' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowVersions(!showVersions) }}
                                className="glass-btn-base glass-btn-soft h-6 w-6 rounded-md text-[var(--glass-text-secondary)] flex items-center justify-center opacity-0 group-hover:opacity-100"
                                title={t('digitalHuman.versionHistory')}
                            >
                                <AppIcon name="clock" className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {digitalHuman.status !== 'generating' && digitalHuman.photoUrl && (
                            <button
                                onClick={(e) => { e.stopPropagation(); generateMutation.mutate() }}
                                disabled={generateMutation.isPending}
                                className="glass-btn-base glass-btn-soft h-6 px-2 rounded-md text-[var(--glass-tone-info-fg)] flex items-center justify-center text-xs"
                            >
                                {digitalHuman.status === 'ready' ? t('digitalHuman.regenerate') : t('generate')}
                            </button>
                        )}
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="glass-btn-base glass-btn-soft h-6 w-6 rounded-md text-[var(--glass-tone-danger-fg)] flex items-center justify-center opacity-0 group-hover:opacity-100"
                        >
                            <AppIcon name="trash" className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {digitalHuman.description && (
                    <p className="mt-1 text-xs text-[var(--glass-text-secondary)] line-clamp-2">{digitalHuman.description}</p>
                )}
            </div>

            {/* 版本历史面板 */}
            {showVersions && (
                <div className="absolute inset-0 glass-overlay flex items-center justify-center z-20" onClick={(e) => e.stopPropagation()}>
                    <div className="glass-surface-modal p-3 m-3 w-full max-h-full overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-[var(--glass-text-primary)]">{t('digitalHuman.versionHistory')}</h4>
                            <button onClick={() => setShowVersions(false)} className="glass-btn-base glass-btn-soft w-6 h-6 rounded-full flex items-center justify-center">
                                <AppIcon name="close" className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {versionsQuery.isLoading ? (
                            <p className="text-xs text-[var(--glass-text-tertiary)] text-center py-3">{t('loading')}</p>
                        ) : versions.length === 0 ? (
                            <p className="text-xs text-[var(--glass-text-tertiary)] text-center py-3">{t('digitalHuman.noVersions')}</p>
                        ) : (
                            <div className="space-y-2 overflow-y-auto max-h-48">
                                {versions.map((v) => (
                                    <div key={v.id} className="flex items-center gap-2 p-2 rounded-lg glass-surface-soft">
                                        {v.avatarImageUrl && (
                                            <img src={v.avatarImageUrl} alt={`v${v.version}`} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-[var(--glass-text-primary)]">V{v.version}</p>
                                            <p className="text-[10px] text-[var(--glass-text-tertiary)]">
                                                {new Date(v.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => restoreMutation.mutate(v.id)}
                                            disabled={restoreMutation.isPending}
                                            className="glass-btn-base glass-btn-soft h-6 px-2 rounded-md text-[var(--glass-tone-info-fg)] text-xs flex-shrink-0"
                                        >
                                            {t('digitalHuman.restore')}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 删除确认 */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 glass-overlay flex items-center justify-center z-20">
                    <div className="glass-surface-modal p-4 m-4" onClick={(e) => e.stopPropagation()}>
                        <p className="mb-4 text-sm text-[var(--glass-text-primary)]">{t('confirmDeleteDigitalHuman')}</p>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowDeleteConfirm(false)} className="glass-btn-base glass-btn-secondary px-3 py-1.5 rounded-lg text-sm">{t('cancel')}</button>
                            <button onClick={() => deleteMutation.mutate()} className="glass-btn-base glass-btn-danger px-3 py-1.5 rounded-lg text-sm">{t('delete')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default DigitalHumanCard
