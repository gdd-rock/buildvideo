'use client'

import { VideoEditorStage } from '@/features/video-editor'
import { createProjectFromPanels } from '@/features/video-editor/hooks/useEditorActions'
import { useWorkspaceStageRuntime } from '../WorkspaceStageRuntimeContext'
import { useWorkspaceEpisodeStageData } from '../hooks/useWorkspaceEpisodeStageData'
import { useWorkspaceProvider } from '../WorkspaceProvider'
import { useMemo } from 'react'

export default function EditorStageRoute() {
  const runtime = useWorkspaceStageRuntime()
  const { projectId, episodeId } = useWorkspaceProvider()
  const { storyboards } = useWorkspaceEpisodeStageData()

  const initialProject = useMemo(() => {
    const panels = storyboards.flatMap((sb) =>
      (sb.panels || [])
        .filter((p) => p.videoUrl)
        .map((p) => {
          // 将视频 URL 通过同源代理，避免 Remotion 跨域问题
          const rawUrl = p.videoUrl ?? ''
          const proxiedUrl = `/api/novel-promotion/${projectId}/video-proxy?key=${encodeURIComponent(rawUrl)}`
          return {
            id: p.id,
            panelIndex: p.panelIndex,
            storyboardId: sb.id,
            videoUrl: proxiedUrl,
            description: p.description ?? undefined,
            duration: p.duration ?? undefined,
          }
        }),
    )
    if (panels.length === 0) return undefined
    return createProjectFromPanels(episodeId || '', panels)
  }, [storyboards, episodeId, projectId])

  if (!episodeId) return null

  return (
    <VideoEditorStage
      projectId={projectId}
      episodeId={episodeId}
      initialProject={initialProject}
      onBack={() => runtime.onStageChange('videos')}
    />
  )
}
