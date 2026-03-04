import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { ApiError, apiHandler } from '@/lib/api-errors'

// 删除数字人
export const DELETE = apiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const { id } = await params

    const dh = await prisma.globalDigitalHuman.findUnique({
        where: { id }
    })

    if (!dh) {
        throw new ApiError('NOT_FOUND')
    }

    if (dh.userId !== session.user.id) {
        throw new ApiError('FORBIDDEN')
    }

    await prisma.globalDigitalHuman.delete({
        where: { id }
    })

    return NextResponse.json({ success: true })
})

// 更新数字人
export const PATCH = apiHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const { id } = await params
    const body = await request.json()

    const dh = await prisma.globalDigitalHuman.findUnique({
        where: { id }
    })

    if (!dh) {
        throw new ApiError('NOT_FOUND')
    }

    if (dh.userId !== session.user.id) {
        throw new ApiError('FORBIDDEN')
    }

    const updated = await prisma.globalDigitalHuman.update({
        where: { id },
        data: {
            name: body.name?.trim() || dh.name,
            description: body.description !== undefined ? body.description?.trim() || null : dh.description,
            folderId: body.folderId !== undefined ? body.folderId : dh.folderId,
            gender: body.gender !== undefined ? body.gender : dh.gender,
        }
    })

    return NextResponse.json({ success: true, digitalHuman: updated })
})
