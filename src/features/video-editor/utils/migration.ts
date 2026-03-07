import { logWarn as _ulogWarn } from '@/lib/logging/core'
import { VideoEditorProject, VideoClip } from '../types/editor.types'

/**
 * 版本迁移函数
 * 将旧版本数据升级到最新版本
 */
export function migrateProjectData(data: unknown): VideoEditorProject {
    const project = data as Record<string, unknown>
    const version = project.schemaVersion as string

    switch (version) {
        case '1.1':
            return project as unknown as VideoEditorProject

        case '1.0': {
            // 1.0 → 1.1: 添加 speed, sourceDurationInFrames, 扩展 TimelineState
            _ulogWarn('Migrating editor project from 1.0 to 1.1')
            const timeline = (project.timeline as VideoClip[]).map(clip => ({
                ...clip,
                speed: clip.speed ?? 1.0,
                sourceDurationInFrames: clip.sourceDurationInFrames ?? clip.durationInFrames
            }))
            return {
                ...project,
                schemaVersion: '1.1',
                timeline
            } as unknown as VideoEditorProject
        }

        default:
            _ulogWarn(`Unknown schema version: ${version}, treating as 1.1`)
            return {
                ...project,
                schemaVersion: '1.1'
            } as VideoEditorProject
    }
}

/**
 * 验证项目数据完整性
 */
export function validateProjectData(data: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const project = data as Record<string, unknown>

    if (!project.id) errors.push('Missing project id')
    if (!project.episodeId) errors.push('Missing episodeId')
    if (!project.schemaVersion) errors.push('Missing schemaVersion')
    if (!project.config) errors.push('Missing config')
    if (!Array.isArray(project.timeline)) errors.push('Invalid timeline')
    if (!Array.isArray(project.bgmTrack)) errors.push('Invalid bgmTrack')

    return { valid: errors.length === 0, errors }
}
