'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy
} from '@dnd-kit/sortable'
import { VideoClip, TimelineState, EditorConfig, EditorTool } from '../../types/editor.types'
import { framesToTime, calculateTimelineDuration } from '../../utils/time-utils'
import { useTimelineDimensions } from '../../hooks/useTimelineDimensions'
import { TimelineRuler } from './TimelineRuler'
import { TimelinePlayhead } from './TimelinePlayhead'
import { TimelineToolbar } from './TimelineToolbar'
import { TimelineClipBlock } from './TimelineClipBlock'

interface TimelineProps {
    clips: VideoClip[]
    timelineState: TimelineState
    config: EditorConfig
    onReorder: (fromIndex: number, toIndex: number) => void
    onSelectClip: (clipId: string | null) => void
    onZoomChange: (zoom: number) => void
    onSeek?: (frame: number) => void
    onScrollXChange?: (scrollX: number) => void
    onToolChange?: (tool: EditorTool) => void
    onTrimClip?: (clipId: string, edge: 'left' | 'right', deltaFrames: number) => void
    onSplitAtFrame?: (frame: number) => void
}

/**
 * 时间轴主组件 (CapCut 风格)
 * 缩略图条 + 标尺 + 播放头 + 拖拽排序 + 裁剪手柄
 */
export const Timeline: React.FC<TimelineProps> = ({
    clips,
    timelineState,
    config,
    onReorder,
    onSelectClip,
    onZoomChange,
    onSeek,
    onScrollXChange,
    onToolChange,
    onTrimClip,
    onSplitAtFrame
}) => {
    const t = useTranslations('video')
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(800)

    const totalDuration = calculateTimelineDuration(clips)
    const { pixelsPerFrame, framesToPixels } = useTimelineDimensions(config.fps, timelineState.zoom)

    // 监听容器宽度
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width)
            }
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (over && active.id !== over.id) {
            const oldIndex = clips.findIndex(c => c.id === active.id)
            const newIndex = clips.findIndex(c => c.id === over.id)
            onReorder(oldIndex, newIndex)
        }
    }

    // 裁剪手柄拖拽
    const handleTrimStart = useCallback((clipId: string, edge: 'left' | 'right') => {
        let currentStartX = 0
        const moveHandler = (e: MouseEvent) => {
            if (currentStartX === 0) {
                currentStartX = e.clientX
                return
            }
            const deltaX = e.clientX - currentStartX
            const deltaFrames = Math.round(deltaX / pixelsPerFrame)
            if (deltaFrames !== 0) {
                onTrimClip?.(clipId, edge, deltaFrames)
                currentStartX = e.clientX
            }
        }
        const upHandler = () => {
            window.removeEventListener('mousemove', moveHandler)
            window.removeEventListener('mouseup', upHandler)
        }
        window.addEventListener('mousemove', moveHandler)
        window.addEventListener('mouseup', upHandler)
    }, [pixelsPerFrame, onTrimClip])

    // 时间轴点击定位/分割
    const handleTrackAreaClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        // 如果点击的是片段内的元素，不处理
        if (target.closest('[data-clip-block]')) return

        const trackArea = e.currentTarget
        const rect = trackArea.getBoundingClientRect()
        const x = e.clientX - rect.left - 60 + timelineState.scrollX // 60px = 轨道标签宽度
        if (x < 0) return
        const frame = Math.round(x / pixelsPerFrame)

        if (timelineState.tool === 'split') {
            onSplitAtFrame?.(frame)
        } else {
            onSeek?.(Math.max(0, Math.min(totalDuration, frame)))
        }
    }, [pixelsPerFrame, timelineState.scrollX, timelineState.tool, totalDuration, onSeek, onSplitAtFrame])

    // 滚轮缩放/滚动
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const delta = e.deltaY > 0 ? -0.1 : 0.1
            onZoomChange(timelineState.zoom + delta)
        } else {
            onScrollXChange?.(timelineState.scrollX + e.deltaX + e.deltaY)
        }
    }, [timelineState.zoom, timelineState.scrollX, onZoomChange, onScrollXChange])

    const currentTime = framesToTime(timelineState.currentFrame, config.fps)
    const totalTime = framesToTime(totalDuration, config.fps)
    const trackLabel = 'var(--glass-text-secondary)'

    return (
        <div
            ref={containerRef}
            className="timeline-v2"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                background: 'var(--glass-bg-surface)',
                userSelect: 'none'
            }}
            onWheel={handleWheel}
        >
            {/* 工具栏 */}
            <TimelineToolbar
                activeTool={timelineState.tool}
                onToolChange={onToolChange || (() => {})}
                zoom={timelineState.zoom}
                onZoomChange={onZoomChange}
                currentTime={currentTime}
                totalTime={totalTime}
            />

            {/* 标尺 + 轨道区域 */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {/* 标尺 */}
                <div style={{ paddingLeft: '60px' }}>
                    <TimelineRuler
                        totalFrames={totalDuration}
                        fps={config.fps}
                        pixelsPerFrame={pixelsPerFrame}
                        scrollX={timelineState.scrollX}
                        width={Math.max(100, containerWidth - 60)}
                        onSeek={onSeek || (() => {})}
                    />
                </div>

                {/* 轨道容器 */}
                <div
                    style={{
                        position: 'relative',
                        cursor: timelineState.tool === 'split' ? 'crosshair' : 'default'
                    }}
                    onClick={handleTrackAreaClick}
                >
                    {/* 播放头 */}
                    <div style={{ position: 'absolute', left: '60px', right: 0, top: 0, bottom: 0, pointerEvents: 'none' }}>
                        <TimelinePlayhead
                            currentFrame={timelineState.currentFrame}
                            pixelsPerFrame={pixelsPerFrame}
                            scrollX={timelineState.scrollX}
                            height={200}
                            playing={timelineState.playing}
                        />
                    </div>

                    {/* 视频轨道 */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: '64px',
                        borderBottom: '1px solid var(--glass-stroke-base)',
                    }}>
                        <span style={{
                            fontSize: '11px',
                            color: trackLabel,
                            width: '60px',
                            flexShrink: 0,
                            textAlign: 'center',
                            fontWeight: 500
                        }}>
                            {t('editor.timeline.videoTrack')}
                        </span>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={clips.map(c => c.id)}
                                strategy={horizontalListSortingStrategy}
                            >
                                <div style={{
                                    display: 'flex',
                                    gap: '2px',
                                    flex: 1,
                                    overflowX: 'auto',
                                    padding: '4px 8px',
                                    transform: `translateX(-${timelineState.scrollX}px)`,
                                }}>
                                    {clips.map((clip, index) => (
                                        <TimelineClipBlock
                                            key={clip.id}
                                            clip={clip}
                                            index={index}
                                            isSelected={timelineState.selectedClipId === clip.id}
                                            widthPx={framesToPixels(clip.durationInFrames)}
                                            fps={config.fps}
                                            activeTool={timelineState.tool}
                                            onClick={() => onSelectClip(clip.id)}
                                            onTrimStart={handleTrimStart}
                                        />
                                    ))}
                                    {clips.length === 0 && (
                                        <span style={{ fontSize: '12px', color: 'var(--glass-text-tertiary)', padding: '16px' }}>
                                            {t('editor.timeline.emptyHint')}
                                        </span>
                                    )}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>

                    {/* 配音轨道 */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: '32px',
                        borderBottom: '1px solid var(--glass-stroke-base)',
                    }}>
                        <span style={{ fontSize: '11px', color: trackLabel, width: '60px', flexShrink: 0, textAlign: 'center' }}>
                            {t('editor.timeline.audioTrack')}
                        </span>
                        <div style={{ display: 'flex', gap: '2px', flex: 1, padding: '2px 8px', transform: `translateX(-${timelineState.scrollX}px)` }}>
                            {clips.filter(c => c.attachment?.audio).map((clip) => (
                                <div key={`audio-${clip.id}`} style={{
                                    width: `${framesToPixels(clip.durationInFrames)}px`,
                                    minWidth: '20px', height: '22px',
                                    background: 'var(--glass-tone-success-bg)', borderRadius: '3px',
                                    fontSize: '9px', color: 'var(--glass-tone-success-fg)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>{t('editor.timeline.audioBadge')}</div>
                            ))}
                        </div>
                    </div>

                    {/* 字幕轨道 */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        height: '32px',
                        borderBottom: '1px solid var(--glass-stroke-base)',
                    }}>
                        <span style={{ fontSize: '11px', color: trackLabel, width: '60px', flexShrink: 0, textAlign: 'center' }}>
                            {t('editor.timeline.subtitleTrack')}
                        </span>
                        <div style={{ display: 'flex', gap: '2px', flex: 1, padding: '2px 8px', transform: `translateX(-${timelineState.scrollX}px)` }}>
                            {clips.filter(c => c.attachment?.subtitle).map((clip) => (
                                <div key={`sub-${clip.id}`} style={{
                                    width: `${framesToPixels(clip.durationInFrames)}px`,
                                    minWidth: '20px', height: '22px',
                                    background: 'rgba(59,130,246,0.15)', borderRadius: '3px',
                                    fontSize: '9px', color: '#3b82f6',
                                    display: 'flex', alignItems: 'center', padding: '0 4px',
                                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flexShrink: 0
                                }}>{clip.attachment?.subtitle?.text}</div>
                            ))}
                        </div>
                    </div>

                    {/* BGM 轨道 */}
                    <div style={{ display: 'flex', alignItems: 'center', height: '32px' }}>
                        <span style={{ fontSize: '11px', color: trackLabel, width: '60px', flexShrink: 0, textAlign: 'center' }}>BGM</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Timeline
