import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSignedUrl } from '@/lib/cos'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'

/**
 * POST - 发起视频合成任务
 * Body: { episodeId, transition?: 'none' | 'fade', panelPreferences?: Record<string, boolean> }
 */
export const POST = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const { episodeId, transition, panelPreferences } = body as {
    episodeId: string
    transition?: 'none' | 'fade'
    panelPreferences?: Record<string, boolean>
  }

  if (!episodeId) {
    throw new ApiError('INVALID_PARAMS')
  }

  // 验证 episode 存在
  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
  })
  if (!episode) {
    throw new ApiError('NOT_FOUND')
  }

  const locale = resolveRequiredTaskLocale(request, body)

  const result = await submitTask({
    userId: session.user.id,
    locale,
    requestId: getRequestId(request),
    projectId,
    episodeId,
    type: TASK_TYPE.VIDEO_MERGE,
    targetType: 'NovelPromotionEpisode',
    targetId: episodeId,
    payload: {
      episodeId,
      transition: transition || 'none',
      panelPreferences: panelPreferences || {},
    },
    dedupeKey: `video_merge:${episodeId}`,
    maxAttempts: 2,
    billingInfo: { billable: false },
  })

  return NextResponse.json({
    taskId: result.task.id,
    status: result.task.status,
  })
})

/**
 * GET - 查询合成任务状态，完成后返回下载链接
 * Query: ?taskId=xxx
 */
export const GET = apiHandler(async (
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params

  const authResult = await requireProjectAuthLight(projectId)
  if (isErrorResponse(authResult)) return authResult

  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('taskId')

  if (!taskId) {
    throw new ApiError('INVALID_PARAMS')
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      progress: true,
      result: true,
      errorMessage: true,
    },
  })

  if (!task) {
    throw new ApiError('NOT_FOUND')
  }

  // 如果完成，生成签名下载 URL
  let downloadUrl: string | null = null
  if (task.status === 'completed' && task.result) {
    const result = task.result as Record<string, unknown>
    const outputKey = result.outputKey as string | undefined
    if (outputKey) {
      downloadUrl = getSignedUrl(outputKey, 3600)
    }
  }

  return NextResponse.json({
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    downloadUrl,
    errorMessage: task.errorMessage,
  })
})
