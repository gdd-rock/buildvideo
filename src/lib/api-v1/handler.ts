import { NextRequest, NextResponse } from 'next/server'
import { requireApiKeyAuth, ApiKeyAuthError } from './auth'
import { logInfo, logError } from '@/lib/logging/core'

export interface ApiV1Context {
  userId: string
  apiKeyId: string
  requestId: string
}

/**
 * v1 API 请求包装器
 * - API Key 认证
 * - 统一错误处理
 * - 请求日志
 */
export function apiV1Handler(
  handler: (
    request: NextRequest,
    ctx: ApiV1Context,
    routeContext: { params: Promise<Record<string, string>> },
  ) => Promise<NextResponse>,
) {
  return async (
    request: NextRequest,
    routeContext: { params: Promise<Record<string, string>> },
  ) => {
    const requestId =
      request.headers.get('x-request-id') ||
      `v1_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

    const start = Date.now()

    try {
      // API Key 认证
      const { userId, apiKeyId } = await requireApiKeyAuth(request)

      logInfo(`[API v1] ${request.method} ${request.nextUrl.pathname} userId=${userId}`)

      const ctx: ApiV1Context = { userId, apiKeyId, requestId }
      const response = await handler(request, ctx, routeContext)

      logInfo(`[API v1] ${request.method} ${request.nextUrl.pathname} ${response.status} ${Date.now() - start}ms`)
      return response
    } catch (error) {
      if (error instanceof ApiKeyAuthError) {
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: error.message } },
          { status: error.statusCode },
        )
      }

      if (error instanceof ApiV1Error) {
        return NextResponse.json(
          { success: false, error: { code: error.code, message: error.message } },
          { status: error.statusCode },
        )
      }

      logError(`[API v1] ${request.method} ${request.nextUrl.pathname} error:`, error)
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
        { status: 500 },
      )
    }
  }
}

export class ApiV1Error extends Error {
  code: string
  statusCode: number
  constructor(code: string, message: string, statusCode = 400) {
    super(message)
    this.name = 'ApiV1Error'
    this.code = code
    this.statusCode = statusCode
  }
}

/** 统一成功响应 */
export function v1Success(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}
