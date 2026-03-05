import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession } from '@/lib/api-auth'
import { generateApiKey } from '@/lib/api-v1/auth'
import { apiV1Handler, v1Success, ApiV1Error } from '@/lib/api-v1/handler'

/**
 * POST /api/v1/api-keys — 创建 API Key（支持 session 或 API Key 认证）
 */
export async function POST(request: NextRequest) {
  // 支持两种认证方式：session 或 API Key
  let userId: string

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer wao_')) {
    // API Key 认证
    const handler = apiV1Handler(async (_req, ctx) => {
      const body = await _req.json().catch(() => ({}))
      const name = (body.name as string) || 'Default'
      const { key, keyHash, keyPrefix } = generateApiKey()

      await prisma.apiKey.create({
        data: { userId: ctx.userId, name, keyHash, keyPrefix },
      })

      return v1Success({ key, name, keyPrefix }, 201)
    })
    return handler(request, { params: Promise.resolve({}) })
  }

  // Session 认证（从浏览器管理页面）
  const session = await getAuthSession()
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }
  userId = session.user.id

  const body = await request.json().catch(() => ({}))
  const name = (body.name as string) || 'Default'
  const { key, keyHash, keyPrefix } = generateApiKey()

  await prisma.apiKey.create({
    data: { userId, name, keyHash, keyPrefix },
  })

  return v1Success({ key, name, keyPrefix }, 201)
}

/**
 * GET /api/v1/api-keys — 列出当前用户的 API Keys
 */
export const GET = apiV1Handler(async (_request, ctx) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: ctx.userId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return v1Success(keys)
})
