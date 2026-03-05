import { prisma } from '@/lib/prisma'
import { getSignedUrl } from '@/lib/cos'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'

/**
 * GET /api/v1/tasks/:taskId — 查询任务状态
 */
export const GET = apiV1Handler(async (_request, ctx, routeContext) => {
  const { taskId } = await routeContext.params

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      type: true,
      status: true,
      progress: true,
      result: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
    },
  })

  if (!task) {
    throw new ApiV1Error('NOT_FOUND', 'Task not found', 404)
  }

  // 只能查自己的任务
  if (task.userId !== ctx.userId) {
    throw new ApiV1Error('NOT_FOUND', 'Task not found', 404)
  }

  // 处理 result 中的 COS key → 签名 URL
  let result = task.result as Record<string, unknown> | null
  if (result) {
    const outputKey = result.outputKey as string | undefined
    if (outputKey && !outputKey.startsWith('http')) {
      result = { ...result, outputUrl: getSignedUrl(outputKey, 3600) }
    }
  }

  return v1Success({
    id: task.id,
    type: task.type,
    status: task.status,
    progress: task.progress,
    result,
    error: task.errorCode ? { code: task.errorCode, message: task.errorMessage } : null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  })
})
