import { VideoClip, ClipTransition } from '../types/editor.types'
import { generateClipId } from './time-utils'
import { autoSelectTransition } from './ai-transitions'

export type AssemblyStyle = 'cinematic' | 'fast-cut' | 'dramatic' | 'dialogue'

interface PanelInfo {
    id: string
    storyboardId: string
    videoUrl: string
    description?: string
    shotType?: string
    location?: string
    duration?: number
}

interface VoiceInfo {
    content: string
    duration?: number
    audioUrl?: string
    id?: string
}

/**
 * 一键智能装配
 * 根据场景内容和选定风格自动调整节奏、转场、时长
 */
export function autoAssembleTimeline(
    panels: PanelInfo[],
    voiceLines: VoiceInfo[],
    style: AssemblyStyle,
    fps: number = 30
): VideoClip[] {
    return panels.map((panel, i) => {
        const baseDuration = panel.duration || 10
        const voice = voiceLines[i]
        const desc = (panel.description || '').toLowerCase()
        const nextPanel = panels[i + 1]

        // 场景分析
        const isAction = /fight|chase|run|attack|battle|战斗|追逐|打|跑/i.test(desc)
        const isDialogue = !!voice?.content
        const isEstablishing = /wide shot|establishing|全景|远景/i.test(panel.shotType || '')

        // 根据风格调整时长
        let adjustedDuration = baseDuration
        switch (style) {
            case 'fast-cut':
                adjustedDuration = isAction ? baseDuration * 0.5 : baseDuration * 0.7
                break
            case 'dramatic':
                adjustedDuration = isEstablishing ? baseDuration * 1.5 : baseDuration * 1.2
                break
            case 'dialogue':
                if (isDialogue && voice.duration) {
                    adjustedDuration = Math.max(baseDuration, voice.duration * 1.1)
                }
                break
            case 'cinematic':
                adjustedDuration = isEstablishing ? baseDuration * 1.3 : baseDuration
                break
        }

        // 最小1秒
        adjustedDuration = Math.max(1, adjustedDuration)

        // 智能转场
        const transition: ClipTransition | undefined = i < panels.length - 1
            ? autoSelectTransition(
                { location: panel.location, shotType: panel.shotType, description: panel.description },
                { location: nextPanel?.location, shotType: nextPanel?.shotType, description: nextPanel?.description }
            )
            : undefined

        return {
            id: generateClipId(),
            src: panel.videoUrl,
            durationInFrames: Math.round(adjustedDuration * fps),
            sourceDurationInFrames: Math.round((panel.duration || 10) * fps),
            attachment: {
                audio: voice?.audioUrl ? {
                    src: voice.audioUrl,
                    volume: 1,
                    voiceLineId: voice.id
                } : undefined,
                subtitle: voice?.content ? {
                    text: voice.content,
                    style: style === 'cinematic' ? 'cinematic' as const : 'default' as const
                } : undefined
            },
            transition,
            metadata: {
                panelId: panel.id,
                storyboardId: panel.storyboardId,
                description: panel.description,
                shotType: panel.shotType,
                location: panel.location
            }
        }
    })
}
