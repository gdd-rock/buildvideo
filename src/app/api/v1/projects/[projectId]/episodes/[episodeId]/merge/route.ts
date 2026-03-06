import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'

/**
 * POST /api/v1/projects/:projectId/episodes/:episodeId/merge — 一键合成视频
 * Body: { transition?: 'none' | 'fade', locale? }
 */
export const POST = apiV1Handler(async (request, ctx, routeContext) => {
  const { projectId, episodeId } = await routeContext.params

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
  })
  if (!project) throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)

  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    select: { id: true },
  })
  if (!episode) throw new ApiV1Error('NOT_FOUND', 'Episode not found', 404)

  const body = await request.json().catch(() => ({}))
  const locale = (body.locale as string) || 'zh'
  const transition = (body.transition as 'none' | 'fade') || 'none'

  const result = await submitTask({
    userId: ctx.userId,
    locale: locale as 'zh' | 'en',
    projectId,
    episodeId,
    type: TASK_TYPE.VIDEO_MERGE,
    targetType: 'NovelPromotionEpisode',
    targetId: episodeId,
    payload: { episodeId, transition },
    dedupeKey: `video_merge:${episodeId}`,
    maxAttempts: 2,
    billingInfo: { billable: false },
  })

  return v1Success({ taskId: result.taskId, status: result.status }, 201)
})
