import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-errors'
import { getSignedUrl } from '@/lib/cos'
import { decodeImageUrls } from '@/lib/contracts/image-urls-contract'

// 获取数字人指定图片的 base64（解决前端 CORS 问题）
export const GET = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const authResult = await requireUserAuth()
  if (isErrorResponse(authResult)) return authResult
  const { session } = authResult
  const { id } = await params

  const { searchParams } = new URL(request.url)
  const indexStr = searchParams.get('index')
  const index = indexStr !== null ? parseInt(indexStr, 10) : -1

  const dh = await prisma.globalDigitalHuman.findUnique({
    where: { id },
    select: { userId: true, avatarImageUrls: true, avatarImageUrl: true },
  })

  if (!dh || dh.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const cosKeys = dh.avatarImageUrls ? decodeImageUrls(dh.avatarImageUrls) : []

  // 如果指定了 index，只返回对应图片；否则返回全部
  const keysToFetch = index >= 0 && index < cosKeys.length
    ? [cosKeys[index]]
    : cosKeys.length > 0
      ? cosKeys
      : (dh.avatarImageUrl ? [dh.avatarImageUrl] : [])

  const images: string[] = []
  for (const key of keysToFetch) {
    try {
      const signedUrl = getSignedUrl(key)
      const res = await fetch(signedUrl)
      if (!res.ok) continue
      const buffer = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      images.push(`data:${contentType};base64,${buffer.toString('base64')}`)
    } catch {
      // skip failed
    }
  }

  return NextResponse.json({ images })
})
