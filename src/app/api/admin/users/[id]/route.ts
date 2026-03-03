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

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      disabled: true,
      createdAt: true,
      updatedAt: true,
      balance: {
        select: {
          balance: true,
          frozenAmount: true,
          totalSpent: true,
        },
      },
      preferences: {
        select: {
          analysisModel: true,
          characterModel: true,
          locationModel: true,
          storyboardModel: true,
          editModel: true,
          videoModel: true,
          lipSyncModel: true,
          videoRatio: true,
          videoResolution: true,
          imageResolution: true,
          artStyle: true,
          ttsRate: true,
          llmBaseUrl: true,
          // API Keys: only check existence, never expose actual values
          llmApiKey: true,
          falApiKey: true,
          googleAiKey: true,
          arkApiKey: true,
          qwenApiKey: true,
        },
      },
      projects: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          _count: { select: { usageCosts: true } },
        },
      },
      tasks: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          finishedAt: true,
        },
      },
      _count: {
        select: {
          projects: true,
          tasks: true,
          usageCosts: true,
        },
      },
    },
  })

  if (!user) {
    return notFound('User')
  }

  // Mask API keys: convert to boolean flags
  const apiKeyStatus = {
    llmApiKey: !!user.preferences?.llmApiKey,
    falApiKey: !!user.preferences?.falApiKey,
    googleAiKey: !!user.preferences?.googleAiKey,
    arkApiKey: !!user.preferences?.arkApiKey,
    qwenApiKey: !!user.preferences?.qwenApiKey,
  }

  // Strip raw API key values from preferences
  const preferences = user.preferences
    ? {
        analysisModel: user.preferences.analysisModel,
        characterModel: user.preferences.characterModel,
        locationModel: user.preferences.locationModel,
        storyboardModel: user.preferences.storyboardModel,
        editModel: user.preferences.editModel,
        videoModel: user.preferences.videoModel,
        lipSyncModel: user.preferences.lipSyncModel,
        videoRatio: user.preferences.videoRatio,
        videoResolution: user.preferences.videoResolution,
        imageResolution: user.preferences.imageResolution,
        artStyle: user.preferences.artStyle,
        ttsRate: user.preferences.ttsRate,
        llmBaseUrl: user.preferences.llmBaseUrl,
      }
    : null

  // Usage cost summary grouped by apiType
  const usageSummary = await prisma.usageCost.groupBy({
    by: ['apiType'],
    where: { userId: id },
    _sum: { cost: true },
    _count: { id: true },
  })

  // Recent balance transactions
  const transactions = await prisma.balanceTransaction.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      description: true,
      taskType: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      ...user,
      preferences,
      apiKeyStatus,
      usageSummary: usageSummary.map((item) => ({
        apiType: item.apiType,
        totalCost: item._sum.cost,
        count: item._count.id,
      })),
      transactions,
    },
  })
})
