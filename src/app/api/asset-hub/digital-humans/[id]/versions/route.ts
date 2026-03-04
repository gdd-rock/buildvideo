import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'
import { getSignedUrl } from '@/lib/cos'

function signVersionUrls(version: { id: string; version: number; avatarImageUrl: string | null; avatarImageUrls: string | null; createdAt: Date }) {
    let signedAvatarImageUrls: string[] = []
    if (typeof version.avatarImageUrls === 'string' && version.avatarImageUrls) {
        try {
            const parsed = JSON.parse(version.avatarImageUrls) as string[]
            signedAvatarImageUrls = parsed.map((url) => getSignedUrl(url))
        } catch { /* ignore */ }
    }

    return {
        id: version.id,
        version: version.version,
        avatarImageUrl: version.avatarImageUrl ? getSignedUrl(version.avatarImageUrl) : null,
        avatarImageUrls: signedAvatarImageUrls,
        createdAt: version.createdAt,
    }
}

// 获取版本历史列表
export const GET = apiHandler(async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const { id } = await params

    const dh = await prisma.globalDigitalHuman.findUnique({
        where: { id },
        select: { userId: true },
    })

    if (!dh) throw new ApiError('NOT_FOUND')
    if (dh.userId !== session.user.id) throw new ApiError('FORBIDDEN')

    const versions = await prisma.digitalHumanVersion.findMany({
        where: { digitalHumanId: id },
        orderBy: { version: 'desc' },
    })

    return NextResponse.json({
        versions: versions.map(signVersionUrls),
    })
})

// 切换到指定版本（回退）
export const POST = apiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const { id } = await params
    const body = await request.json()
    const versionId = body.versionId as string

    if (!versionId) throw new ApiError('INVALID_PARAMS')

    const dh = await prisma.globalDigitalHuman.findUnique({
        where: { id },
    })

    if (!dh) throw new ApiError('NOT_FOUND')
    if (dh.userId !== session.user.id) throw new ApiError('FORBIDDEN')

    const targetVersion = await prisma.digitalHumanVersion.findFirst({
        where: { id: versionId, digitalHumanId: id },
    })

    if (!targetVersion) throw new ApiError('NOT_FOUND')

    // 将当前版本存档（如果有图片且状态就绪）
    if (dh.avatarImageUrl && dh.status === 'ready') {
        const lastVersion = await prisma.digitalHumanVersion.findFirst({
            where: { digitalHumanId: id },
            orderBy: { version: 'desc' },
            select: { version: true },
        })
        const nextVersion = (lastVersion?.version ?? 0) + 1

        await prisma.digitalHumanVersion.create({
            data: {
                digitalHumanId: id,
                version: nextVersion,
                avatarImageUrl: dh.avatarImageUrl,
                avatarImageUrls: dh.avatarImageUrls,
            },
        })
    }

    // 用目标版本恢复
    await prisma.globalDigitalHuman.update({
        where: { id },
        data: {
            avatarImageUrl: targetVersion.avatarImageUrl,
            avatarImageUrls: targetVersion.avatarImageUrls,
            selectedIndex: 0,
            status: 'ready',
        },
    })

    // 删除已使用的目标版本记录（避免重复）
    await prisma.digitalHumanVersion.delete({
        where: { id: versionId },
    })

    return NextResponse.json({ success: true })
})
