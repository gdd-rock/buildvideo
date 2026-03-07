'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { EditorTool } from '../../types/editor.types'

interface TimelineToolbarProps {
    activeTool: EditorTool
    onToolChange: (tool: EditorTool) => void
    zoom: number
    onZoomChange: (zoom: number) => void
    currentTime: string
    totalTime: string
}

const TOOLS: { id: EditorTool; labelKey: string; icon: string }[] = [
    { id: 'select', labelKey: 'select', icon: '↖' },
    { id: 'trim', labelKey: 'trim', icon: '⟷' },
    { id: 'split', labelKey: 'split', icon: '✂' },
    { id: 'hand', labelKey: 'hand', icon: '✋' },
]

export const TimelineToolbar: React.FC<TimelineToolbarProps> = ({
    activeTool,
    onToolChange,
    zoom,
    onZoomChange,
    currentTime,
    totalTime
}) => {
    const t = useTranslations('video')

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 12px',
            borderBottom: '1px solid var(--glass-stroke-base)',
            background: 'var(--glass-bg-surface-strong)',
            fontSize: '12px'
        }}>
            {/* 工具按钮 */}
            {TOOLS.map(tool => (
                <button
                    key={tool.id}
                    onClick={() => onToolChange(tool.id)}
                    title={t(`editor.tools.${tool.labelKey}`)}
                    style={{
                        width: '32px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: activeTool === tool.id
                            ? 'var(--glass-accent-from)'
                            : 'transparent',
                        border: activeTool === tool.id
                            ? '1px solid var(--glass-stroke-focus)'
                            : '1px solid transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: activeTool === tool.id
                            ? 'var(--glass-text-on-accent)'
                            : 'var(--glass-text-primary)',
                        fontSize: '14px'
                    }}
                >
                    {tool.icon}
                </button>
            ))}

            <div style={{ width: '1px', height: '20px', background: 'var(--glass-stroke-base)', margin: '0 4px' }} />

            {/* 缩放 */}
            <span style={{ color: 'var(--glass-text-tertiary)' }}>
                {t('editor.timeline.zoomLabel')}
            </span>
            <input
                type="range"
                min="0.3"
                max="4"
                step="0.1"
                value={zoom}
                onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                style={{ width: '80px' }}
            />
            <span style={{ color: 'var(--glass-text-tertiary)', minWidth: '36px' }}>
                {Math.round(zoom * 100)}%
            </span>

            <div style={{ flex: 1 }} />

            {/* 时间码 */}
            <span style={{ color: 'var(--glass-text-secondary)', fontFamily: 'monospace' }}>
                {currentTime} / {totalTime}
            </span>
        </div>
    )
}
