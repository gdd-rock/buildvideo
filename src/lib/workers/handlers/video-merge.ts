import { Job } from 'bullmq'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { prisma } from '@/lib/prisma'
import { uploadToCOS, getSignedUrl, toFetchableUrl } from '@/lib/cos'
import { logInfo, logError } from '@/lib/logging/core'
import { reportTaskProgress } from '@/lib/workers/shared'
import {
  concatVideosWithFFmpeg,
  getVideoDuration,
  type SubtitleEntry,
  type PanelTransitionInfo,
  type ClipSyncInfo,
} from '@/lib/video/ffmpeg-concat'
import type { TaskJobData } from '@/lib/task/types'

/**
 * 视频合成 Worker Handler
 * 下载所有镜头视频 → FFmpeg 拼接（含字幕/BGM/智能转场） → 上传 COS
 */
export async function handleVideoMergeTask(job: Job<TaskJobData>) {
  const { episodeId, payload } = job.data
  const transition = (payload?.transition as 'none' | 'fade' | 'smart') || 'none'
  const panelPreferences = (payload?.panelPreferences as Record<string, boolean>) || {}
  const enableSubtitles = payload?.subtitles !== false // 默认开启
  const bgmUrl = payload?.bgmUrl as string | undefined
  const bgmVolume = typeof payload?.bgmVolume === 'number' ? payload.bgmVolume : 0.15

  if (!episodeId) {
    throw new Error('episodeId is required for video merge')
  }

  await reportTaskProgress(job, 5, {
    stage: 'video_merge_prepare',
    stageLabel: '准备合成数据',
    displayMode: 'detail',
  })

  // 查询面板+配音
  const episode = await prisma.novelPromotionEpisode.findUnique({
    where: { id: episodeId },
    include: {
      storyboards: {
        include: {
          panels: {
            orderBy: { panelIndex: 'asc' },
            select: {
              id: true,
              panelIndex: true,
              shotType: true,
              linkedToNextPanel: true,
              lipSyncVideoUrl: true,
              videoUrl: true,
              srtSegment: true,
              storyboardId: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      clips: { orderBy: { createdAt: 'asc' } },
      voiceLines: {
        where: { audioUrl: { not: null }, matchedPanelId: { not: null } },
        orderBy: { lineIndex: 'asc' },
        select: { content: true, speaker: true, matchedPanelId: true, audioUrl: true, audioDuration: true },
      },
    },
  })

  if (!episode) {
    throw new Error(`Episode not found: ${episodeId}`)
  }

  // 构建面板 → 配音映射
  const voiceByPanel = new Map<string, { content: string; speaker: string; audioUrl: string | null; audioDuration: number | null }>()
  for (const vl of episode.voiceLines) {
    if (vl.matchedPanelId) {
      voiceByPanel.set(vl.matchedPanelId, { content: vl.content, speaker: vl.speaker, audioUrl: vl.audioUrl, audioDuration: vl.audioDuration })
    }
  }

  // 按 clipIndex + panelIndex 排序收集视频
  interface VideoInfo {
    videoKey: string
    panelId: string
    shotType: string | null
    linkedToNextPanel: boolean
    subtitle: string | null
    speaker: string | null
    voiceAudioUrl: string | null
    voiceAudioDuration: number | null
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
        const voice = voiceByPanel.get(panel.id)
        videos.push({
          videoKey,
          panelId: panel.id,
          shotType: panel.shotType,
          linkedToNextPanel: panel.linkedToNextPanel,
          subtitle: voice?.content || panel.srtSegment || null,
          speaker: voice?.speaker || null,
          voiceAudioUrl: voice?.audioUrl || null,
          voiceAudioDuration: voice?.audioDuration ? voice.audioDuration / 1000 : null, // ms → sec
        })
      }
    }
  }

  // 使用 clipIndex 排序（保留插入顺序）
  // videos 已按 storyboard.createdAt + panelIndex 排序

  if (videos.length === 0) {
    throw new Error('No videos found to merge')
  }

  logInfo(`[video-merge] ${videos.length} 个片段, transition=${transition}, subtitles=${enableSubtitles}, bgm=${!!bgmUrl}`)

  // 创建临时目录
  const tmpDir = path.join(os.tmpdir(), `merge-${job.data.taskId}`)
  await fs.mkdir(tmpDir, { recursive: true })

  try {
    // 下载所有视频到本地
    await reportTaskProgress(job, 10, {
      stage: 'video_merge_download',
      stageLabel: '下载视频片段',
      displayMode: 'detail',
    })

    const localFiles: string[] = []
    for (let i = 0; i < videos.length; i++) {
      const progress = 10 + Math.floor((i / videos.length) * 40)
      await reportTaskProgress(job, progress, {
        stage: 'video_merge_download',
        stageLabel: `下载视频 ${i + 1}/${videos.length}`,
        displayMode: 'detail',
      })

      const video = videos[i]
      const localPath = path.join(tmpDir, `clip_${String(i).padStart(3, '0')}.mp4`)

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
    }

    if (localFiles.length === 0) {
      throw new Error('All video downloads failed')
    }

    // 下载 BGM（如果有）
    let bgmLocalPath: string | undefined
    if (bgmUrl) {
      await reportTaskProgress(job, 52, {
        stage: 'video_merge_bgm',
        stageLabel: '下载背景音乐',
        displayMode: 'detail',
      })

      try {
        let bgmFetchUrl = bgmUrl
        if (!bgmUrl.startsWith('http')) {
          bgmFetchUrl = toFetchableUrl(getSignedUrl(bgmUrl, 3600))
        }
        const bgmRes = await fetch(bgmFetchUrl)
        if (bgmRes.ok) {
          bgmLocalPath = path.join(tmpDir, 'bgm.mp3')
          await fs.writeFile(bgmLocalPath, Buffer.from(await bgmRes.arrayBuffer()))
          logInfo(`[video-merge] BGM 下载完成`)
        }
      } catch (err) {
        logError(`[video-merge] BGM 下载失败, 跳过:`, err)
      }
    }

    // 下载配音音频 + 构建 clipSync
    const enableSync = payload?.audioSync !== false // 默认开启
    let clipSync: ClipSyncInfo[] | undefined
    if (enableSync) {
      await reportTaskProgress(job, 53, {
        stage: 'video_merge_sync',
        stageLabel: '下载配音音频',
        displayMode: 'detail',
      })

      clipSync = []
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i]
        if (video.voiceAudioUrl && video.voiceAudioDuration) {
          try {
            let audioFetchUrl = video.voiceAudioUrl
            if (!audioFetchUrl.startsWith('http')) {
              audioFetchUrl = toFetchableUrl(getSignedUrl(audioFetchUrl, 3600))
            }
            const audioRes = await fetch(audioFetchUrl)
            if (audioRes.ok) {
              const audioPath = path.join(tmpDir, `voice_${String(i).padStart(3, '0')}.mp3`)
              await fs.writeFile(audioPath, Buffer.from(await audioRes.arrayBuffer()))
              clipSync.push({
                voiceAudioFile: audioPath,
                audioDuration: video.voiceAudioDuration,
              })
              continue
            }
          } catch {
            logError(`[video-merge] 配音音频下载失败: panel ${video.panelId}`)
          }
        }
        // 无配音：设置最大静音时长（压缩过长片段）
        clipSync.push({ maxSilentDuration: 4.0 })
      }

      const syncCount = clipSync.filter(s => s.voiceAudioFile).length
      logInfo(`[video-merge] 音画同步: ${syncCount}/${videos.length} 个片段有配音`)
    }

    // 构建字幕信息
    let subtitleEntries: SubtitleEntry[] | undefined
    if (enableSubtitles) {
      const durations = await Promise.all(localFiles.map(getVideoDuration))
      let currentTime = 0
      subtitleEntries = []

      for (let i = 0; i < localFiles.length; i++) {
        const video = videos[i]
        const dur = durations[i] || 0
        if (video.subtitle && dur > 0) {
          subtitleEntries.push({
            startSec: currentTime + 0.2, // 稍微延后避免切口
            endSec: currentTime + dur - 0.1,
            text: video.subtitle,
            speaker: video.speaker || undefined,
          })
        }
        currentTime += dur
      }

      logInfo(`[video-merge] 生成 ${subtitleEntries.length} 条字幕`)
    }

    // 构建转场元数据
    const panelTransitions: PanelTransitionInfo[] = videos.map(v => ({
      shotType: v.shotType,
      linkedToNextPanel: v.linkedToNextPanel,
    }))

    // FFmpeg 拼接 + 后处理
    await reportTaskProgress(job, 55, {
      stage: 'video_merge_concat',
      stageLabel: 'FFmpeg 合成中',
      displayMode: 'detail',
    })

    const outputPath = path.join(tmpDir, 'merged_output.mp4')
    await concatVideosWithFFmpeg({
      inputFiles: localFiles,
      outputFile: outputPath,
      transition,
      transitionDuration: 0.5,
      subtitles: subtitleEntries,
      bgmFile: bgmLocalPath,
      bgmVolume,
      panelTransitions,
      clipSync,
    })

    logInfo(`[video-merge] FFmpeg 合成完成`)

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
      subtitleCount: subtitleEntries?.length || 0,
      hasBgm: !!bgmLocalPath,
      transition,
      fileSizeMB: (outputBuffer.length / 1024 / 1024).toFixed(1),
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
