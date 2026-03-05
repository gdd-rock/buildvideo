'use client'

import { useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { shouldShowError } from '@/lib/error-utils'
import {
  useAiCreateProjectCharacter,
  useAiDesignCharacter,
  useCreateAssetHubCharacter,
  useCreateProjectCharacter,
  useCreateProjectCharacterAppearance,
  useExtractAssetHubReferenceCharacterDescription,
  useExtractProjectReferenceCharacterDescription,
  useUploadAssetHubTempMedia,
  useUploadProjectTempMedia,
} from '@/lib/query/hooks'

type Mode = 'asset-hub' | 'project'

interface UseCharacterCreationSubmitParams {
  mode: Mode
  folderId?: string | null
  projectId?: string
  name: string
  description: string
  aiInstruction: string
  artStyle: string
  referenceImagesBase64: string[]
  directReferenceUrls: string[]
  referenceSubMode: 'direct' | 'extract'
  isSubAppearance: boolean
  selectedCharacterId: string
  changeReason: string
  setDescription: (value: string) => void
  setAiInstruction: (value: string) => void
  onSuccess: () => void
  onClose: () => void
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function useCharacterCreationSubmit({
  mode,
  folderId,
  projectId,
  name,
  description,
  aiInstruction,
  artStyle,
  referenceImagesBase64,
  directReferenceUrls,
  referenceSubMode,
  isSubAppearance,
  selectedCharacterId,
  changeReason,
  setDescription,
  setAiInstruction,
  onSuccess,
  onClose,
}: UseCharacterCreationSubmitParams) {
  const t = useTranslations('assetModal')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAiDesigning, setIsAiDesigning] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)

  const uploadAssetHubTemp = useUploadAssetHubTempMedia()
  const uploadProjectTemp = useUploadProjectTempMedia()
  const aiDesignAssetHubCharacter = useAiDesignCharacter()
  const aiCreateProjectCharacter = useAiCreateProjectCharacter(projectId ?? '')
  const extractAssetHubDescription = useExtractAssetHubReferenceCharacterDescription()
  const extractProjectDescription = useExtractProjectReferenceCharacterDescription(projectId ?? '')
  const createAssetHubCharacter = useCreateAssetHubCharacter()
  const createProjectCharacter = useCreateProjectCharacter(projectId ?? '')
  const createProjectAppearance = useCreateProjectCharacterAppearance(projectId ?? '')

  const uploadReferenceImages = useCallback(async () => {
    const uploadMutation = mode === 'asset-hub' ? uploadAssetHubTemp : uploadProjectTemp
    return Promise.all(
      referenceImagesBase64.map(async (base64) => {
        const data = await uploadMutation.mutateAsync({ imageBase64: base64 })
        if (!data.url) throw new Error(t('errors.uploadFailed'))
        return data.url
      }),
    )
  }, [mode, referenceImagesBase64, t, uploadAssetHubTemp, uploadProjectTemp])

  const handleExtractDescription = useCallback(async () => {
    if (referenceImagesBase64.length === 0) return

    try {
      setIsExtracting(true)
      const referenceImageUrls = await uploadReferenceImages()
      const result = mode === 'asset-hub'
        ? await extractAssetHubDescription.mutateAsync(referenceImageUrls)
        : await extractProjectDescription.mutateAsync(referenceImageUrls)
      if (result?.description) {
        setDescription(result.description)
      }
    } catch (error: unknown) {
      if (shouldShowError(error)) {
        alert(getErrorMessage(error, t('errors.extractDescriptionFailed')))
      }
    } finally {
      setIsExtracting(false)
    }
  }, [
    extractAssetHubDescription,
    extractProjectDescription,
    mode,
    referenceImagesBase64.length,
    setDescription,
    t,
    uploadReferenceImages,
  ])

  const handleCreateWithReference = useCallback(async () => {
    const hasImages = referenceImagesBase64.length > 0 || directReferenceUrls.length > 0
    if (!name.trim() || !hasImages) return

    try {
      setIsSubmitting(true)
      // 数字人流程：直接使用已有 COS URL，无需重新上传
      const referenceImageUrls = directReferenceUrls.length > 0
        ? directReferenceUrls
        : await uploadReferenceImages()

      let finalDescription = description.trim()
      if (referenceSubMode === 'extract') {
        const result = mode === 'asset-hub'
          ? await extractAssetHubDescription.mutateAsync(referenceImageUrls)
          : await extractProjectDescription.mutateAsync(referenceImageUrls)
        finalDescription = result?.description || finalDescription
      }

      // 子形象模式：添加到现有角色
      if (isSubAppearance && mode === 'project' && selectedCharacterId.trim()) {
        await createProjectAppearance.mutateAsync({
          characterId: selectedCharacterId,
          changeReason: changeReason.trim() || name.trim(),
          description: finalDescription || t('character.defaultDescription', { name: name.trim() }),
          referenceImageUrls,
          artStyle,
        })
        onSuccess()
        onClose()
        return
      }

      if (mode === 'asset-hub') {
        await createAssetHubCharacter.mutateAsync({
          name: name.trim(),
          description: finalDescription || t('character.defaultDescription', { name: name.trim() }),
          folderId: folderId ?? null,
          artStyle,
          generateFromReference: true,
          referenceImageUrls,
          customDescription: referenceSubMode === 'extract' ? finalDescription : undefined,
        })
      } else {
        await createProjectCharacter.mutateAsync({
          name: name.trim(),
          description: finalDescription || t('character.defaultDescription', { name: name.trim() }),
          artStyle,
          generateFromReference: true,
          referenceImageUrls,
          customDescription: referenceSubMode === 'extract' ? finalDescription : undefined,
        })
      }

      onSuccess()
      onClose()
    } catch (error: unknown) {
      if (shouldShowError(error)) {
        alert(getErrorMessage(error, t('errors.createFailed')))
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    artStyle,
    changeReason,
    createAssetHubCharacter,
    createProjectAppearance,
    createProjectCharacter,
    description,
    directReferenceUrls,
    extractAssetHubDescription,
    extractProjectDescription,
    folderId,
    isSubAppearance,
    mode,
    name,
    onClose,
    onSuccess,
    referenceImagesBase64.length,
    referenceSubMode,
    selectedCharacterId,
    t,
    uploadReferenceImages,
  ])

  const handleAiDesign = useCallback(async () => {
    if (!aiInstruction.trim()) return

    try {
      setIsAiDesigning(true)
      const result = mode === 'asset-hub'
        ? await aiDesignAssetHubCharacter.mutateAsync(aiInstruction)
        : await aiCreateProjectCharacter.mutateAsync({ userInstruction: aiInstruction })

      if (result?.prompt) {
        setDescription(result.prompt)
        setAiInstruction('')
      }
    } catch (error: unknown) {
      if (shouldShowError(error)) {
        alert(getErrorMessage(error, t('errors.aiDesignFailed')))
      }
    } finally {
      setIsAiDesigning(false)
    }
  }, [aiCreateProjectCharacter, aiDesignAssetHubCharacter, aiInstruction, mode, setAiInstruction, setDescription, t])

  const handleSubmit = useCallback(async () => {
    if (isSubAppearance) {
      if (!selectedCharacterId.trim() || !changeReason.trim() || !description.trim()) return
      try {
        setIsSubmitting(true)
        await createProjectAppearance.mutateAsync({
          characterId: selectedCharacterId,
          changeReason: changeReason.trim(),
          description: description.trim(),
        })
        onSuccess()
        onClose()
      } catch (error: unknown) {
        if (shouldShowError(error)) {
          alert(getErrorMessage(error, t('errors.addSubAppearanceFailed')))
        }
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    if (!name.trim() || !description.trim()) return
    try {
      setIsSubmitting(true)
      if (mode === 'asset-hub') {
        await createAssetHubCharacter.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          folderId: folderId ?? null,
          artStyle,
        })
      } else {
        await createProjectCharacter.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          artStyle,
        })
      }
      onSuccess()
      onClose()
    } catch (error: unknown) {
      if (shouldShowError(error)) {
        alert(getErrorMessage(error, t('errors.createFailed')))
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    artStyle,
    changeReason,
    createAssetHubCharacter,
    createProjectAppearance,
    createProjectCharacter,
    description,
    folderId,
    isSubAppearance,
    mode,
    name,
    onClose,
    onSuccess,
    selectedCharacterId,
    t,
  ])

  return {
    isSubmitting,
    isAiDesigning,
    isExtracting,
    handleExtractDescription,
    handleCreateWithReference,
    handleAiDesign,
    handleSubmit,
  }
}
