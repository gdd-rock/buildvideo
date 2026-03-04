import { createScopedLogger } from '@/lib/logging/core'

const logger = createScopedLogger({ module: 'monitor.notify' })

export type AlertLevel = 'info' | 'warn' | 'error'

export interface AlertMessage {
  level: AlertLevel
  title: string
  body: string
  timestamp?: string
}

// ─── Dedup: same title within 30 min won't re-alert ───
const DEDUP_WINDOW_MS = 30 * 60 * 1000
const recentAlerts = new Map<string, number>()

function isDuplicate(key: string): boolean {
  const last = recentAlerts.get(key)
  if (last && Date.now() - last < DEDUP_WINDOW_MS) return true
  recentAlerts.set(key, Date.now())
  // cleanup old keys
  if (recentAlerts.size > 200) {
    const cutoff = Date.now() - DEDUP_WINDOW_MS
    for (const [k, v] of recentAlerts) {
      if (v < cutoff) recentAlerts.delete(k)
    }
  }
  return false
}

// ─── Emoji by level ───
const LEVEL_EMOJI: Record<AlertLevel, string> = {
  info: '\u2139\ufe0f',
  warn: '\u26a0\ufe0f',
  error: '\ud83d\udea8',
}

function formatText(msg: AlertMessage): string {
  const ts = msg.timestamp || new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  return `${LEVEL_EMOJI[msg.level]} [BuildVideo] ${msg.title}\n\n${msg.body}\n\n${ts}`
}

// ─── WeChat Work Webhook ───
const WECHAT_WEBHOOK = process.env.ALERT_WECHAT_WEBHOOK_URL || ''

async function sendWechat(msg: AlertMessage): Promise<boolean> {
  if (!WECHAT_WEBHOOK) return false
  try {
    const res = await fetch(WECHAT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: formatText(msg) } }),
    })
    return res.ok
  } catch (err) {
    logger.error({ action: 'notify.wechat.failed', message: String(err) })
    return false
  }
}

// ─── Telegram Bot ───
const TG_TOKEN = process.env.ALERT_TELEGRAM_BOT_TOKEN || ''
const TG_CHAT_ID = process.env.ALERT_TELEGRAM_CHAT_ID || ''

async function sendTelegram(msg: AlertMessage): Promise<boolean> {
  if (!TG_TOKEN || !TG_CHAT_ID) return false
  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: formatText(msg), parse_mode: 'HTML' }),
    })
    return res.ok
  } catch (err) {
    logger.error({ action: 'notify.telegram.failed', message: String(err) })
    return false
  }
}

// ─── Public API ───

export function isNotifyConfigured(): boolean {
  return !!(WECHAT_WEBHOOK || (TG_TOKEN && TG_CHAT_ID))
}

export async function sendAlert(msg: AlertMessage): Promise<void> {
  const dedupKey = `${msg.level}:${msg.title}`
  if (isDuplicate(dedupKey)) {
    logger.info({ action: 'notify.dedup', message: `skipped duplicate alert: ${msg.title}` })
    return
  }

  logger.info({ action: 'notify.send', message: msg.title, details: { level: msg.level } })

  const results: boolean[] = []
  if (WECHAT_WEBHOOK) results.push(await sendWechat(msg))
  if (TG_TOKEN && TG_CHAT_ID) results.push(await sendTelegram(msg))

  if (results.length === 0) {
    // No channel configured, log only
    logger.warn({ action: 'notify.no_channel', message: `Alert (no channel): ${msg.title} - ${msg.body}` })
  }
}
