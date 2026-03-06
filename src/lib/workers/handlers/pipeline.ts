import { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE, TASK_STATUS, type TaskJobData } from '@/lib/task/types'
import { logInfo, logError } from '@/lib/logging/core'
import { reportTaskProgress } from '@/lib/workers/shared'
import { getProjectModelConfig } from '@/lib/config-service'
import type { Locale } from '@/i18n/routing'

const POLL_INTERVAL = 3000
const POLL_TIMEOUT = 600_000 // 10 分钟

type PipelineStage =
  | 'analyze'
  | 'script'
  | 'storyboard'
  | 'images'
  | 'videos'
  | 'voices'
  | 'lip-sync'
  | 'merge'

const STAGES: PipelineStage[] = [
  'analyze',
  'script',
  'storyboard',
  'images',
  'videos',
  'voices',
  'lip-sync',
  'merge',
]

const STAGE_LABELS: Record<PipelineStage, string> = {
  'analyze': '分析小说',
  'script': '生成脚本',
  'storyboard': '生成分镜',
  'images': '生成图片',
  'videos': '生成视频',
  'voices': '生成配音',
  'lip-sync': '口型同步',
  'merge': '合成视频',
}

const STAGE_PROGRESS: Record<PipelineStage, [number, number]> = {
  'analyze': [5, 12],
  'script': [12, 22],
  'storyboard': [22, 32],
  'images': [32, 52],
  'videos': [52, 72],
  'voices': [72, 82],
  'lip-sync': [82, 90],
  'merge': [90, 98],
}

