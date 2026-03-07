'use client'

import { useState, useCallback, useMemo } from 'react'
import {
    VideoEditorProject,
    VideoClip,
    BgmClip,
    TimelineState,
    EditorTool,
} from '../types/editor.types'
import { createDefaultProject, generateClipId, computeClipPositions } from '../utils/time-utils'
import { useUndoRedo } from './useUndoRedo'

interface UseEditorStateProps {
    episodeId: string
    initialProject?: VideoEditorProject
}

export function useEditorState({ episodeId, initialProject }: UseEditorStateProps) {
    // 项目数据 (带撤销/重做)
    const {
        state: project,
        pushState: pushProject,
        undo,
        redo,
        reset: resetUndoHistory,
        canUndo,
        canRedo
    } = useUndoRedo<VideoEditorProject>(initialProject || createDefaultProject(episodeId))

    // 时间轴 UI 状态
    const [timelineState, setTimelineState] = useState<TimelineState>({
        currentFrame: 0,
        playing: false,
        selectedClipId: null,
        zoom: 1,
        scrollX: 0,
        tool: 'select'
    })

    // 是否有未保存的更改
    const [isDirty, setIsDirty] = useState(false)

    // 辅助：更新项目并推入历史
    const updateProject = useCallback((updater: (prev: VideoEditorProject) => VideoEditorProject) => {
        const newProject = updater(project)
        pushProject(newProject)
        setIsDirty(true)
    }, [project, pushProject])

    // ========================================
    // 时间轴片段操作
    // ========================================

    const addClip = useCallback((clip: Omit<VideoClip, 'id'>) => {
        const newClip: VideoClip = { ...clip, id: generateClipId() }
        updateProject(prev => ({
            ...prev,
            timeline: [...prev.timeline, newClip]
        }))
        return newClip.id
    }, [updateProject])

    const removeClip = useCallback((clipId: string) => {
        updateProject(prev => ({
            ...prev,
            timeline: prev.timeline.filter(c => c.id !== clipId)
        }))
    }, [updateProject])

    const updateClip = useCallback((clipId: string, updates: Partial<VideoClip>) => {
        updateProject(prev => ({
            ...prev,
            timeline: prev.timeline.map(c =>
                c.id === clipId ? { ...c, ...updates } : c
            )
        }))
    }, [updateProject])

    const reorderClips = useCallback((fromIndex: number, toIndex: number) => {
        updateProject(prev => {
            const newTimeline = [...prev.timeline]
            const [removed] = newTimeline.splice(fromIndex, 1)
            newTimeline.splice(toIndex, 0, removed)
            return { ...prev, timeline: newTimeline }
        })
    }, [updateProject])

    // ========================================
    // 裁剪 (Trim)
    // ========================================

    const trimClip = useCallback((clipId: string, edge: 'left' | 'right', deltaFrames: number) => {
        updateProject(prev => ({
            ...prev,
            timeline: prev.timeline.map(c => {
                if (c.id !== clipId) return c

                const trimFrom = c.trim?.from || 0
                const maxFrames = c.sourceDurationInFrames || c.durationInFrames + trimFrom
                const minDuration = 3

                if (edge === 'left') {
                    const newFrom = Math.max(0, Math.min(trimFrom + deltaFrames, maxFrames - minDuration))
                    const frameDelta = newFrom - trimFrom
                    return {
                        ...c,
                        trim: { from: newFrom, to: c.trim?.to || c.durationInFrames + trimFrom },
                        durationInFrames: Math.max(minDuration, c.durationInFrames - frameDelta)
                    }
                } else {
                    const newDuration = Math.max(minDuration, c.durationInFrames + deltaFrames)
                    const maxDuration = maxFrames - trimFrom
                    return {
                        ...c,
                        durationInFrames: Math.min(newDuration, maxDuration),
                        trim: { from: trimFrom, to: trimFrom + Math.min(newDuration, maxDuration) }
                    }
                }
            })
        }))
    }, [updateProject])

    // ========================================
    // 分割 (Split)
    // ========================================

    const splitClipAtFrame = useCallback((globalFrame: number) => {
        const computed = computeClipPositions(project.timeline)
        const clipIndex = computed.findIndex(c =>
            globalFrame >= c.startFrame && globalFrame < c.endFrame
        )
        if (clipIndex === -1) return

        const clip = project.timeline[clipIndex]
        const computedClip = computed[clipIndex]
        const localFrame = globalFrame - computedClip.startFrame

        if (localFrame <= 0 || localFrame >= clip.durationInFrames) return

        const trimFrom = clip.trim?.from || 0

        const clipA: VideoClip = {
            ...clip,
            id: generateClipId(),
            durationInFrames: localFrame,
            trim: { from: trimFrom, to: trimFrom + localFrame },
            transition: undefined,
            sourceDurationInFrames: clip.sourceDurationInFrames
        }

        const clipB: VideoClip = {
            ...clip,
            id: generateClipId(),
            durationInFrames: clip.durationInFrames - localFrame,
            trim: { from: trimFrom + localFrame, to: trimFrom + clip.durationInFrames },
            metadata: { ...clip.metadata },
            sourceDurationInFrames: clip.sourceDurationInFrames
        }

        updateProject(prev => {
            const newTimeline = [...prev.timeline]
            newTimeline.splice(clipIndex, 1, clipA, clipB)
            return { ...prev, timeline: newTimeline }
        })
    }, [project.timeline, updateProject])

    // ========================================
    // BGM 操作
    // ========================================

    const addBgm = useCallback((bgm: Omit<BgmClip, 'id'>) => {
        updateProject(prev => ({
            ...prev,
            bgmTrack: [...prev.bgmTrack, { ...bgm, id: `bgm_${Date.now()}` }]
        }))
    }, [updateProject])

    const removeBgm = useCallback((bgmId: string) => {
        updateProject(prev => ({
            ...prev,
            bgmTrack: prev.bgmTrack.filter(b => b.id !== bgmId)
        }))
    }, [updateProject])

    // ========================================
    // 播放控制
    // ========================================

    const play = useCallback(() => {
        setTimelineState(prev => ({ ...prev, playing: true }))
    }, [])

    const pause = useCallback(() => {
        setTimelineState(prev => ({ ...prev, playing: false }))
    }, [])

    const togglePlay = useCallback(() => {
        setTimelineState(prev => ({ ...prev, playing: !prev.playing }))
    }, [])

    const seek = useCallback((frame: number) => {
        setTimelineState(prev => ({ ...prev, currentFrame: Math.max(0, frame) }))
    }, [])

    const selectClip = useCallback((clipId: string | null) => {
        setTimelineState(prev => ({ ...prev, selectedClipId: clipId }))
    }, [])

    const setZoom = useCallback((zoom: number) => {
        setTimelineState(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(5, zoom)) }))
    }, [])

    const setScrollX = useCallback((scrollX: number) => {
        setTimelineState(prev => ({ ...prev, scrollX: Math.max(0, scrollX) }))
    }, [])

    const setTool = useCallback((tool: EditorTool) => {
        setTimelineState(prev => ({ ...prev, tool }))
    }, [])

    // ========================================
    // 项目操作
    // ========================================

    const resetProject = useCallback(() => {
        resetUndoHistory(createDefaultProject(episodeId))
        setIsDirty(false)
    }, [episodeId, resetUndoHistory])

    const loadProject = useCallback((data: VideoEditorProject) => {
        resetUndoHistory(data)
        setIsDirty(false)
    }, [resetUndoHistory])

    const markSaved = useCallback(() => {
        setIsDirty(false)
    }, [])

    const selectedClip = useMemo(() =>
        project.timeline.find(c => c.id === timelineState.selectedClipId) || null,
        [project.timeline, timelineState.selectedClipId]
    )

    return {
        project,
        timelineState,
        isDirty,
        selectedClip,

        undo, redo, canUndo, canRedo,

        addClip, removeClip, updateClip, reorderClips,
        trimClip, splitClipAtFrame,

        addBgm, removeBgm,

        play, pause, togglePlay, seek,
        selectClip, setZoom, setScrollX, setTool,

        resetProject, loadProject, markSaved
    }
}
