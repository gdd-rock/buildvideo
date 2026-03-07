/**
 * 视频缩略图提取与缓存
 * 使用离屏 <video> + <canvas> 提取帧画面
 */

const THUMB_WIDTH = 160
const THUMB_HEIGHT = 90
const THUMB_QUALITY = 0.6

interface ThumbnailResult {
    thumbnails: string[]  // data:image/jpeg URLs
    interval: number      // 每张缩略图间隔秒数
}

const cache = new Map<string, ThumbnailResult>()
const pending = new Map<string, Promise<ThumbnailResult>>()

/**
 * 提取视频缩略图条
 * @param videoSrc 视频URL（需同源或CORS允许）
 * @param thumbCount 缩略图数量
 */
export function extractThumbnails(
    videoSrc: string,
    thumbCount: number = 8
): Promise<ThumbnailResult> {
    // 命中缓存
    const cached = cache.get(videoSrc)
    if (cached) return Promise.resolve(cached)

    // 正在提取中，返回同一个 Promise
    const existing = pending.get(videoSrc)
    if (existing) return existing

    const promise = doExtract(videoSrc, thumbCount)
    pending.set(videoSrc, promise)
    promise.finally(() => pending.delete(videoSrc))
    return promise
}

async function doExtract(videoSrc: string, thumbCount: number): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.muted = true
        video.preload = 'auto'

        const canvas = document.createElement('canvas')
        canvas.width = THUMB_WIDTH
        canvas.height = THUMB_HEIGHT
        const ctx = canvas.getContext('2d')!

        const thumbnails: string[] = []
        let duration = 0
        let currentIndex = 0

        video.onloadedmetadata = () => {
            duration = video.duration
            if (duration <= 0 || !isFinite(duration)) {
                const fallback: ThumbnailResult = { thumbnails: [], interval: 0 }
                cache.set(videoSrc, fallback)
                resolve(fallback)
                return
            }
            seekNext()
        }

        video.onerror = () => {
            const fallback: ThumbnailResult = { thumbnails: [], interval: 0 }
            cache.set(videoSrc, fallback)
            resolve(fallback)
        }

        function seekNext() {
            if (currentIndex >= thumbCount) {
                const result: ThumbnailResult = {
                    thumbnails,
                    interval: duration / thumbCount
                }
                cache.set(videoSrc, result)
                video.src = ''
                resolve(result)
                return
            }
            const time = (currentIndex + 0.5) * (duration / thumbCount)
            video.currentTime = Math.min(time, duration - 0.01)
        }

        video.onseeked = () => {
            ctx.drawImage(video, 0, 0, THUMB_WIDTH, THUMB_HEIGHT)
            thumbnails.push(canvas.toDataURL('image/jpeg', THUMB_QUALITY))
            currentIndex++
            seekNext()
        }

        video.src = videoSrc
    })
}

/**
 * 清除指定视频的缓存
 */
export function clearThumbnailCache(videoSrc?: string) {
    if (videoSrc) {
        cache.delete(videoSrc)
    } else {
        cache.clear()
    }
}
