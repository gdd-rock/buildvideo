'use client'

import React, { useRef, useEffect } from 'react'

interface TimelineRulerProps {
    totalFrames: number
    fps: number
    pixelsPerFrame: number
    scrollX: number
    width: number
    onSeek: (frame: number) => void
}

/**
 * 时间码标尺 (Canvas 渲染)
 */
export const TimelineRuler: React.FC<TimelineRulerProps> = ({
    totalFrames,
    fps,
    pixelsPerFrame,
    scrollX,
    width,
    onSeek
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const height = 28

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, width, height)

        // 计算可见范围
        const startFrame = Math.floor(scrollX / pixelsPerFrame)
        const endFrame = Math.ceil((scrollX + width) / pixelsPerFrame)

        // 计算合适的刻度间隔
        const pixelsPerSecond = pixelsPerFrame * fps
        let tickIntervalSec = 1
        if (pixelsPerSecond < 30) tickIntervalSec = 5
        else if (pixelsPerSecond < 60) tickIntervalSec = 2
        else if (pixelsPerSecond > 300) tickIntervalSec = 0.5

        const tickIntervalFrames = Math.round(tickIntervalSec * fps)

        ctx.fillStyle = 'var(--glass-text-tertiary, #888)'
        ctx.font = '10px system-ui, sans-serif'
        ctx.textAlign = 'center'

        for (let f = 0; f <= Math.max(totalFrames, endFrame); f += tickIntervalFrames) {
            if (f < startFrame - tickIntervalFrames) continue
            if (f > endFrame + tickIntervalFrames) break

            const x = f * pixelsPerFrame - scrollX
            const sec = f / fps
            const min = Math.floor(sec / 60)
            const s = Math.floor(sec % 60)
            const label = `${min}:${s.toString().padStart(2, '0')}`

            // 主刻度线
            ctx.strokeStyle = 'var(--glass-stroke-base, #444)'
            ctx.beginPath()
            ctx.moveTo(x, height - 10)
            ctx.lineTo(x, height)
            ctx.stroke()

            // 文字
            ctx.fillText(label, x, height - 13)

            // 半刻度
            if (tickIntervalSec >= 1) {
                const halfX = x + (tickIntervalFrames * pixelsPerFrame) / 2
                ctx.beginPath()
                ctx.moveTo(halfX, height - 5)
                ctx.lineTo(halfX, height)
                ctx.stroke()
            }
        }
    }, [totalFrames, fps, pixelsPerFrame, scrollX, width])

    const handleClick = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left + scrollX
        const frame = Math.round(x / pixelsPerFrame)
        onSeek(Math.max(0, Math.min(totalFrames, frame)))
    }

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
                width: '100%',
                height: `${height}px`,
                cursor: 'pointer',
                display: 'block'
            }}
            onClick={handleClick}
        />
    )
}
