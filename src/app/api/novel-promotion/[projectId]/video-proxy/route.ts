import { logInfo as _ulogInfo } from '@/lib/logging/core'
import { NextRequest } from 'next/server'
import { getSignedUrl, toFetchableUrl } from '@/lib/cos'
import { requireProjectAuthLight, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { assertAllowedMediaUrl } from '@/lib/security/url-validator'

/**
 * CORS 预检请求支持（Remotion Player 需要）
 */
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Range',
            'Access-Control-Max-Age': '86400',
        },
    })
}

/**
 * 代理下载单个视频文件
 * 用于解决 COS 跨域下载问题，同时供 Remotion Player 同源加载
 */
export const GET = apiHandler(async (
    request: NextRequest,
    context: { params: Promise<{ projectId: string }> }
) => {
    const { projectId } = await context.params
    const { searchParams } = new URL(request.url)
    const videoKey = searchParams.get('key')

    if (!videoKey) {
        throw new ApiError('INVALID_PARAMS')
    }

    // 🔐 统一权限验证
    const authResult = await requireProjectAuthLight(projectId)
    if (isErrorResponse(authResult)) return authResult

    // 生成签名 URL 并下载
    let fetchUrl: string
    if (videoKey.startsWith('http://') || videoKey.startsWith('https://')) {
        assertAllowedMediaUrl(videoKey)
        fetchUrl = videoKey
    } else {
        fetchUrl = toFetchableUrl(getSignedUrl(videoKey, 3600))
    }

    _ulogInfo(`[视频代理] 下载: ${fetchUrl.substring(0, 100)}...`)

    const response = await fetch(fetchUrl)
    if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`)
    }

    // 获取内容类型和长度
    const contentType = response.headers.get('content-type') || 'video/mp4'
    const contentLength = response.headers.get('content-length')

    // 流式返回视频数据（含 CORS 支持，供 Remotion Player 使用）
    const headers: HeadersInit = {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
    }
    if (contentLength) {
        headers['Content-Length'] = contentLength
    }

    return new Response(response.body, { headers })
})
