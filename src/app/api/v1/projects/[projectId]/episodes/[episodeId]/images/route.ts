import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'
import { getProjectModelConfig } from '@/lib/config-service'

/**
 * POST /api/v1/projects/:projectId/episodes/:episodeId/images — 批量生成分镜图片
 * Body: { panelId?, locale? }
 * 不传 panelId 则批量生成所有无图片的面板
 */
export const POST = apiV1Handler(async (request, ctx, routeContext) => {
  const { projectId, episodeId } = await routeContext.params

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
  })
  if (!project) throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)

  const body = await request.json().catch(() => ({}))
  const locale = (body.locale as string) || 'zh'
  const panelId = body.panelId as string | undefined

  const modelConfig = await getProjectModelConfig(projectId, ctx.userId)

  // 查找需要生成图片的面板
  const panels = panelId
    ? await prisma.novelPromotionPanel.findMany({
        where: { id: panelId },
        select: { id: true },
      })
    : await prisma.novelPromotionPanel.findMany({
        where: {
          storyboard: { episodeId },
          imageUrl: null,
        },
        select: { id: true },
      })

  if (panels.length === 0) {
    throw new ApiV1Error('INVALID_STATE', panelId ? 'Panel not found' : 'No panels without images', 400)
  }

  const results = await Promise.all(
    panels.map(async panel => {
      const r = await submitTask({
        userId: ctx.userId,
        locale: locale as 'zh' | 'en',
        projectId,
        episodeId,
        type: TASK_TYPE.IMAGE_PANEL,
        targetType: 'NovelPromotionPanel',
        targetId: panel.id,
        payload: {
          candidateCount: 1,
          imageModel: modelConfig.storyboardModel,
        },
        dedupeKey: `image_panel:${panel.id}:1`,
      })
      return { panelId: panel.id, taskId: r.taskId, status: r.status }
    }),
  )

  return v1Success({ submitted: results.length, tasks: results }, 201)
})
