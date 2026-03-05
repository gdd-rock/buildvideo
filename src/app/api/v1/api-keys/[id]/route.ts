import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'

/**
 * DELETE /api/v1/api-keys/:id — 删除 API Key
 */
export const DELETE = apiV1Handler(async (_request, ctx, routeContext) => {
  const { id } = await routeContext.params

  const apiKey = await prisma.apiKey.findUnique({
    where: { id },
    select: { userId: true },
  })

  if (!apiKey || apiKey.userId !== ctx.userId) {
    throw new ApiV1Error('NOT_FOUND', 'API key not found', 404)
  }

  await prisma.apiKey.delete({ where: { id } })

  return v1Success({ deleted: true })
})
