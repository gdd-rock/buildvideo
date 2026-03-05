import { Job } from 'bullmq'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '@/lib/prisma'
import { uploadToCOS, getSignedUrl, toFetchableUrl } from '@/lib/cos'
import { logInfo, logError } from '@/lib/logging/core'
import { reportTaskProgress } from '@/lib/workers/shared'
import { concatVideosWithFFmpeg } from '@/lib/video/ffmpeg-concat'
import type { TaskJobData } from '@/lib/task/types'

/**
 * 视频合成 Worker Handler
 * 下载所有镜头视频 → FFmpeg 拼接 → 上传 COS → 返回下载链接
 */
export async function handleVideoMergeTask(job: Job<TaskJobData>) {
  const { episodeId, projectId, payload } = job.data
  const transition = (payload?.transition as 'none' | 'fade') || 'none'
  const panelPreferences = (payload?.panelPreferences as Record<string, boolean>) || {}

  if (!episodeId) {
    throw new Error('episodeId is required for video merge')
  }

  await reportTaskProgress(job, 10, {
    stage: 'video_merge_download',
    stageLabel: '下载视频片段',
    displayMode: 'detail',
  })

  // 查询所有面板视频
  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    include: {
      storyboards: {
        include: {
          panels: { orderBy: { panelIndex: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      clips: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  // 按 clipIndex + panelIndex 排序收集视频
  interface VideoInfo {
    videoKey: string
    clipIndex: number
    panelIndex: number
  }

  const allClips = episode.clips || []
  const videos: VideoInfo[] = []

  for (const storyboard of episode.storyboards) {
    const clipIndex = allClips.findIndex(c => c.id === storyboard.clipId)
    for (const panel of storyboard.panels) {
      const panelKey = `${storyboard.id}-${panel.panelIndex || 0}`
      const preferLipSync = panelPreferences[panelKey] ?? true

      let videoKey: string | null = null
      if (preferLipSync) {
        videoKey = panel.lipSyncVideoUrl || panel.videoUrl
      } else {
        videoKey = panel.videoUrl || panel.lipSyncVideoUrl
      }

      if (videoKey) {
        videos.push({
          videoKey,
          clipIndex: clipIndex >= 0 ? clipIndex : 999,
          panelIndex: panel.panelIndex || 0,
        })
      }
    }
  }

  videos.sort((a, b) => {
    if (a.clipIndex !== b.clipIndex) return a.clipIndex - b.clipIndex
    return a.panelIndex - b.panelIndex
  })

  if (videos.length === 0) {
    throw new Error('No videos found to merge')
  }

  logInfo(`[video-merge] 共 ${videos.length} 个视频片段需要合并`)

  // 创建临时目录
  const tmpDir = path.join(os.tmpdir(), `merge-${job.data.taskId}`)
  await fs.mkdir(tmpDir, { recursive: true })

  try {
    // 下载所有视频到本地
    const localFiles: string[] = []
    for (let i = 0; i < videos.length; i++) {
      const progress = 10 + Math.floor((i / videos.length) * 50)
      await reportTaskProgress(job, progress, {
        stage: 'video_merge_download',
        stageLabel: `下载视频 ${i + 1}/${videos.length}`,
        displayMode: 'detail',
      })

      const video = videos[i]
      const localPath = path.join(tmpDir, `clip_${String(i).padStart(3, '0')}.mp4`)

      // 生成可下载的 URL
      let fetchUrl: string
      if (video.videoKey.startsWith('http://') || video.videoKey.startsWith('https://')) {
        fetchUrl = video.videoKey
      } else {
        fetchUrl = toFetchableUrl(getSignedUrl(video.videoKey, 3600))
      }

      const response = await fetch(fetchUrl)
      if (!response.ok) {
        logError(`[video-merge] 下载失败: ${video.videoKey} (${response.status})`)
        continue
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(localPath, buffer)
      localFiles.push(localPath)

      logInfo(`[video-merge] 已下载 ${i + 1}/${videos.length}: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`)
    }

    if (localFiles.length === 0) {
      throw new Error('All video downloads failed')
    }

    // FFmpeg 拼接
    await reportTaskProgress(job, 65, {
      stage: 'video_merge_concat',
      stageLabel: 'FFmpeg 拼接中',
      displayMode: 'detail',
    })

    const outputPath = path.join(tmpDir, 'merged_output.mp4')
    await concatVideosWithFFmpeg({
      inputFiles: localFiles,
      outputFile: outputPath,
      transition,
      transitionDuration: 0.5,
    })

    logInfo(`[video-merge] FFmpeg 拼接完成`)

    // 上传到 COS
    await reportTaskProgress(job, 90, {
      stage: 'video_merge_upload',
      stageLabel: '上传成片',
      displayMode: 'detail',
    })

    const outputBuffer = await fs.readFile(outputPath)
    const cosKey = `merged-video/${episodeId}/${Date.now()}.mp4`
    await uploadToCOS(outputBuffer, cosKey)

    logInfo(`[video-merge] 上传完成: ${cosKey}, 大小: ${(outputBuffer.length / 1024 / 1024).toFixed(1)}MB`)

    await reportTaskProgress(job, 99, {
      stage: 'video_merge_done',
      stageLabel: '合成完成',
      displayMode: 'detail',
    })

    return {
      success: true,
      outputKey: cosKey,
      videoCount: localFiles.length,
      fileSizeMB: (outputBuffer.length / 1024 / 1024).toFixed(1),
    }
  } finally {
    // 清理临时目录
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