async function waitForTask(taskId: string, timeoutMs = POLL_TIMEOUT): Promise<'completed' | 'failed'> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true },
    })
    if (!task) throw new Error(`Task ${taskId} not found`)
    if (task.status === TASK_STATUS.COMPLETED) return 'completed'
    if (task.status === TASK_STATUS.FAILED) return 'failed'
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
  throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`)
}

async function waitForTasks(taskIds: string[], timeoutMs = POLL_TIMEOUT): Promise<{ completed: number; failed: number }> {
  const start = Date.now()
  const remaining = new Set(taskIds)
  let completed = 0
  let failed = 0

  while (remaining.size > 0 && Date.now() - start < timeoutMs) {
    const tasks = await prisma.task.findMany({
      where: { id: { in: [...remaining] } },
      select: { id: true, status: true },
    })
    for (const task of tasks) {
      if (task.status === TASK_STATUS.COMPLETED) {
        remaining.delete(task.id)
        completed++
      } else if (task.status === TASK_STATUS.FAILED) {
        remaining.delete(task.id)
        failed++
      }
    }
    if (remaining.size > 0) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL))
    }
  }

  if (remaining.size > 0) {
    failed += remaining.size
  }

  return { completed, failed }
}

/**
 * 全流程 Pipeline Worker
 * 按顺序执行：分析 → 脚本 → 分镜 → 图片 → 视频 → 配音 → 口型 → 合成
 */
export async function handlePipelineTask(job: Job<TaskJobData>) {
  const { projectId, episodeId, userId, payload, locale } = job.data
  const taskLocale = (locale || 'zh') as Locale
  const skipStages = new Set((payload?.skipStages as string[]) || [])

  if (!episodeId) throw new Error('episodeId is required for pipeline')

  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    select: { id: true, novelText: true },
  })
  if (!episode) throw new Error(`Episode ${episodeId} not found`)
  if (!episode.novelText) throw new Error('Episode has no novel text')

  const modelConfig = await getProjectModelConfig(projectId, userId)
  const stageResults: Record<string, unknown> = {}

  for (const stage of STAGES) {
    if (skipStages.has(stage)) {
      logInfo(`[Pipeline] Skipping stage: ${stage}`)
      continue
    }

    const [progressStart, progressEnd] = STAGE_PROGRESS[stage]
    await reportTaskProgress(job, progressStart, {
      stage,
      stageLabel: STAGE_LABELS[stage],
      displayMode: 'detail',
    })
    logInfo(`[Pipeline] Starting stage: ${stage} for episode ${episodeId}`)

    try {
      switch (stage) {
        case 'analyze': {
          const r = await submitTask({
            userId, locale: taskLocale, projectId, episodeId,
            type: TASK_TYPE.ANALYZE_NOVEL,
            targetType: 'NovelPromotionProject',
            targetId: projectId,
            payload: { displayMode: 'detail', sync: 1 },
            dedupeKey: `pipeline_analyze:${episodeId}:${job.data.taskId}`,
            priority: 1,
          })
          const status = await waitForTask(r.taskId)
          if (status === 'failed') throw new Error('Analyze stage failed')
          stageResults.analyze = { taskId: r.taskId }
          break
        }

        case 'script': {
          const ep = await prisma.novelPromotionEpisode.findUnique({
            where: { id: episodeId },
            select: { novelText: true },
          })
          const r = await submitTask({
            userId, locale: taskLocale, projectId, episodeId,
            type: TASK_TYPE.STORY_TO_SCRIPT_RUN,
            targetType: 'NovelPromotionEpisode',
            targetId: episodeId,
            payload: { displayMode: 'detail', sync: 1, content: ep?.novelText || '' },
            dedupeKey: `pipeline_script:${episodeId}:${job.data.taskId}`,
            priority: 2,
          })
          const status = await waitForTask(r.taskId)
          if (status === 'failed') throw new Error('Script stage failed')
          stageResults.script = { taskId: r.taskId }
          break
        }

        case 'storyboard': {
          const r = await submitTask({
            userId, locale: taskLocale, projectId, episodeId,
            type: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
            targetType: 'NovelPromotionEpisode',
            targetId: episodeId,
            payload: { displayMode: 'detail', sync: 1 },
            dedupeKey: `pipeline_storyboard:${episodeId}:${job.data.taskId}`,
            priority: 2,
          })
          const status = await waitForTask(r.taskId)
          if (status === 'failed') throw new Error('Storyboard stage failed')
          stageResults.storyboard = { taskId: r.taskId }
          break
        }

        case 'images': {
          const panels = await prisma.novelPromotionPanel.findMany({
            where: { storyboard: { episodeId }, imageUrl: null },
            select: { id: true },
          })
          if (panels.length === 0) {
            logInfo(`[Pipeline] No panels need images, skipping`)
            break
          }
          const tasks = await Promise.all(
            panels.map(p =>
              submitTask({
                userId, locale: taskLocale, projectId, episodeId,
                type: TASK_TYPE.IMAGE_PANEL,
                targetType: 'NovelPromotionPanel',
                targetId: p.id,
                payload: { candidateCount: 1, imageModel: modelConfig.storyboardModel },
                dedupeKey: `pipeline_image:${p.id}:${job.data.taskId}`,
              }),
            ),
          )
          const result = await waitForTasks(tasks.map(t => t.taskId))
          stageResults.images = { total: panels.length, ...result }
          // 中间进度
          await reportTaskProgress(job, progressEnd - 2, {
            stage, stageLabel: `${STAGE_LABELS[stage]} (${result.completed}/${panels.length})`,
          })
          break
        }

        case 'videos': {
          const panels = await prisma.novelPromotionPanel.findMany({
            where: {
              storyboard: { episodeId },
              imageUrl: { not: null },
              OR: [{ videoUrl: null }, { videoUrl: '' }],
            },
            select: { id: true },
          })
          if (panels.length === 0) {
            logInfo(`[Pipeline] No panels need videos, skipping`)
            break
          }
          const tasks = await Promise.all(
            panels.map(p =>
              submitTask({
                userId, locale: taskLocale, projectId, episodeId,
                type: TASK_TYPE.VIDEO_PANEL,
                targetType: 'NovelPromotionPanel',
                targetId: p.id,
                payload: { videoModel: modelConfig.videoModel },
                dedupeKey: `pipeline_video:${p.id}:${job.data.taskId}`,
              }),
            ),
          )
          const result = await waitForTasks(tasks.map(t => t.taskId))
          stageResults.videos = { total: panels.length, ...result }
          break
        }

        case 'voices': {
          const lines = await prisma.novelPromotionVoiceLine.findMany({
            where: { episodeId, audioUrl: null },
            select: { id: true },
          })
          if (lines.length === 0) {
            logInfo(`[Pipeline] No voice lines need audio, skipping`)
            break
          }
          const tasks = await Promise.all(
            lines.map(l =>
              submitTask({
                userId, locale: taskLocale, projectId, episodeId,
                type: TASK_TYPE.VOICE_LINE,
                targetType: 'NovelPromotionVoiceLine',
                targetId: l.id,
                payload: { episodeId, lineId: l.id },
                dedupeKey: `pipeline_voice:${l.id}:${job.data.taskId}`,
              }),
            ),
          )
          const result = await waitForTasks(tasks.map(t => t.taskId))
          stageResults.voices = { total: lines.length, ...result }
          break
        }

        case 'lip-sync': {
          const voiceLines = await prisma.novelPromotionVoiceLine.findMany({
            where: { episodeId, audioUrl: { not: null }, matchedPanelId: { not: null } },
            select: { id: true, matchedPanelId: true },
          })
          const panelIds = voiceLines.map(vl => vl.matchedPanelId).filter((id): id is string => !!id)
          const panels = await prisma.novelPromotionPanel.findMany({
            where: { id: { in: panelIds }, videoUrl: { not: null }, lipSyncVideoUrl: null },
            select: { id: true },
          })
          const panelSet = new Set(panels.map(p => p.id))
          const pairs = voiceLines.filter(vl => vl.matchedPanelId && panelSet.has(vl.matchedPanelId))
          if (pairs.length === 0) {
            logInfo(`[Pipeline] No panels need lip sync, skipping`)
            break
          }
          const tasks = await Promise.all(
            pairs.map(vl =>
              submitTask({
                userId, locale: taskLocale, projectId,
                type: TASK_TYPE.LIP_SYNC,
                targetType: 'NovelPromotionPanel',
                targetId: vl.matchedPanelId!,
                payload: { voiceLineId: vl.id },
                dedupeKey: `pipeline_lipsync:${vl.matchedPanelId}:${job.data.taskId}`,
              }),
            ),
          )
          const result = await waitForTasks(tasks.map(t => t.taskId))
          stageResults.lipSync = { total: pairs.length, ...result }
          break
        }

        case 'merge': {
          const transition = (payload?.transition as string) || 'none'
          const r = await submitTask({
            userId, locale: taskLocale, projectId, episodeId,
            type: TASK_TYPE.VIDEO_MERGE,
            targetType: 'NovelPromotionEpisode',
            targetId: episodeId,
            payload: { episodeId, transition },
            dedupeKey: `pipeline_merge:${episodeId}:${job.data.taskId}`,
            maxAttempts: 2,
            billingInfo: { billable: false },
          })
          const status = await waitForTask(r.taskId)
          if (status === 'failed') throw new Error('Merge stage failed')
          stageResults.merge = { taskId: r.taskId }
          break
        }
      }

      logInfo(`[Pipeline] Completed stage: ${stage}`)
      await reportTaskProgress(job, progressEnd, {
        stage, stageLabel: `${STAGE_LABELS[stage]} ✓`,
      })
    } catch (err) {
      logError(`[Pipeline] Stage ${stage} failed:`, err)
      throw new Error(`Pipeline failed at stage "${stage}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { success: true, stages: stageResults }
}
