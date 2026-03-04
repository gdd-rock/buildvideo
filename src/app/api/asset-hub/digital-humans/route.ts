import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'
import { getSignedUrl } from '@/lib/cos'

function signDigitalHuman(dh: Record<string, unknown>) {
    let signedAvatarImageUrls: string[] = []
    if (typeof dh.avatarImageUrls === 'string' && dh.avatarImageUrls) {
        try {
            const parsed = JSON.parse(dh.avatarImageUrls) as string[]
            signedAvatarImageUrls = parsed.map((url) => getSignedUrl(url))
        } catch { /* ignore parse errors */ }
    }

    return {
        ...dh,
        photoUrl: dh.photoUrl ? getSignedUrl(dh.photoUrl as string) : null,
        avatarImageUrl: dh.avatarImageUrl ? getSignedUrl(dh.avatarImageUrl as string) : null,
        avatarImageUrls: signedAvatarImageUrls,
        previewVideoUrl: dh.previewVideoUrl ? getSignedUrl(dh.previewVideoUrl as string) : null,
    }
}

// 获取用户所有数字人（支持 folderId 筛选）
export const GET = apiHandler(async (request: NextRequest) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folderId')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (folderId === 'null') {
        where.folderId = null
    } else if (folderId) {
        where.folderId = folderId
    }

    const digitalHumans = await prisma.globalDigitalHuman.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    })

    const signed = digitalHumans.map((dh) => signDigitalHuman(dh as unknown as Record<string, unknown>))

    return NextResponse.json({ digitalHumans: signed })
})

// 新建数字人
export const POST = apiHandler(async (request: NextRequest) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const body = await request.json()
    const { name, description, folderId, gender, photoUrl } = body

    if (!name) {
        throw new ApiError('INVALID_PARAMS')
    }

    if (folderId) {
        const folder = await prisma.globalAssetFolder.findUnique({
            where: { id: folderId }
        })
        if (!folder || folder.userId !== session.user.id) {
            throw new ApiError('INVALID_PARAMS')
        }
    }

    const digitalHuman = await prisma.globalDigitalHuman.create({
        data: {
            userId: session.user.id,
            folderId: folderId || null,
            name: name.trim(),
            description: description?.trim() || null,
            gender: gender || null,
            photoUrl: photoUrl || null,
            status: photoUrl ? 'ready' : 'pending',
        }
    })

    return NextResponse.json({
        success: true,
        digitalHuman: signDigitalHuman(digitalHuman as unknown as Record<string, unknown>)
    })
})
