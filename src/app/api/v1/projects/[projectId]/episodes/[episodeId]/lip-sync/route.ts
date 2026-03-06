import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'

/**
 * POST /api/v1/projects/:projectId/episodes/:episodeId/lip-sync — 口型同步
 * Body: { panelId, voiceLineId, locale? }
 * 或 { all: true } 批量处理所有已匹配配音的面板
 */
export const POST = apiV1Handler(async (request, ctx, routeContext) => {
  const { projectId, episodeId } = await routeContext.params

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
  })
  if (!project) throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)

  const body = await request.json().catch(() => ({}))
  const locale = (body.locale as string) || 'zh'

  type PanelVoicePair = { panelId: string; voiceLineId: string }
  let pairs: PanelVoicePair[]

  if (body.all) {
    // 批量：查找所有有视频且已匹配配音、但无口型同步的面板
    const voiceLines = await prisma.novelPromotionVoiceLine.findMany({
      where: {
        episodeId,
        audioUrl: { not: null },
        matchedPanelId: { not: null },
      },
      select: { id: true, matchedPanelId: true },
    })

    const panelIds = voiceLines
      .map(vl => vl.matchedPanelId)
      .filter((id): id is string => !!id)

    const panels = await prisma.novelPromotionPanel.findMany({
      where: {
        id: { in: panelIds },
        videoUrl: { not: null },
        lipSyncVideoUrl: null,
      },
      select: { id: true },
    })

    const panelIdSet = new Set(panels.map(p => p.id))
    pairs = voiceLines
      .filter(vl => vl.matchedPanelId && panelIdSet.has(vl.matchedPanelId))
      .map(vl => ({ panelId: vl.matchedPanelId!, voiceLineId: vl.id }))
  } else {
    const { panelId, voiceLineId } = body as { panelId?: string; voiceLineId?: string }
    if (!panelId || !voiceLineId) {
      throw new ApiV1Error('INVALID_PARAMS', 'panelId and voiceLineId are required (or use all: true)', 400)
    }
    pairs = [{ panelId, voiceLineId }]
  }

  if (pairs.length === 0) {
    throw new ApiV1Error('INVALID_STATE', 'No panels ready for lip sync', 400)
  }

  const results = await Promise.all(
    pairs.map(async ({ panelId, voiceLineId }) => {
      const r = await submitTask({
        userId: ctx.userId,
        locale: locale as 'zh' | 'en',
        projectId,
        type: TASK_TYPE.LIP_SYNC,
        targetType: 'NovelPromotionPanel',
        targetId: panelId,
        payload: { voiceLineId },
        dedupeKey: `lip_sync:${panelId}:${voiceLineId}`,
      })
      return { panelId, voiceLineId, taskId: r.taskId, status: r.status }
    }),
  )

  return v1Success({ submitted: results.length, tasks: results }, 201)
})
