import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { getLastMonitorResult } from '@/lib/monitor'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {}

  // DB check
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true, latencyMs: Date.now() - dbStart }
  } catch (err) {
    checks.database = { ok: false, latencyMs: Date.now() - dbStart, error: err instanceof Error ? err.message : String(err) }
  }

  // Redis check
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { ok: true, latencyMs: Date.now() - redisStart }
  } catch (err) {
    checks.redis = { ok: false, latencyMs: Date.now() - redisStart, error: err instanceof Error ? err.message : String(err) }
  }

  // Task queue stats
  try {
    const [pending, processing, failed] = await Promise.all([
      prisma.task.count({ where: { status: 'queued' } }),
      prisma.task.count({ where: { status: 'processing' } }),
      prisma.task.count({ where: { status: 'failed', updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
    ])
    checks.tasks = { ok: true, latencyMs: 0 }
    ;(checks.tasks as Record<string, unknown>).queued = pending
    ;(checks.tasks as Record<string, unknown>).processing = processing
    ;(checks.tasks as Record<string, unknown>).failedLastHour = failed
  } catch {
    checks.tasks = { ok: false }
  }

  const allOk = Object.values(checks).every(c => c.ok)
  const monitorResult = getLastMonitorResult()

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    monitor: monitorResult,
    uptime: process.uptime(),
  }, { status: allOk ? 200 : 503 })
}
