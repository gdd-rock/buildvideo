import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

export const GET = apiHandler(async () => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [totalUsers, totalProjects, totalTasks, activeUsers, recentUsers, recentTasks] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.task.count(),
    prisma.user.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true, disabled: true },
    }),
    prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        finishedAt: true,
        user: { select: { name: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: { totalUsers, totalProjects, totalTasks, activeUsers, recentUsers, recentTasks },
  })
})
