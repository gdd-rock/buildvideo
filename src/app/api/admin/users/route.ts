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
    where.OR = [
      { name: { contains: search.trim() } },
      { email: { contains: search.trim() } },
    ]
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        disabled: true,
        createdAt: true,
        _count: { select: { projects: true } },
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: { total, users, page, pageSize },
  })
})

export const PATCH = apiHandler(async (request: NextRequest) => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult

  const body = await request.json()
  const { userId, role, disabled } = body

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 })
  }

  // Prevent self-demotion
  if (userId === session.user.id && role === 'USER') {
    return NextResponse.json({ success: false, error: 'Cannot remove your own admin role' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (role !== undefined) data.role = role
  if (disabled !== undefined) data.disabled = disabled

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, role: true, disabled: true },
  })

  return NextResponse.json({ success: true, data: user })
})
