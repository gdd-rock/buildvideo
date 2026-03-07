'use client'

import { useState, useEffect } from 'react'
import { extractThumbnails } from '../utils/thumbnail-cache'

/**
 * 提取视频缩略图条的 React Hook
 * @param videoSrc 视频源URL
 * @param thumbCount 缩略图数量
 */
export function useThumbnailStrip(videoSrc: string, thumbCount: number = 8): string[] | null {
    const [thumbnails, setThumbnails] = useState<string[] | null>(null)

    useEffect(() => {
        if (!videoSrc) return

        let cancelled = false

        extractThumbnails(videoSrc, thumbCount).then((result) => {
            if (!cancelled && result.thumbnails.length > 0) {
                setThumbnails(result.thumbnails)
            }
        })

        return () => { cancelled = true }
    }, [videoSrc, thumbCount])

    return thumbnails
}
