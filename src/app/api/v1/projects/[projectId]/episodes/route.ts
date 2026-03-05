import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'

/**
 * POST /api/v1/projects/:projectId/episodes — 创建剧集
 * Body: { name, novelText?, description? }
 */
export const POST = apiV1Handler(async (request, ctx, routeContext) => {
  const { projectId } = await routeContext.params

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
    include: { novelPromotionData: { select: { id: true } } },
  })
  if (!project) {
    throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)
  }
  if (!project.novelPromotionData) {
    throw new ApiV1Error('INVALID_STATE', 'Project has no novel promotion data', 400)
  }

  const body = await request.json()
  const { name, novelText, description } = body as {
    name?: string
    novelText?: string
    description?: string
  }

  if (!name?.trim()) {
    throw new ApiV1Error('INVALID_PARAMS', 'name is required')
  }

  // 自动分配 episodeNumber
  const maxEp = await prisma.novelPromotionEpisode.findFirst({
    where: { novelPromotionProjectId: project.novelPromotionData.id },
    orderBy: { episodeNumber: 'desc' },
    select: { episodeNumber: true },
  })
  const nextNumber = (maxEp?.episodeNumber ?? 0) + 1

  const episode = await prisma.novelPromotionEpisode.create({
    data: {
      novelPromotionProjectId: project.novelPromotionData.id,
      episodeNumber: nextNumber,
      name: name.trim(),
      description: description?.trim() || null,
      novelText: novelText || null,
    },
  })

  // 更新项目 lastEpisodeId
  await prisma.novelPromotionProject.update({
    where: { id: project.novelPromotionData.id },
    data: { lastEpisodeId: episode.id },
  })

  return v1Success({
    id: episode.id,
    episodeNumber: episode.episodeNumber,
    name: episode.name,
    description: episode.description,
    hasNovelText: !!episode.novelText,
    createdAt: episode.createdAt,
  }, 201)
})

/**
 * GET /api/v1/projects/:projectId/episodes — 列出剧集
 */
export const GET = apiV1Handler(async (_request, ctx, routeContext) => {
  const { projectId } = await routeContext.params

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
    include: { novelPromotionData: { select: { id: true } } },
  })
  if (!project) {
    throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)
  }
  if (!project.novelPromotionData) {
    throw new ApiV1Error('INVALID_STATE', 'Project has no novel promotion data', 400)
  }

  const episodes = await prisma.novelPromotionEpisode.findMany({
    where: { novelPromotionProjectId: project.novelPromotionData.id },
    orderBy: { episodeNumber: 'asc' },
    select: {
      id: true,
      episodeNumber: true,
      name: true,
      description: true,
      novelText: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          storyboards: true,
          clips: true,
          voiceLines: true,
        },
      },
    },
  })

  return v1Success(
    episodes.map(ep => ({
      id: ep.id,
      episodeNumber: ep.episodeNumber,
      name: ep.name,
      description: ep.description,
      hasNovelText: !!ep.novelText,
      storyboardCount: ep._count.storyboards,
      clipCount: ep._count.clips,
      voiceLineCount: ep._count.voiceLines,
      createdAt: ep.createdAt,
      updatedAt: ep.updatedAt,
    })),
  )
})
