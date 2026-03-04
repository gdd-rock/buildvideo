'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/keys'
import { AppIcon } from '@/components/ui/icons'

interface DigitalHumanCreationModalProps {
    folderId: string | null
    onClose: () => void
    onSuccess: () => void
}

export function DigitalHumanCreationModal({ folderId, onClose, onSuccess }: DigitalHumanCreationModalProps) {
    const t = useTranslations('assetHub')
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [gender, setGender] = useState<'male' | 'female' | ''>('')
    const [photoFile, setPhotoFile] = useState<File | null>(null)
    const [photoPreview, setPhotoPreview] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setPhotoFile(file)
        const reader = new FileReader()
        reader.onload = () => setPhotoPreview(reader.result as string)
        reader.readAsDataURL(file)
    }

    const handleSubmit = async () => {
        if (!name.trim() || !photoFile) return
        setSubmitting(true)

        try {
            // 1. Upload photo
            const formData = new FormData()
            formData.append('file', photoFile)
            formData.append('name', name.trim())
            if (description.trim()) formData.append('description', description.trim())
            if (gender) formData.append('gender', gender)
            if (folderId) formData.append('folderId', folderId)

            const res = await fetch('/api/asset-hub/digital-humans/upload-photo', {
                method: 'POST',
                body: formData,
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Upload failed')
            }

            queryClient.invalidateQueries({ queryKey: queryKeys.globalAssets.digitalHumans() })
            onSuccess()
        } catch (error) {
            alert(t('uploadFailed') + (error instanceof Error ? `: ${error.message}` : ''))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50" onClick={onClose}>
            <div className="glass-surface-modal w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-[var(--glass-text-primary)] mb-4">
                    {t('digitalHuman.new')}
                </h2>

                {/* 名称 */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-[var(--glass-text-secondary)] mb-1">
                        {t('digitalHuman.nameLabel')}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('digitalHuman.namePlaceholder')}
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm"
                    />
                </div>

                {/* 描述 */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-[var(--glass-text-secondary)] mb-1">
                        {t('digitalHuman.descLabel')}
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('digitalHuman.descPlaceholder')}
                        rows={2}
                        className="w-full glass-input px-3 py-2 rounded-lg text-sm resize-none"
                    />
                </div>

                {/* 性别 */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-[var(--glass-text-secondary)] mb-1">
                        {t('digitalHuman.genderLabel')}
                    </label>
                    <div className="flex gap-2">
                        {(['male', 'female'] as const).map((g) => (
                            <button
                                key={g}
                                onClick={() => setGender(gender === g ? '' : g)}
                                className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                                    gender === g
                                        ? 'glass-btn-base glass-btn-primary'
                                        : 'glass-btn-base glass-btn-secondary'
                                }`}
                            >
                                {t(`digitalHuman.${g}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 上传照片 */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-[var(--glass-text-secondary)] mb-1">
                        {t('digitalHuman.uploadPhoto')}
                    </label>
                    <p className="text-xs text-[var(--glass-text-tertiary)] mb-2">
                        {t('digitalHuman.uploadPhotoTip')}
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    {photoPreview ? (
                        <div
                            className="relative w-32 h-32 rounded-lg overflow-hidden cursor-pointer border border-[var(--glass-stroke-subtle)]"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-32 h-32 rounded-lg border-2 border-dashed border-[var(--glass-stroke-subtle)] flex flex-col items-center justify-center gap-1 hover:border-[var(--glass-stroke-focus)] transition-colors"
                        >
                            <AppIcon name="upload" className="w-6 h-6 text-[var(--glass-text-tertiary)]" />
                            <span className="text-xs text-[var(--glass-text-tertiary)]">{t('modal.dropOrClick')}</span>
                        </button>
                    )}
                </div>

                {/* 按钮 */}
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="glass-btn-base glass-btn-secondary px-4 py-2 rounded-lg text-sm">
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim() || !photoFile || submitting}
                        className="glass-btn-base glass-btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                        {submitting ? t('digitalHuman.creating') : t('digitalHuman.create')}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DigitalHumanCreationModal
