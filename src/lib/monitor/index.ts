import { createScopedLogger } from '@/lib/logging/core'
import { redis } from '@/lib/redis'
import { runAutoFix, type AutoFixResult } from './auto-fix'
import { sendAlert, isNotifyConfigured } from './notify'

const INTERVAL_MS = Number.parseInt(process.env.MONITOR_INTERVAL_MS || '60000', 10) || 60000
const logger = createScopedLogger({ module: 'monitor', action: 'monitor.tick' })

let lastResult: (AutoFixResult & { timestamp: string; redisOk: boolean }) | null = null

async function checkRedis(): Promise<boolean> {
  try {
    const pong = await redis.ping()
    return pong === 'PONG'
  } catch (err) {
    logger.error({ action: 'monitor.redis.failed', message: String(err) })
    await sendAlert({
      level: 'error',
      title: 'Redis 连接异常',
      body: `Redis ping 失败: ${err instanceof Error ? err.message : String(err)}`,
    })
    return false
  }
}

async function tick() {
  const startedAt = Date.now()
  try {
    const redisOk = await checkRedis()
    const fixResult = await runAutoFix()

    lastResult = {
      ...fixResult,
      redisOk,
      timestamp: new Date().toISOString(),
    }

    logger.info({
      action: 'monitor.tick.ok',
      message: 'monitor tick completed',
      durationMs: Date.now() - startedAt,
      details: lastResult,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'monitor tick failed'
    logger.error({
      action: 'monitor.tick.failed',
      message,
      durationMs: Date.now() - startedAt,
      errorCode: 'INTERNAL_ERROR',
      retryable: true,
    })
    await sendAlert({
      level: 'error',
      title: '监控进程异常',
      body: `monitor tick 执行失败: ${message}`,
    })
  }
}

export function getLastMonitorResult() {
  return lastResult
}

export function startMonitor() {
  const channels: string[] = []
  if (process.env.ALERT_WECHAT_WEBHOOK_URL) channels.push('WeChat')
  if (process.env.ALERT_TELEGRAM_BOT_TOKEN) channels.push('Telegram')

  logger.info({
    action: 'monitor.started',
    message: 'monitor started',
    details: {
      intervalMs: INTERVAL_MS,
      notifyConfigured: isNotifyConfigured(),
      channels: channels.length > 0 ? channels : ['none (log only)'],
    },
  })

  void tick()
  setInterval(() => { void tick() }, INTERVAL_MS)
}
