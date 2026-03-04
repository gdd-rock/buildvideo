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

  // 使用照片作为参考图，生成数字人形象图
  const basePrompt = buildPrompt({
    promptId: PROMPT_IDS.CHARACTER_REFERENCE_TO_SHEET,
    locale: job.data.locale,
  })
  let prompt = basePrompt
  if (artStyle) {
    prompt = `${prompt}，${artStyle}`
  }

  const { apiKey: falApiKey } = await getProviderConfig(job.data.userId, 'fal')

  await reportTaskProgress(job, 35, {
    stage: 'digital_human_generate',
    stageLabel: '生成数字人形象图',
    displayMode: 'detail',
  })

  const imageCount = 3
  const cosKeys: string[] = []

  for (let i = 0; i < imageCount; i++) {
    await assertTaskActive(job, `digital_human_generate_${i + 1}`)

    try {
      const result = await generateImage(
        job.data.userId,
        imageModel,
        prompt,
        {
          referenceImages: [photoSignedUrl],
          aspectRatio: '3:4',
        },
      )

      let finalImageUrl = result.imageUrl
      const requestId = typeof result.requestId === 'string' ? result.requestId : ''
      const endpoint = typeof result.endpoint === 'string' ? result.endpoint : ''

      if (result.async && requestId && endpoint) {
        if (!falApiKey) throw new Error('Async result requires falApiKey')
        for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
          await assertTaskActive(job, `digital_human_poll_${i + 1}_${attempt + 1}`)
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
          logPrefix: `[digital-human:${i + 1}]`,
        })
        const buffer = Buffer.from(await imgRes.arrayBuffer())
        const key = generateUniqueKey(`digital-human-avatar-${Date.now()}-${i}`, 'jpg')
        const cosKey = await uploadToCOS(buffer, key)
        cosKeys.push(cosKey)
      }
    } catch {
      // 单张失败不影响其它
    }

    await reportTaskProgress(job, 35 + Math.floor(((i + 1) / imageCount) * 50), {
      stage: `digital_human_generate_${i + 1}_done`,
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
