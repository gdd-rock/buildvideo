import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'
import { getSignedUrl } from '@/lib/cos'

function mediaUrl(mediaKey: string | null | undefined, legacyUrl: string | null | undefined): string | null {
  if (mediaKey) return getSignedUrl(mediaKey, 3600)
  return legacyUrl || null
}

/**
 * GET /api/v1/projects/:projectId/episodes/:episodeId — 获取剧集详情
 * 包含分镜、面板、配音等完整信息
 */
export const GET = apiV1Handler(async (_request, ctx, routeContext) => {
  const { projectId, episodeId } = await routeContext.params

  // 验证项目归属
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ctx.userId },
  })
  if (!project) {
    throw new ApiV1Error('NOT_FOUND', 'Project not found', 404)
  }

  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    include: {
      storyboards: {
        include: {
          panels: {
            orderBy: { panelIndex: 'asc' },
            include: {
              imageMedia: { select: { key: true } },
              videoMedia: { select: { key: true } },
              lipSyncVideoMedia: { select: { key: true } },
            },
          },
        },
      },
      voiceLines: {
        orderBy: { lineIndex: 'asc' },
        include: {
          audioMedia: { select: { key: true } },
        },
      },
      clips: true,
    },
  })

  if (!episode) {
    throw new ApiV1Error('NOT_FOUND', 'Episode not found', 404)
  }

  const storyboards = episode.storyboards.map(sb => ({
    id: sb.id,
    clipId: sb.clipId,
    panels: sb.panels.map(panel => ({
      id: panel.id,
      panelIndex: panel.panelIndex,
      description: panel.description,
      shotType: panel.shotType,
      cameraMove: panel.cameraMove,
      location: panel.location,
      characters: panel.characters,
      duration: panel.duration,
      imageUrl: mediaUrl(panel.imageMedia?.key, panel.imageUrl),
      videoUrl: mediaUrl(panel.videoMedia?.key, panel.videoUrl),
      lipSyncVideoUrl: mediaUrl(panel.lipSyncVideoMedia?.key, panel.lipSyncVideoUrl),
    })),
  }))

  return v1Success({
    id: episode.id,
    episodeNumber: episode.episodeNumber,
    name: episode.name,
    description: episode.description,
    hasNovelText: !!episode.novelText,
    storyboards,
    clips: episode.clips.map(c => ({
      id: c.id,
      summary: c.summary,
      content: c.content,
      screenplay: c.screenplay,
      location: c.location,
      characters: c.characters,
    })),
    voiceLines: episode.voiceLines.map(vl => ({
      id: vl.id,
      lineIndex: vl.lineIndex,
      speaker: vl.speaker,
      content: vl.content,
      audioUrl: mediaUrl(vl.audioMedia?.key, vl.audioUrl),
    })),
    createdAt: episode.createdAt,
    updatedAt: episode.updatedAt,
  })
})
