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
  const search = searchParams.get('search') || ''

  const where: Record<string, unknown> = {}
  if (search.trim()) {
    where.name = { contains: search.trim() }
  }

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true } },
        _count: { select: { usageCosts: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: { total, projects, page, pageSize },
  })
})
