'use client'

import React from 'react'

interface TimelinePlayheadProps {
    currentFrame: number
    pixelsPerFrame: number
    scrollX: number
    height: number
    playing: boolean
}

/**
 * 播放头指示线
 */
export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
    currentFrame,
    pixelsPerFrame,
    scrollX,
    height,
    playing
}) => {
    const x = currentFrame * pixelsPerFrame - scrollX

    if (x < -2 || x > 5000) return null

    return (
        <div
            style={{
                position: 'absolute',
                left: `${x}px`,
                top: 0,
                bottom: 0,
                width: '2px',
                background: '#ff4444',
                zIndex: 50,
                pointerEvents: 'none',
                transition: playing ? 'none' : 'left 0.05s linear'
            }}
        >
            {/* 播放头顶部三角 */}
            <div style={{
                position: 'absolute',
                top: '-2px',
                left: '-5px',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '8px solid #ff4444'
            }} />
        </div>
    )
}
