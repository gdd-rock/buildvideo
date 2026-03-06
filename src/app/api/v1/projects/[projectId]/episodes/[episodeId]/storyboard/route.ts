import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'

/**
 * POST /api/v1/projects/:projectId/episodes/:episodeId/storyboard — 脚本转分镜
 * Body: { locale? }
 */
export const POST = apiV1Handler(async (request, ctx, routeContext) => {
  const { projectId, episodeId } = await routeContext.params

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
  })
  if (!project) throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)

  // 检查是否有脚本（clips）
  const clipCount = await prisma.novelPromotionClip.count({
    where: { episodeId },
  })
  if (clipCount === 0) throw new ApiV1Error('INVALID_STATE', 'No script clips found. Run script generation first.', 400)

  const body = await request.json().catch(() => ({}))
  const locale = (body.locale as string) || 'zh'

  const result = await submitTask({
    userId: ctx.userId,
    locale: locale as 'zh' | 'en',
    projectId,
    episodeId,
    type: TASK_TYPE.SCRIPT_TO_STORYBOARD_RUN,
    targetType: 'NovelPromotionEpisode',
    targetId: episodeId,
    payload: { displayMode: 'detail', sync: 1 },
    dedupeKey: `script_to_storyboard_run:${episodeId}`,
    priority: 2,
  })

  return v1Success({ taskId: result.taskId, status: result.status }, 201)
})
