import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, isErrorResponse } from '@/lib/api-auth'
import { apiHandler, ApiError, getRequestId } from '@/lib/api-errors'
import { submitTask } from '@/lib/task/submitter'
import { resolveRequiredTaskLocale } from '@/lib/task/resolve-locale'
import { TASK_TYPE } from '@/lib/task/types'
import { buildDefaultTaskBillingInfo } from '@/lib/billing'
import { getUserModelConfig, buildImageBillingPayloadFromUserConfig } from '@/lib/config-service'
import { withTaskUiPayload } from '@/lib/task/ui-payload'
import { prisma } from '@/lib/prisma'

export const POST = apiHandler(async (request: NextRequest) => {
    const authResult = await requireUserAuth()
    if (isErrorResponse(authResult)) return authResult
    const { session } = authResult

    const body = await request.json()
    const locale = resolveRequiredTaskLocale(request, body)
    const digitalHumanId = body?.digitalHumanId

    if (!digitalHumanId) {
        throw new ApiError('INVALID_PARAMS')
    }

    // 验证数字人存在且属于当前用户
    const dh = await prisma.globalDigitalHuman.findUnique({
        where: { id: digitalHumanId },
    })
    if (!dh || (dh.userId !== session.user.id && session.user.role !== 'ADMIN')) {
        throw new ApiError('FORBIDDEN')
    }
    if (!dh.photoUrl) {
        throw new ApiError('INVALID_PARAMS', { message: '请先上传照片' })
    }

    const userModelConfig = await getUserModelConfig(session.user.id)

    let billingPayload: Record<string, unknown>
    try {
        billingPayload = buildImageBillingPayloadFromUserConfig({
            userModelConfig,
            imageModel: userModelConfig.characterModel,
            basePayload: body,
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Image model capability not configured'
        throw new ApiError('INVALID_PARAMS', { code: 'IMAGE_MODEL_CAPABILITY_NOT_CONFIGURED', message })
    }

    billingPayload.digitalHumanId = digitalHumanId

    const result = await submitTask({
        userId: session.user.id,
        locale,
        requestId: getRequestId(request),
        projectId: 'global-asset-hub',
        type: TASK_TYPE.ASSET_HUB_DIGITAL_HUMAN_GENERATE,
        targetType: 'GlobalDigitalHuman',
        targetId: digitalHumanId,
        payload: withTaskUiPayload(billingPayload, { hasOutputAtStart: !!dh.avatarImageUrl }),
        dedupeKey: `${TASK_TYPE.ASSET_HUB_DIGITAL_HUMAN_GENERATE}:${digitalHumanId}`,
        billingInfo: buildDefaultTaskBillingInfo(TASK_TYPE.ASSET_HUB_DIGITAL_HUMAN_GENERATE, billingPayload),
    })

    return NextResponse.json(result)
})
