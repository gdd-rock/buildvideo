/**
 * URL 安全校验 — 防止 SSRF 攻击
 *
 * 所有对外部 URL 进行 fetch 的位置必须先经过此模块校验。
 */

const PRIVATE_IP_RANGES = [
  /^127\./,                              // loopback
  /^10\./,                               // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./,          // 172.16.0.0/12
  /^192\.168\./,                         // 192.168.0.0/16
  /^169\.254\./,                         // link-local / cloud metadata
  /^0\./,                                // 0.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
]

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
])

function isPrivateIp(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some(re => re.test(hostname))
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(lower)) return true
  // IPv6 loopback
  if (lower === '[::1]' || lower === '::1') return true
  return false
}

/**
 * 校验 URL 是否安全（非内网/非元数据服务）。
 * 仅允许 http/https 协议。
 *
 * @throws 如果 URL 不安全则抛出 Error
 */
export function assertSafeUrl(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('SSRF_BLOCKED: 无效的 URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SSRF_BLOCKED: 仅允许 http/https 协议')
  }

  const hostname = parsed.hostname

  if (isBlockedHostname(hostname)) {
    throw new Error('SSRF_BLOCKED: 禁止访问本地/内网地址')
  }

  if (isPrivateIp(hostname)) {
    throw new Error('SSRF_BLOCKED: 禁止访问私有 IP 地址')
  }
}

/**
 * 校验 URL 是否为允许的外部服务域名。
 * 用于 media proxy 类端点，仅放行已知的存储/CDN 域名。
 */
export function assertAllowedMediaUrl(rawUrl: string): void {
  assertSafeUrl(rawUrl)

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('SSRF_BLOCKED: 无效的 URL')
  }

  const hostname = parsed.hostname.toLowerCase()

  // 允许的媒体域名模式
  const allowedPatterns = [
    /\.myqcloud\.com$/,           // 腾讯 COS
    /\.cos\..+\.myqcloud\.com$/,  // 腾讯 COS 标准
    /\.fal\.ai$/,                 // FAL
    /\.fal\.run$/,                // FAL CDN
    /\.replicate\.delivery$/,     // Replicate
    /\.r2\.cloudflarestorage\.com$/, // Cloudflare R2
    /\.amazonaws\.com$/,          // AWS S3
    /\.blob\.core\.windows\.net$/, // Azure Blob
    /\.storage\.googleapis\.com$/, // GCS
    /\.volces\.com$/,             // 火山引擎
    /\.volccdn\.com$/,            // 火山引擎 CDN
    /\.byteimg\.com$/,            // 字节跳动 CDN
  ]

  if (!allowedPatterns.some(re => re.test(hostname))) {
    throw new Error(`SSRF_BLOCKED: 不允许的媒体域名 ${hostname}`)
  }
}
