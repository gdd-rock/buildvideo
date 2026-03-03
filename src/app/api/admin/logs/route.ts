import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'

export const GET = apiHandler(async (request: NextRequest) => {
  const authResult = await requireAdminAuth()
  if (isErrorResponse(authResult)) return authResult

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  const level = searchParams.get('level') || ''
  const moduleFilter = searchParams.get('module') || ''
  const taskId = searchParams.get('taskId') || ''
  const search = searchParams.get('search') || ''

  // Build query from task_events table (structured logs stored in DB)
  // Fallback: query tasks with error information as pseudo-logs
  const where: Record<string, unknown> = {}

  if (taskId) {
    where.taskId = taskId
  }

  // Query task events if the table exists, otherwise build from tasks
  try {
    const [total, events] = await Promise.all([
      prisma.taskEvent.count({ where }),
      prisma.taskEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        total,
        logs: events.map((e: Record<string, unknown>) => ({
          id: e.id,
          ts: e.createdAt,
          level: e.type === 'error' ? 'ERROR' : 'INFO',
          module: 'task_event',
          taskId: e.taskId,
          message: String(e.message || e.type || ''),
          details: e.data,
        })),
        page,
        pageSize,
      },
    })
  } catch {
    // task_events table might not have the right shape; fallback to tasks
  }

  // Fallback: derive log entries from tasks table (always available)
  const taskWhere: Record<string, unknown> = {}
  if (level === 'ERROR') {
    taskWhere.status = 'failed'
  }
  if (taskId) {
    taskWhere.id = taskId
  }
  if (search) {
    taskWhere.OR = [
      { type: { contains: search } },
      { errorMessage: { contains: search } },
      { errorCode: { contains: search } },
    ]
  }
  if (moduleFilter) {
    taskWhere.type = { contains: moduleFilter }
  }

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where: taskWhere }),
    prisma.task.findMany({
      where: taskWhere,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        errorCode: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        startedAt: true,
        finishedAt: true,
        user: { select: { name: true } },
      },
    }),
  ])

  const logs = tasks.map((t: Record<string, unknown>) => {
    const status = t.status as string
    const user = t.user as { name: string } | null
    return {
      id: t.id,
      ts: t.updatedAt || t.createdAt,
      level: status === 'failed' ? 'ERROR' : status === 'completed' ? 'INFO' : 'WARN',
      module: t.type,
      taskId: t.id,
      message: status === 'failed'
        ? `[${t.errorCode}] ${t.errorMessage || 'Unknown error'}`
        : `Task ${status} (progress: ${t.progress}%)`,
      details: {
        status,
        progress: t.progress,
        errorCode: t.errorCode,
        errorMessage: t.errorMessage,
        user: user?.name,
        startedAt: t.startedAt,
        finishedAt: t.finishedAt,
        duration: t.startedAt && t.finishedAt
          ? `${((new Date(t.finishedAt as string).getTime() - new Date(t.startedAt as string).getTime()) / 1000).toFixed(1)}s`
          : null,
      },
    }
  })

  return NextResponse.json({
    success: true,
    data: { total, logs, page, pageSize },
  })
})
