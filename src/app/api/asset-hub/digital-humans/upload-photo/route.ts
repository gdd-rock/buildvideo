import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'
import { uploadToCOS, generateUniqueKey, getSignedUrl } from '@/lib/cos'

// 上传数字人照片
export const POST = apiHandler(async (request: NextRequest) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const digitalHumanId = formData.get('digitalHumanId') as string | null
    const name = formData.get('name') as string | null
    const gender = formData.get('gender') as string | null
    const folderId = formData.get('folderId') as string | null

    if (!file) {
        throw new ApiError('INVALID_PARAMS')
    }

    // 上传到 COS
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'jpg'
    const cosKey = generateUniqueKey('digital-human', ext)
    await uploadToCOS(buffer, cosKey)

    let digitalHuman
    if (digitalHumanId) {
        // 更新已有数字人的照片
        const existing = await prisma.globalDigitalHuman.findUnique({
            where: { id: digitalHumanId }
        })
        if (!existing || existing.userId !== session.user.id) {
            throw new ApiError('FORBIDDEN')
        }
        digitalHuman = await prisma.globalDigitalHuman.update({
            where: { id: digitalHumanId },
            data: {
                photoUrl: cosKey,
                status: 'pending',
            }
        })
    } else {
        // 创建新数字人并上传照片
        digitalHuman = await prisma.globalDigitalHuman.create({
            data: {
                userId: session.user.id,
                name: name?.trim() || '数字人',
                gender: gender || null,
                folderId: folderId || null,
                photoUrl: cosKey,
                status: 'pending',
            }
        })
    }

    return NextResponse.json({
        success: true,
        digitalHuman: {
            ...digitalHuman,
            photoUrl: getSignedUrl(cosKey),
        }
    })
})
