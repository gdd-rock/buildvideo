import { NextRequest } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

const API_KEY_PREFIX = 'wao_'

/**
 * 生成 API Key
 * 返回明文 key（只返回一次）+ hash（存库）+ prefix（展示）
 */
export function generateApiKey() {
  const raw = randomBytes(32).toString('hex')
  const key = `${API_KEY_PREFIX}${raw}`
  const keyHash = hashApiKey(key)
  const keyPrefix = `${API_KEY_PREFIX}${raw.slice(0, 8)}...`
  return { key, keyHash, keyPrefix }
}

/**
 * 对 API Key 做 SHA-256 hash
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * 从请求中提取并验证 API Key
 * 返回 userId 和 apiKeyId
 */
export async function requireApiKeyAuth(request: NextRequest): Promise<{
  userId: string
  apiKeyId: string
}> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiKeyAuthError('Missing or invalid Authorization header', 401)
  }

  const key = authHeader.slice(7).trim()
  if (!key.startsWith(API_KEY_PREFIX)) {
    throw new ApiKeyAuthError('Invalid API key format', 401)
  }

  const keyHash = hashApiKey(key)
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      user: { select: { id: true, disabled: true } },
    },
  })

  if (!apiKey) {
    throw new ApiKeyAuthError('Invalid API key', 401)
  }

  if (apiKey.user.disabled) {
    throw new ApiKeyAuthError('User account is disabled', 403)
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new ApiKeyAuthError('API key expired', 401)
  }

  // 异步更新 lastUsedAt（不阻塞响应）
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return {
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
  }
}

export class ApiKeyAuthError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'ApiKeyAuthError'
    this.statusCode = statusCode
  }
}
