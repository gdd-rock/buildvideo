import { prisma } from '@/lib/prisma'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'

/**
 * POST /api/v1/projects — 创建项目
 * Body: { name, description? }
 */
export const POST = apiV1Handler(async (request, ctx) => {
  const body = await request.json()
  const { name, description } = body as { name?: string; description?: string }

  if (!name?.trim()) {
    throw new ApiV1Error('INVALID_PARAMS', 'name is required')
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || '',
      userId: ctx.userId,
    },
  })

  // 自动创建 NovelPromotionProject
  const npProject = await prisma.novelPromotionProject.create({
    data: {
      projectId: project.id,
    },
  })

  return v1Success({
    id: project.id,
    name: project.name,
    description: project.description,
    novelPromotionId: npProject.id,
    createdAt: project.createdAt,
  }, 201)
})

/**
 * GET /api/v1/projects — 列出当前用户项目
 */
export const GET = apiV1Handler(async (_request, ctx) => {
  const projects = await prisma.project.findMany({
    where: { userId: ctx.userId },
    include: {
      novelPromotionData: {
        select: { id: true, workflowMode: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return v1Success(
    projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      workflowMode: p.novelPromotionData?.workflowMode || null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  )
})
