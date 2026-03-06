import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'

/**
 * POST /api/v1/projects/:projectId/episodes/:episodeId/analyze — 分析小说文本
 * Body: { locale? }
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
  if (!episode.novelText) throw new ApiV1Error('INVALID_STATE', 'Episode has no novel text', 400)

  const body = await request.json().catch(() => ({}))
  const locale = (body.locale as string) || 'zh'

  const result = await submitTask({
    userId: ctx.userId,
    locale: locale as 'zh' | 'en',
    projectId,
    episodeId,
    type: TASK_TYPE.ANALYZE_NOVEL,
    targetType: 'NovelPromotionProject',
    targetId: projectId,
    payload: { displayMode: 'detail', sync: 1 },
    dedupeKey: `analyze_novel:${projectId}:${episodeId}`,
    priority: 1,
  })

  return v1Success({ taskId: result.taskId, status: result.status }, 201)
})
