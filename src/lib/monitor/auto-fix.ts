import { createScopedLogger } from '@/lib/logging/core'
import { prisma } from '@/lib/prisma'
import { sendAlert } from './notify'

const logger = createScopedLogger({ module: 'monitor.autofix' })

// Stuck generating digital humans: status='generating' for over 10 min
async function fixStuckDigitalHumans(): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000)
  const stuck = await prisma.globalDigitalHuman.findMany({
    where: { status: 'generating', updatedAt: { lt: cutoff } },
    select: { id: true, name: true, userId: true },
  })
  if (stuck.length === 0) return 0

  await prisma.globalDigitalHuman.updateMany({
    where: { status: 'generating', updatedAt: { lt: cutoff } },
    data: { status: 'pending' },
  })
  logger.info({
    action: 'autofix.digital_human.reset',
    message: `reset ${stuck.length} stuck digital humans from generating to pending`,
    details: { ids: stuck.map(s => s.id) },
  })
  return stuck.length
}

// Stuck tasks: status='processing' but no heartbeat for over 5 min (supplement to watchdog)
async function fixStuckTasks(): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000)
  const stuck = await prisma.task.count({
    where: {
      status: 'processing',
      heartbeatAt: { lt: cutoff },
    },
  })
  // Don't fix here — watchdog already handles this. Just alert if count is high.
  if (stuck >= 10) {
    await sendAlert({
      level: 'warn',
      title: `大量任务卡死: ${stuck} 个`,
      body: `${stuck} 个任务处于 processing 状态但心跳超时，watchdog 正在处理。如持续增长请检查 worker。`,
    })
  }
  return 0 // watchdog handles actual fix
}

// Detect consecutive task failures (same type, 5+ in last 30 min)
async function detectConsecutiveFailures(): Promise<void> {
  const recentFailed = await prisma.task.groupBy({
    by: ['type'],
    where: {
      status: 'failed',
      updatedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
    },
    _count: { id: true },
    having: { id: { _count: { gte: 5 } } },
  })

  for (const group of recentFailed) {
    await sendAlert({
      level: 'error',
      title: `任务连续失败: ${group.type}`,
      body: `任务类型 ${group.type} 在过去30分钟内失败 ${group._count.id} 次，请检查。`,
    })
  }
}

// Detect DB connection issues
async function checkDbHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (err) {
    logger.error({ action: 'autofix.db_health.failed', message: String(err) })
    await sendAlert({
      level: 'error',
      title: '数据库连接异常',
      body: `Prisma 查询失败: ${err instanceof Error ? err.message : String(err)}`,
    })
    return false
  }
}

// ─── Public API ───

export interface AutoFixResult {
  dbHealthy: boolean
  fixedDigitalHumans: number
}

export async function runAutoFix(): Promise<AutoFixResult> {
  const dbHealthy = await checkDbHealth()
  if (!dbHealthy) {
    return { dbHealthy, fixedDigitalHumans: 0 }
  }

  const fixedDigitalHumans = await fixStuckDigitalHumans()
  await fixStuckTasks()
  await detectConsecutiveFailures()

  if (fixedDigitalHumans > 0) {
    await sendAlert({
      level: 'info',
      title: `自动修复: ${fixedDigitalHumans} 条记录`,
      body: `数字人: ${fixedDigitalHumans} 条从 generating 重置为 pending`,
    })
  }

  return { dbHealthy, fixedDigitalHumans }
}
