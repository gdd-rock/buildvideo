import { ClipTransition } from '../types/editor.types'

interface SceneInfo {
    location?: string | null
    shotType?: string | null
    description?: string | null
}

/**
 * 智能转场选择
 * 根据前后场景内容自动选择合适的转场类型
 */
export function autoSelectTransition(
    current: SceneInfo,
    next: SceneInfo | undefined
): ClipTransition | undefined {
    if (!next) return undefined

    const locationChanged = current.location && next.location && current.location !== next.location
    const shotTypeChanged = current.shotType && next.shotType && current.shotType !== next.shotType

    // 场景切换 → 慢淡入淡出
    if (locationChanged) {
        return { type: 'fade', durationInFrames: 30 }
    }

    // 景别切换 → 溶解
    if (shotTypeChanged) {
        return { type: 'dissolve', durationInFrames: 15 }
    }

    // 同场景 → 硬切
    return { type: 'none', durationInFrames: 0 }
}

/**
 * 批量应用智能转场到整个时间轴
 */
export function applyAutoTransitions(
    clips: Array<{ metadata: SceneInfo }>,
): (ClipTransition | undefined)[] {
    return clips.map((clip, i) => {
        const next = clips[i + 1]
        return autoSelectTransition(clip.metadata, next?.metadata)
    })
}
