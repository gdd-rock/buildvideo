'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DragEvent, RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { ART_STYLES } from '@/lib/constants'
import CharacterCreationPreview from './CharacterCreationPreview'
import { AppIcon } from '@/components/ui/icons'

type Mode = 'asset-hub' | 'project'
type CreateMode = 'reference' | 'description' | 'digitalHuman'

interface AvailableCharacter {
  id: string
  name: string
  appearances: unknown[]
}

interface DigitalHumanOption {
  id: string
  name: string
  avatarImageUrl: string | null
  avatarImageUrls: string[]
}

interface CharacterCreationFormProps {
  mode: Mode
  createMode: CreateMode
  setCreateMode: (mode: CreateMode) => void
  name: string
  setName: (value: string) => void
  description: string
  setDescription: (value: string) => void
  aiInstruction: string
  setAiInstruction: (value: string) => void
  artStyle: string
  setArtStyle: (value: string) => void
  referenceImagesBase64: string[]
  setReferenceImagesBase64: (images: string[]) => void
  directReferenceUrls: string[]
  setDirectReferenceUrls: (urls: string[]) => void
  referenceSubMode: 'direct' | 'extract'
  setReferenceSubMode: (mode: 'direct' | 'extract') => void
  isSubAppearance: boolean
  setIsSubAppearance: (value: boolean) => void
  selectedCharacterId: string
  setSelectedCharacterId: (value: string) => void
  changeReason: string
  setChangeReason: (value: string) => void
  availableCharacters: AvailableCharacter[]
  fileInputRef: RefObject<HTMLInputElement | null>
  handleDrop: (event: DragEvent<HTMLDivElement>) => void
  handleFileSelect: (files: FileList) => void
  handleClearReference: (index?: number) => void
  handleExtractDescription: () => void
  handleCreateWithReference: () => void
  handleAiDesign: () => void
  handleSubmit: () => void
  isSubmitting: boolean
  isAiDesigning: boolean
  isExtracting: boolean
}

const SparklesIcon = ({ className }: { className?: string }) => (
  <AppIcon name="sparklesAlt" className={className} />
)

const PhotoIcon = ({ className }: { className?: string }) => (
  <AppIcon name="image" className={className} />
)

