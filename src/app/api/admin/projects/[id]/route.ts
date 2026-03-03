import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isErrorResponse, notFound } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

export const GET = apiHandler(async (
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult

  const { id } = await ctx.params

  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      mode: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true } },
      novelPromotionData: {
        select: {
          videoRatio: true,
          videoResolution: true,
          imageResolution: true,
          artStyle: true,
          artStylePrompt: true,
          ttsRate: true,
          workflowMode: true,
          characters: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              aliases: true,
              profileConfirmed: true,
              appearances: {
                orderBy: { appearanceIndex: 'asc' },
                take: 1,
                select: { imageUrl: true },
              },
            },
          },
          locations: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              summary: true,
              images: {
                where: { isSelected: true },
                take: 1,
                select: { imageUrl: true },
              },
            },
          },
          episodes: {
            orderBy: { episodeNumber: 'asc' },
            select: {
              id: true,
              name: true,
              episodeNumber: true,
              createdAt: true,
            },
          },
        },
      },
      _count: {
        select: {
          usageCosts: true,
        },
      },
    },
  })

  if (!project) return notFound('Project')

  // Usage cost summary grouped by apiType
  const usageSummary = await prisma.usageCost.groupBy({
    by: ['apiType'],
    where: { projectId: id },
    _sum: { cost: true },
    _count: { id: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      ...project,
      usageSummary: usageSummary.map((item) => ({
        apiType: item.apiType,
        totalCost: item._sum.cost,
        count: item._count.id,
      })),
    },
  })
})
