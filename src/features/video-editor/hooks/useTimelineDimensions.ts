'use client'

import { useMemo } from 'react'

const BASE_PIXELS_PER_SECOND = 100

/**
 * 时间轴尺寸换算 Hook
 * 负责帧↔像素的换算，以及时间轴布局计算
 */
export function useTimelineDimensions(fps: number, zoom: number) {
    return useMemo(() => {
        const pixelsPerSecond = BASE_PIXELS_PER_SECOND * zoom
        const pixelsPerFrame = pixelsPerSecond / fps

        return {
            pixelsPerSecond,
            pixelsPerFrame,

            /** 帧数 → 像素宽度 */
            framesToPixels: (frames: number) => frames * pixelsPerFrame,

            /** 像素偏移 → 帧数 */
            pixelsToFrames: (px: number) => Math.round(px / pixelsPerFrame),

            /** 秒数 → 像素宽度 */
            secondsToPixels: (seconds: number) => seconds * pixelsPerSecond,
        }
    }, [fps, zoom])
}