export default function CharacterCreationForm({
  mode,
  createMode,
  setCreateMode,
  name,
  setName,
  description,
  setDescription,
  aiInstruction,
  setAiInstruction,
  artStyle,
  setArtStyle,
  referenceImagesBase64,
  setReferenceImagesBase64,
  directReferenceUrls,
  setDirectReferenceUrls,
  referenceSubMode,
  setReferenceSubMode,
  isSubAppearance,
  setIsSubAppearance,
  selectedCharacterId,
  setSelectedCharacterId,
  changeReason,
  setChangeReason,
  availableCharacters,
  fileInputRef,
  handleDrop,
  handleFileSelect,
  handleClearReference,
  handleExtractDescription,
  handleCreateWithReference,
  handleAiDesign,
  handleSubmit,
  isSubmitting,
  isAiDesigning,
  isExtracting,
}: CharacterCreationFormProps) {
  const t = useTranslations('assetModal')

  // 数字人选择相关
  const [selectedDHId, setSelectedDHId] = useState<string | null>(null)

  const { data: dhData } = useQuery<{ digitalHumans: DigitalHumanOption[] }>({
    queryKey: ['digital-humans-for-picker'],
    queryFn: async () => {
      const res = await fetch('/api/asset-hub/digital-humans')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
    enabled: createMode === 'digitalHuman',
  })

  const readyDigitalHumans = (dhData?.digitalHumans || []).filter(
    (dh) => dh.avatarImageUrl || (dh.avatarImageUrls && dh.avatarImageUrls.length > 0),
  )

  const selectedDH = readyDigitalHumans.find((dh) => dh.id === selectedDHId)

  // 选中数字人后，直接使用其已有的 COS 签名 URL（无需 base64 转换）
  const handleSelectDigitalHuman = useCallback((dh: DigitalHumanOption) => {
    setSelectedDHId(dh.id)
    if (!name.trim()) setName(dh.name)

    // 优先使用第5张合成参考图（index 4），否则使用全部
    const urls = dh.avatarImageUrls.length >= 5
      ? [dh.avatarImageUrls[4]]
      : dh.avatarImageUrls.length > 0
        ? dh.avatarImageUrls
        : (dh.avatarImageUrl ? [dh.avatarImageUrl] : [])

    setDirectReferenceUrls(urls)
  }, [name, setName, setDirectReferenceUrls])

  return (
    <div className="space-y-5">
      <div className="mb-5">
        {(() => {
          const tabs = ['description', 'reference', 'digitalHuman'] as const
          const activeIdx = tabs.indexOf(createMode)
          return (
            <div className="rounded-lg p-0.5" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <div className="relative grid gap-1" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div
                  className="absolute bottom-0.5 top-0.5 rounded-md bg-white transition-transform duration-200"
                  style={{
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(0,0,0,0.06)',
                    width: 'calc(100% / 3)',
                    transform: `translateX(${activeIdx * 100}%)`,
                  }}
                />
                <button
                  onClick={() => setCreateMode('description')}
                  className={`relative z-[1] flex items-center justify-center gap-2 rounded-md py-2 px-4 text-sm font-medium transition-colors cursor-pointer ${createMode === 'description' ? 'text-[var(--glass-text-primary)]' : 'text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]'}`}
                >
                  <SparklesIcon className="w-4 h-4" />
                  <span>{t('character.modeDescription')}</span>
                </button>
                <button
                  onClick={() => setCreateMode('reference')}
                  className={`relative z-[1] flex items-center justify-center gap-2 rounded-md py-2 px-4 text-sm font-medium transition-colors cursor-pointer ${createMode === 'reference' ? 'text-[var(--glass-text-primary)]' : 'text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]'}`}
                >
                  <PhotoIcon className="w-4 h-4" />
                  <span>{t('character.modeReference')}</span>
                </button>
                <button
                  onClick={() => setCreateMode('digitalHuman')}
                  className={`relative z-[1] flex items-center justify-center gap-2 rounded-md py-2 px-4 text-sm font-medium transition-colors cursor-pointer ${createMode === 'digitalHuman' ? 'text-[var(--glass-text-primary)]' : 'text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]'}`}
                >
                  <AppIcon name="user" className="w-4 h-4" />
                  <span>{t('character.modeDigitalHuman')}</span>
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {mode === 'project' && availableCharacters.length > 0 && (
        <div className="flex items-start gap-3 p-3 glass-surface-soft rounded-lg border border-[var(--glass-stroke-base)]">
          <input
            type="checkbox"
            id="isSubAppearance"
            checked={isSubAppearance}
            onChange={(e) => setIsSubAppearance(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[var(--glass-stroke-base)] text-[var(--glass-tone-info-fg)]"
          />
          <label htmlFor="isSubAppearance" className="flex-1 text-sm cursor-pointer">
            <span className="font-medium text-[var(--glass-text-primary)]">{t('character.isSubAppearance')}</span>
            <p className="text-xs text-[var(--glass-text-secondary)] mt-0.5">{t('character.isSubAppearanceHint')}</p>
          </label>
        </div>
      )}

      {isSubAppearance && (
        <div className="space-y-2">
          <label className="glass-field-label block">
            {t('character.selectMainCharacter')} <span className="text-[var(--glass-tone-danger-fg)]">*</span>
          </label>
          <select
            value={selectedCharacterId}
            onChange={(e) => setSelectedCharacterId(e.target.value)}
            className="glass-select-base w-full px-3 py-2 text-sm"
          >
            <option value="">{t('character.selectCharacterPlaceholder')}</option>
            {availableCharacters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.name} ({t('character.appearancesCount', { count: char.appearances.length })})
              </option>
            ))}
          </select>
        </div>
      )}

      {isSubAppearance && (
        <div className="space-y-2">
          <label className="glass-field-label block">
            {t('character.changeReason')} <span className="text-[var(--glass-tone-danger-fg)]">*</span>
          </label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder={t('character.changeReasonPlaceholder')}
            className="glass-input-base w-full px-3 py-2 text-sm"
          />
        </div>
      )}

      {!isSubAppearance && (
        <div className="space-y-2">
          <label className="glass-field-label block">
            {t('character.name')} <span className="text-[var(--glass-tone-danger-fg)]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('character.namePlaceholder')}
            className="glass-input-base w-full px-3 py-2 text-sm"
          />
        </div>
      )}

      {!isSubAppearance && (
        <div className="space-y-2">
          <label className="glass-field-label block">
            {t('artStyle.title')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ART_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => setArtStyle(style.value)}
                className={`glass-btn-base px-3 py-2 rounded-lg text-sm border transition-all justify-start ${artStyle === style.value
                  ? 'glass-btn-tone-info border-[var(--glass-stroke-focus)]'
                  : 'glass-btn-soft border-[var(--glass-stroke-base)] text-[var(--glass-text-secondary)]'
                  }`}
              >
                <span>{style.preview}</span>
                <span>{style.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {createMode === 'reference' && (
        <div className="glass-surface-soft rounded-xl p-4 space-y-3 border border-[var(--glass-stroke-base)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--glass-tone-info-fg)]">
              <PhotoIcon className="w-4 h-4" />
              <span>{t('character.uploadReference')}</span>
            </div>
            <span className="text-xs text-[var(--glass-text-tertiary)]">{t('character.pasteHint')}</span>
          </div>

          <div className="glass-surface flex items-center gap-2 p-2 rounded-lg">
            <span className="text-xs text-[var(--glass-text-secondary)] shrink-0">{t('character.generationMode')}：</span>
            {(() => {
              const subTabs = ['direct', 'extract'] as const
              const subIdx = subTabs.indexOf(referenceSubMode)
              return (
                <div className="flex-1 rounded-md p-0.5" style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <div className="relative grid gap-1" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                    <div
                      className="absolute bottom-0.5 top-0.5 rounded-sm bg-white transition-transform duration-200"
                      style={{
                        boxShadow: '0 1px 4px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(0,0,0,0.06)',
                        width: 'calc(100% / 2)',
                        transform: `translateX(${subIdx * 100}%)`,
                      }}
                    />
                    <button
                      onClick={() => setReferenceSubMode('direct')}
                      className={`relative z-[1] px-3 py-1.5 text-xs rounded-sm transition-colors cursor-pointer ${referenceSubMode === 'direct' ? 'text-[var(--glass-text-primary)] font-medium' : 'text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]'}`}
                    >
                      {t('character.directGenerate')}
                    </button>
                    <button
                      onClick={() => setReferenceSubMode('extract')}
                      className={`relative z-[1] px-3 py-1.5 text-xs rounded-sm transition-colors cursor-pointer ${referenceSubMode === 'extract' ? 'text-[var(--glass-text-primary)] font-medium' : 'text-[var(--glass-text-tertiary)] hover:text-[var(--glass-text-secondary)]'}`}
                    >
                      {t('character.extractPrompt')}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>

          {referenceSubMode === 'extract' && (
            <button
              onClick={handleExtractDescription}
              disabled={isExtracting || referenceImagesBase64.length === 0}
              className="glass-btn-base glass-btn-tone-info w-full px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isExtracting ? t('aiDesign.generating') : t('character.extractFirst')}
            </button>
          )}

          <CharacterCreationPreview
            referenceImagesBase64={referenceImagesBase64}
            fileInputRef={fileInputRef}
            onDrop={handleDrop}
            onFileSelect={handleFileSelect}
            onClearReference={handleClearReference}
          />

          <button
            onClick={handleCreateWithReference}
            disabled={isSubmitting || !name.trim() || referenceImagesBase64.length === 0}
            className={`glass-btn-base w-full px-4 py-2.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm ${referenceSubMode === 'extract'
              ? 'glass-btn-tone-info'
              : 'glass-btn-primary'
              }`}
          >
            {isSubmitting ? t('common.creating') : t('character.convertToSheet')}
          </button>
        </div>
      )}

      {createMode === 'description' && (
        <>
          {!isSubAppearance && (
            <div className="glass-surface-soft rounded-xl p-4 space-y-3 border border-[var(--glass-stroke-base)]">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--glass-tone-info-fg)]">
                <SparklesIcon className="w-4 h-4" />
                <span>{t('aiDesign.title')}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder={t('aiDesign.placeholder')}
                  className="glass-input-base flex-1 px-3 py-2 text-sm"
                  disabled={isAiDesigning}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAiDesign()
                    }
                  }}
                />
                <button
                  onClick={handleAiDesign}
                  disabled={isAiDesigning || !aiInstruction.trim()}
                  className="glass-btn-base glass-btn-tone-info px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                >
                  {isAiDesigning ? t('aiDesign.generating') : t('aiDesign.generate')}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="glass-field-label block">
              {isSubAppearance ? t('character.modifyDescription') : t('character.description')} <span className="text-[var(--glass-tone-danger-fg)]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={isSubAppearance
                ? t('character.modifyDescriptionPlaceholder')
                : t('character.descPlaceholder')}
              className="glass-textarea-base w-full px-3 py-2 text-sm resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (isSubAppearance
              ? !selectedCharacterId.trim() || !changeReason.trim() || !description.trim()
              : !name.trim() || !description.trim())}
            className="glass-btn-base glass-btn-primary w-full px-4 py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? t('common.adding') : t('common.add')}
          </button>
        </>
      )}

      {createMode === 'digitalHuman' && (
        <div className="glass-surface-soft rounded-xl p-4 space-y-3 border border-[var(--glass-stroke-base)]">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--glass-tone-info-fg)]">
            <AppIcon name="user" className="w-4 h-4" />
            <span>{t('character.selectDigitalHuman')}</span>
          </div>

          {readyDigitalHumans.length === 0 ? (
            <p className="text-sm text-[var(--glass-text-tertiary)] py-4 text-center">
              {t('character.noDigitalHumans')}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {readyDigitalHumans.map((dh) => (
                <button
                  key={dh.id}
                  onClick={() => handleSelectDigitalHuman(dh)}
                  disabled={false}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                    selectedDHId === dh.id
                      ? 'border-[var(--glass-tone-info-fg)] ring-1 ring-[var(--glass-tone-info-fg)]'
                      : 'border-transparent hover:border-[var(--glass-stroke-focus)]'
                  }`}
                >
                  <img
                    src={dh.avatarImageUrl || dh.avatarImageUrls[0]}
                    alt={dh.name}
                    className="w-full aspect-square object-cover"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[11px] py-0.5 text-center truncate px-1">
                    {dh.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedDH && (
            <div className="text-xs text-[var(--glass-text-secondary)] flex items-center gap-1">
              <AppIcon name="check" className="w-3 h-3 text-[var(--glass-tone-success-fg)]" />
              {t('character.selectedDH')}: {selectedDH.name}
              {directReferenceUrls.length > 0 && <AppIcon name="check" className="w-3 h-3 text-[var(--glass-tone-success-fg)]" />}
            </div>
          )}

          <button
            onClick={handleCreateWithReference}
            disabled={isSubmitting || !name.trim() || directReferenceUrls.length === 0}
            className="glass-btn-base glass-btn-primary w-full px-4 py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting ? t('common.creating') : t('character.convertToSheet')}
          </button>
        </div>
      )}
    </div>
  )
}
