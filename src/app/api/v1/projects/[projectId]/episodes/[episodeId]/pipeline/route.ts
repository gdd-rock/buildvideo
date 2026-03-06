import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'

/**
 * POST /api/v1/projects/:projectId/episodes/:episodeId/pipeline — 一键全流程
 * Body: {
 *   transition?: 'none' | 'fade',  // 合成转场
 *   skipStages?: string[],          // 跳过的阶段
 *   locale?: 'zh' | 'en',
 * }
 *
 * 自动按顺序执行：分析 → 脚本 → 分镜 → 图片 → 视频 → 配音 → 口型 → 合成
 * 返回 taskId，通过 GET /api/v1/tasks/:taskId 轮询进度
 */
export const POST = apiV1Handler(async (request, ctx, routeContext) => {
  const { projectId, episodeId } = await routeContext.params

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
  })
  if (!project) throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)

  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    select: { id: true, novelText: true },
  })
  if (!episode) throw new ApiV1Error('NOT_FOUND', 'Episode not found', 404)
  if (!episode.novelText) throw new ApiV1Error('INVALID_STATE', 'Episode has no novel text. Set novelText first.', 400)

  const body = await request.json().catch(() => ({}))
  const locale = (body.locale as string) || 'zh'
  const transition = body.transition || 'none'
  const skipStages = body.skipStages || []

  const result = await submitTask({
    userId: ctx.userId,
    locale: locale as 'zh' | 'en',
    projectId,
    episodeId,
    type: TASK_TYPE.PIPELINE,
    targetType: 'NovelPromotionEpisode',
    targetId: episodeId,
    payload: { transition, skipStages },
    dedupeKey: `pipeline:${episodeId}`,
    maxAttempts: 1,
    billingInfo: { billable: false },
  })

  return v1Success({ taskId: result.taskId, status: result.status }, 201)
})
