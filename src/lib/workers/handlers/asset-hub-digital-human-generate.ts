import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { generateImage } from '@/lib/generator-api'
import { queryFalStatus } from '@/lib/async-submit'
import { fetchWithTimeoutAndRetry } from '@/lib/ark-api'
import { getProviderConfig } from '@/lib/api-config'
import { getUserModelConfig } from '@/lib/config-service'
import { getArtStylePrompt } from '@/lib/constants'
import { encodeImageUrls } from '@/lib/contracts/image-urls-contract'
import { generateUniqueKey, getSignedUrl, uploadToCOS } from '@/lib/cos'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import type { TaskJobData } from '@/lib/task/types'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'

const POLL_MAX_ATTEMPTS = 60
const POLL_INTERVAL_MS = 2000

export async function handleAssetHubDigitalHumanGenerateTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const digitalHumanId = typeof payload.digitalHumanId === 'string' ? payload.digitalHumanId : null

  if (!digitalHumanId) {
    throw new Error('Missing digitalHumanId')
  }

  const dh = await prisma.globalDigitalHuman.findUnique({
    where: { id: digitalHumanId },
  })

  if (!dh) throw new Error('Digital human not found')
  if (!dh.photoUrl) throw new Error('Digital human has no photo')

  // 如果已有生成结果，先存档为历史版本
  if (dh.avatarImageUrl && dh.status === 'ready') {
    const lastVersion = await prisma.digitalHumanVersion.findFirst({
      where: { digitalHumanId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (lastVersion?.version ?? 0) + 1

    await prisma.digitalHumanVersion.create({
      data: {
        digitalHumanId,
        version: nextVersion,
        avatarImageUrl: dh.avatarImageUrl,
        avatarImageUrls: dh.avatarImageUrls,
      },
    })
  }

  // 标记为生成中
  await prisma.globalDigitalHuman.update({
    where: { id: digitalHumanId },
    data: { status: 'generating' },
  })

  await reportTaskProgress(job, 15, {
    stage: 'digital_human_prepare',
    stageLabel: '准备数字人生成参数',
    displayMode: 'detail',
  })

  const userConfig = await getUserModelConfig(job.data.userId)
  const imageModel = userConfig.characterModel
  if (!imageModel) {
    throw new Error('请先在设置页面配置角色图片模型')
  }

  const photoSignedUrl = getSignedUrl(dh.photoUrl, 3600)
  const artStyle = getArtStylePrompt(
    typeof payload.artStyle === 'string' ? payload.artStyle : undefined,
    job.data.locale,
  )

  // 5 个视图：头像、正面、侧面、背面、合成参考图
  const DIGITAL_HUMAN_VIEWS = [
    { promptId: PROMPT_IDS.DH_VIEW_AVATAR, aspectRatio: '1:1', label: 'avatar' },
    { promptId: PROMPT_IDS.DH_VIEW_FRONT, aspectRatio: '3:4', label: 'front' },
    { promptId: PROMPT_IDS.DH_VIEW_SIDE, aspectRatio: '3:4', label: 'side' },
    { promptId: PROMPT_IDS.DH_VIEW_BACK, aspectRatio: '3:4', label: 'back' },
    { promptId: PROMPT_IDS.DH_VIEW_SHEET, aspectRatio: '16:9', label: 'sheet' },
  ] as const

  const { apiKey: falApiKey } = await getProviderConfig(job.data.userId, 'fal')

  await reportTaskProgress(job, 35, {
    stage: 'digital_human_generate',
    stageLabel: '生成数字人形象图',
    displayMode: 'detail',
  })

  const imageCount = DIGITAL_HUMAN_VIEWS.length
  const cosKeys: string[] = []

  for (let i = 0; i < imageCount; i++) {
    const view = DIGITAL_HUMAN_VIEWS[i]
    await assertTaskActive(job, `digital_human_generate_${view.label}`)

    const viewPrompt = buildPrompt({
      promptId: view.promptId,
      locale: job.data.locale,
    })
    const prompt = artStyle ? `${viewPrompt}，${artStyle}` : viewPrompt

    try {
      const result = await generateImage(
        job.data.userId,
        imageModel,
        prompt,
        {
          referenceImages: [photoSignedUrl],
          aspectRatio: view.aspectRatio,
        },
      )

      let finalImageUrl = result.imageUrl
      const requestId = typeof result.requestId === 'string' ? result.requestId : ''
      const endpoint = typeof result.endpoint === 'string' ? result.endpoint : ''

      if (result.async && requestId && endpoint) {
        if (!falApiKey) throw new Error('Async result requires falApiKey')
        for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
          await assertTaskActive(job, `digital_human_poll_${view.label}_${attempt + 1}`)
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
          const status = await queryFalStatus(endpoint, requestId, falApiKey)
          if (status.completed && status.resultUrl) {
            finalImageUrl = status.resultUrl
            break
          }
          if (status.failed) {
            finalImageUrl = undefined
            break
          }
        }
      }

      if (result.success && finalImageUrl) {
        const imgRes = await fetchWithTimeoutAndRetry(finalImageUrl, {
          logPrefix: `[digital-human:${view.label}]`,
        })
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        const key = generateUniqueKey(`digital-human-${view.label}-${Date.now()}-${i}`, 'jpg')
        const cosKey = await uploadToCOS(buffer, key)
        cosKeys.push(cosKey)
      }
    } catch {
      // 单张失败不影响其它
    }

    await reportTaskProgress(job, 35 + Math.floor(((i + 1) / imageCount) * 50), {
      stage: `digital_human_generate_${view.label}_done`,
    })
  }

  if (cosKeys.length === 0) {
    await prisma.globalDigitalHuman.update({
      where: { id: digitalHumanId },
      data: { status: 'failed' },
    })
    throw new Error('数字人形象图生成失败')
  }

  await assertTaskActive(job, 'digital_human_persist')
  await prisma.globalDigitalHuman.update({
    where: { id: digitalHumanId },
    data: {
      avatarImageUrl: cosKeys[0],
      avatarImageUrls: encodeImageUrls(cosKeys),
      selectedIndex: 0,
      status: 'ready',
    },
  })

  await reportTaskProgress(job, 96, {
    stage: 'digital_human_done',
    stageLabel: '数字人形象生成完成',
    displayMode: 'detail',
  })

  return { success: true, digitalHumanId, imageCount: cosKeys.length }
}
