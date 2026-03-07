'use client'

import React, { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { VideoClip, EditorTool } from '../../types/editor.types'
import { framesToTime } from '../../utils/time-utils'
import { useThumbnailStrip } from '../../hooks/useThumbnailStrip'

interface TimelineClipBlockProps {
    clip: VideoClip
    index: number
    isSelected: boolean
    widthPx: number
    fps: number
    activeTool: EditorTool
    onClick: () => void
    onTrimStart?: (clipId: string, edge: 'left' | 'right') => void
}

/**
 * 时间轴片段块
 * 带缩略图条 + 裁剪手柄
 */
export const TimelineClipBlock: React.FC<TimelineClipBlockProps> = ({
    clip,
    index,
    isSelected,
    widthPx,
    fps,
    activeTool,
    onClick,
    onTrimStart
}) => {
    const thumbnails = useThumbnailStrip(clip.src, 8)
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: clip.id })

    const handleTrimMouseDown = useCallback((e: React.MouseEvent, edge: 'left' | 'right') => {
        e.stopPropagation()
        e.preventDefault()
        onTrimStart?.(clip.id, edge)
    }, [clip.id, onTrimStart])

    const showTrimHandles = activeTool === 'trim' || activeTool === 'select'
    const clipWidth = Math.max(40, widthPx)

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        width: `${clipWidth}px`,
        height: '56px',
        position: 'relative',
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: isDragging ? 'grabbing' : activeTool === 'split' ? 'crosshair' : 'pointer',
        flexShrink: 0,
        border: isSelected ? '2px solid var(--glass-stroke-focus)' : '1px solid var(--glass-stroke-base)',
        opacity: isDragging ? 0.7 : 1,
        zIndex: isDragging ? 100 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            {...attributes}
            {...(activeTool !== 'trim' ? listeners : {})}
        >
            {/* 缩略图条 */}
            <div style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
            }}>
                {thumbnails ? (
                    thumbnails.map((thumb, i) => (
                        <img
                            key={i}
                            src={thumb}
                            alt=""
                            draggable={false}
                            style={{
                                width: `${100 / thumbnails.length}%`,
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                                pointerEvents: 'none'
                            }}
                        />
                    ))
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: isSelected
                            ? 'var(--glass-accent-from)'
                            : 'var(--glass-bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <span style={{
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: isSelected ? 'var(--glass-text-on-accent)' : 'var(--glass-text-primary)'
                        }}>
                            {index + 1}
                        </span>
                    </div>
                )}
            </div>

            {/* 半透明覆盖层 + 信息 */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                padding: '2px 4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                pointerEvents: 'none'
            }}>
                <span style={{ fontSize: '10px', color: '#fff', fontWeight: 500 }}>
                    {index + 1}
                </span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)' }}>
                    {framesToTime(clip.durationInFrames, fps)}
                </span>
            </div>

            {/* 转场指示器 */}
            {clip.transition && clip.transition.type !== 'none' && (
                <div style={{
                    position: 'absolute',
                    right: '-1px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '14px',
                    height: '14px',
                    background: 'var(--glass-tone-warning-fg)',
                    borderRadius: '50%',
                    fontSize: '8px',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }}>
                    T
                </div>
            )}

            {/* 选中高亮 */}
            {isSelected && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    border: '2px solid var(--glass-stroke-focus)',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                    boxShadow: '0 0 8px var(--glass-accent-shadow-strong, rgba(100,100,255,0.3))'
                }} />
            )}

            {/* 裁剪手柄 - 左 */}
            {showTrimHandles && (
                <div
                    onMouseDown={(e) => handleTrimMouseDown(e, 'left')}
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        background: isSelected ? 'rgba(255,255,255,0.3)' : 'transparent',
                        zIndex: 20,
                        borderRadius: '4px 0 0 4px'
                    }}
                />
            )}

            {/* 裁剪手柄 - 右 */}
            {showTrimHandles && (
                <div
                    onMouseDown={(e) => handleTrimMouseDown(e, 'right')}
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        background: isSelected ? 'rgba(255,255,255,0.3)' : 'transparent',
                        zIndex: 20,
                        borderRadius: '0 4px 4px 0'
                    }}
                />
            )}

            {/* 字幕指示 */}
            {clip.attachment?.subtitle && (
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: '4px',
                    fontSize: '8px',
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    padding: '1px 3px',
                    borderRadius: '2px',
                    pointerEvents: 'none'
                }}>
                    字
                </div>
            )}
        </div>
    )
}
