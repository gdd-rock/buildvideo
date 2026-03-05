'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { logError, logInfo } from '@/lib/logging/core'

type MergeStatus = 'idle' | 'merging' | 'done' | 'error'

interface UseVideoMergeParams {
  projectId: string
  episodeId: string
  t: (key: string) => string
  videosWithUrl: number
  panelVideoPreference: Map<string, boolean>
  allPanels: Array<{ storyboardId: string; panelIndex: number }>
}

export function useVideoMerge({
  projectId,
  episodeId,
  t,
  videosWithUrl,
  panelVideoPreference,
  allPanels,
}: UseVideoMergeParams) {
  const [mergeStatus, setMergeStatus] = useState<MergeStatus>('idle')
  const [mergeProgress, setMergeProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const pollTaskStatus = useCallback((taskId: string) => {
    stopPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/novel-promotion/${projectId}/merge-video?taskId=${encodeURIComponent(taskId)}`,
        )
        if (!res.ok) {
          throw new Error(`Status check failed: ${res.status}`)
        }
        const data = await res.json()

        setMergeProgress(data.progress || 0)

        if (data.status === 'completed') {
          stopPolling()
          setMergeStatus('done')
          setDownloadUrl(data.downloadUrl || null)
          logInfo('[video-merge] 合成完成')
        } else if (data.status === 'failed') {
          stopPolling()
          setMergeStatus('error')
          setErrorMessage(data.errorMessage || t('stage.mergeFailed'))
          logError('[video-merge] 合成失败:', data.errorMessage)
        }
      } catch (error) {
        logError('[video-merge] 轮询失败:', error)
      }
    }, 3000)
  }, [projectId, stopPolling, t])

  const handleMerge = useCallback(async () => {
    if (videosWithUrl === 0) return

    setMergeStatus('merging')
    setMergeProgress(0)
    setDownloadUrl(null)
    setErrorMessage(null)

    try {
      // 构建偏好数据
      const panelPreferences: Record<string, boolean> = {}
      allPanels.forEach(panel => {
        const panelKey = `${panel.storyboardId}-${panel.panelIndex}`
        panelPreferences[panelKey] = panelVideoPreference.get(panelKey) ?? true
      })

      const res = await fetch(`/api/novel-promotion/${projectId}/merge-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          transition: 'none',
          panelPreferences,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message || `Request failed: ${res.status}`)
      }

      const data = await res.json()
      logInfo(`[video-merge] 任务已提交: ${data.taskId}`)

      // 开始轮询状态
      pollTaskStatus(data.taskId)
    } catch (error) {
      logError('[video-merge] 提交失败:', error)
      setMergeStatus('error')
      setErrorMessage(error instanceof Error ? error.message : t('stage.mergeFailed'))
    }
  }, [
    allPanels,
    episodeId,
    panelVideoPreference,
    pollTaskStatus,
    projectId,
    t,
    videosWithUrl,
  ])

  const handleDownloadMerged = useCallback(() => {
    if (!downloadUrl) return
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = 'merged_video.mp4'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }, [downloadUrl])

  const resetMerge = useCallback(() => {
    stopPolling()
    setMergeStatus('idle')
    setMergeProgress(0)
    setDownloadUrl(null)
    setErrorMessage(null)
  }, [stopPolling])

  return {
    mergeStatus,
    mergeProgress,
    downloadUrl,
    errorMessage,
    handleMerge,
    handleDownloadMerged,
    resetMerge,
  }
}
