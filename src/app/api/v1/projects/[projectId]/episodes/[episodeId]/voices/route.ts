import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'

/**
 * POST /api/v1/projects/:projectId/episodes/:episodeId/voices — 批量生成配音
 * Body: { lineId?, locale? }
 * 不传 lineId 则批量生成所有无音频的配音行
 */
export const POST = apiV1Handler(async (request, ctx, routeContext) => {
  const { projectId, episodeId } = await routeContext.params

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
  })
  if (!project) throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)

  const body = await request.json().catch(() => ({}))
  const locale = (body.locale as string) || 'zh'
  const lineId = body.lineId as string | undefined

  const lines = lineId
    ? await prisma.novelPromotionVoiceLine.findMany({
        where: { id: lineId, episodeId },
        select: { id: true },
      })
    : await prisma.novelPromotionVoiceLine.findMany({
        where: { episodeId, audioUrl: null },
        orderBy: { lineIndex: 'asc' },
        select: { id: true },
      })

  if (lines.length === 0) {
    throw new ApiV1Error('INVALID_STATE', lineId ? 'Voice line not found' : 'No voice lines without audio', 400)
  }

  const results = await Promise.all(
    lines.map(async line => {
      const r = await submitTask({
        userId: ctx.userId,
        locale: locale as 'zh' | 'en',
        projectId,
        episodeId,
        type: TASK_TYPE.VOICE_LINE,
        targetType: 'NovelPromotionVoiceLine',
        targetId: line.id,
        payload: { episodeId, lineId: line.id },
        dedupeKey: `voice_line:${line.id}`,
      })
      return { lineId: line.id, taskId: r.taskId, status: r.status }
    }),
  )

  return v1Success({ submitted: results.length, tasks: results }, 201)
})
