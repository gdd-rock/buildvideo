import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'

export const GET = apiHandler(async (request: NextRequest) => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const status = searchParams.get('status') || ''

  const where: Record<string, unknown> = {}
  if (status) {
    where.status = status
  }

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    data: { total, tasks, page, pageSize },
  })
})
