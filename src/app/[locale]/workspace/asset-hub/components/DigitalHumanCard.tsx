'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { AppIcon } from '@/components/ui/icons'

interface DigitalHuman {
    id: string
    name: string
    description: string | null
    photoUrl: string | null
    avatarImageUrl: string | null
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

    const imageUrl = digitalHuman.avatarImageUrl || digitalHuman.photoUrl
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
                onClick={() => imageUrl && onImageClick?.(imageUrl)}
            >
                {imageUrl ? (
                    <img src={imageUrl} alt={digitalHuman.name} className="w-full h-full object-cover" />
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

            {/* 信息区域 */}
            <div className="p-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-[var(--glass-text-primary)] text-sm truncate">{digitalHuman.name}</h3>
                    <div className="flex items-center gap-1">
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
