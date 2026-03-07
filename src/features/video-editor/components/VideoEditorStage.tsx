'use client'
import { logError as _ulogError } from '@/lib/logging/core'
import { useTranslations } from 'next-intl'

import React, { useState, useCallback, useMemo } from 'react'
import { AppIcon } from '@/components/ui/icons'
import { useEditorState } from '../hooks/useEditorState'
import { useEditorActions } from '../hooks/useEditorActions'
import { useEditorKeyboard } from '../hooks/useEditorKeyboard'
import { VideoEditorProject } from '../types/editor.types'
import { calculateTimelineDuration, framesToTime } from '../utils/time-utils'
import { applyAutoTransitions } from '../utils/ai-transitions'
import { RemotionPreview } from './Preview'
import { Timeline } from './Timeline'
import { TransitionPicker, TransitionType } from './TransitionPicker'
import { AiCommandBar } from './AiCommandBar'

interface VideoEditorStageProps {
    projectId: string
    episodeId: string
    initialProject?: VideoEditorProject
    onBack?: () => void
}

/**
 * 视频编辑器主页面 (CapCut 风格布局)
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │ Toolbar (返回 | 撤销重做 | AI工具 | 保存 | 导出)          │
 * ├────────────────────────────────┬─────────────────────────┤
 * │                                │                         │
 * │    Preview (Remotion Player)   │   Properties Panel      │
 * │    + 播放控制                   │   (可折叠, 280px)       │
 * │                                │                         │
 * ├────────────────────────────────┴─────────────────────────┤
 * │ AI指令栏 (可选显示)                                       │
 * ├──────────────────────────────────────────────────────────┤
 * │ Timeline (工具栏 + 标尺 + 缩略图轨道 + 播放头)            │
 * └──────────────────────────────────────────────────────────┘
 */
export function VideoEditorStage({
    projectId,
    episodeId,
    initialProject,
    onBack
}: VideoEditorStageProps) {
    const t = useTranslations('video')
    const editor = useEditorState({ episodeId, initialProject })
    const { saveProject, startRender } = useEditorActions({ projectId, episodeId })

    const [showAiBar, setShowAiBar] = useState(false)
    const [showProperties, setShowProperties] = useState(true)

    const totalDuration = calculateTimelineDuration(editor.project.timeline)
    const totalTime = framesToTime(totalDuration, editor.project.config.fps)
    const currentTime = framesToTime(editor.timelineState.currentFrame, editor.project.config.fps)

    // 保存
    const handleSave = async () => {
        try {
            await saveProject(editor.project)
            editor.markSaved()
            alert(t('editor.alert.saveSuccess'))
        } catch (error) {
            _ulogError('Save failed:', error)
            alert(t('editor.alert.saveFailed'))
        }
    }

    // 导出
    const handleExport = async () => {
        try {
            await startRender(editor.project.id)
            alert(t('editor.alert.exportStarted'))
        } catch (error) {
            _ulogError('Export failed:', error)
            alert(t('editor.alert.exportFailed'))
        }
    }

    // 智能转场
    const handleAutoTransitions = useCallback(() => {
        const transitions = applyAutoTransitions(editor.project.timeline)
        transitions.forEach((tr, i) => {
            const clip = editor.project.timeline[i]
            if (clip && tr) {
                editor.updateClip(clip.id, { transition: tr })
            }
        })
    }, [editor])

    // AI 指令结果
    const handleAiApply = useCallback((newTimeline: typeof editor.project.timeline) => {
        // 通过逐个更新实现（保持在undo历史中）
        newTimeline.forEach((clip, i) => {
            const original = editor.project.timeline[i]
            if (original) {
                editor.updateClip(original.id, clip)
            }
        })
    }, [editor])

    // 键盘快捷键
    const keyboardActions = useMemo(() => ({
        playPause: editor.togglePlay,
        undo: editor.undo,
        redo: editor.redo,
        deleteSelected: () => {
            if (editor.selectedClip) {
                editor.removeClip(editor.selectedClip.id)
                editor.selectClip(null)
            }
        },
        splitAtPlayhead: () => editor.splitClipAtFrame(editor.timelineState.currentFrame),
        escape: () => {
            editor.selectClip(null)
            setShowAiBar(false)
        },
        nudgeLeft: () => editor.seek(editor.timelineState.currentFrame - 1),
        nudgeRight: () => editor.seek(editor.timelineState.currentFrame + 1),
    }), [editor])

    useEditorKeyboard(keyboardActions)

    return (
        <div className="video-editor-stage" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            background: 'var(--glass-bg-canvas)',
            color: 'var(--glass-text-primary)'
        }}>
            {/* ═══════ Toolbar ═══════ */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderBottom: '1px solid var(--glass-stroke-base)',
                background: 'var(--glass-bg-surface)',
                fontSize: '13px'
            }}>
                <button onClick={onBack} className="glass-btn-base glass-btn-secondary px-3 py-1.5 text-xs">
                    {t('editor.toolbar.back')}
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--glass-stroke-base)' }} />

                {/* 撤销/重做 */}
                <button
                    onClick={editor.undo}
                    disabled={!editor.canUndo}
                    title={`${t('editor.undo')} (Ctrl+Z)`}
                    className="glass-btn-base glass-btn-ghost px-2 py-1.5"
                    style={{ opacity: editor.canUndo ? 1 : 0.3 }}
                >
                    <AppIcon name="undo" className="w-4 h-4" />
                </button>
                <button
                    onClick={editor.redo}
                    disabled={!editor.canRedo}
                    title={`${t('editor.redo')} (Ctrl+Shift+Z)`}
                    className="glass-btn-base glass-btn-ghost px-2 py-1.5"
                    style={{ opacity: editor.canRedo ? 1 : 0.3, transform: 'scaleX(-1)' }}
                >
                    <AppIcon name="undo" className="w-4 h-4" />
                </button>

                <div style={{ width: '1px', height: '20px', background: 'var(--glass-stroke-base)' }} />

                {/* AI 工具 */}
                <button
                    onClick={handleAutoTransitions}
                    className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs"
                    title={t('editor.ai.autoTransitions')}
                >
                    <AppIcon name="sparkles" className="w-3.5 h-3.5 mr-1" />
                    {t('editor.ai.autoTransitions')}
                </button>
                <button
                    onClick={() => setShowAiBar(!showAiBar)}
                    className="glass-btn-base glass-btn-ghost px-3 py-1.5 text-xs"
                    title={t('editor.ai.aiCommand')}
                >
                    <AppIcon name="sparklesAlt" className="w-3.5 h-3.5 mr-1" />
                    {t('editor.ai.aiCommand')}
                </button>

                <div style={{ flex: 1 }} />

                {/* 时间 */}
                <span style={{ color: 'var(--glass-text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>
                    {currentTime} / {totalTime}
                </span>

                {/* 保存/导出 */}
                <button
                    onClick={handleSave}
                    className={`glass-btn-base px-3 py-1.5 text-xs ${editor.isDirty ? 'glass-btn-primary text-white' : 'glass-btn-secondary'}`}
                >
                    {editor.isDirty ? t('editor.toolbar.saveDirty') : t('editor.toolbar.saved')}
                </button>
                <button onClick={handleExport} className="glass-btn-base glass-btn-tone-success px-3 py-1.5 text-xs">
                    {t('editor.toolbar.export')}
                </button>
            </div>

            {/* ═══════ Main Content (Preview + Properties) ═══════ */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Preview + Controls */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Preview Area */}
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--glass-bg-muted)',
                            padding: '12px',
                            cursor: 'pointer',
                            position: 'relative'
                        }}
                        onClick={() => editor.togglePlay()}
                    >
                        <RemotionPreview
                            project={editor.project}
                            currentFrame={editor.timelineState.currentFrame}
                            playing={editor.timelineState.playing}
                            onFrameChange={editor.seek}
                            onPlayingChange={(playing) => playing ? editor.play() : editor.pause()}
                        />
                    </div>

                    {/* Playback Controls */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        padding: '8px',
                        background: 'var(--glass-bg-surface-strong)',
                        borderTop: '1px solid var(--glass-stroke-base)'
                    }}>
                        <button onClick={() => editor.seek(0)} className="glass-btn-base glass-btn-ghost px-2 py-1">
                            <AppIcon name="chevronLeft" className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => editor.togglePlay()}
                            style={{
                                background: 'var(--glass-accent-from)',
                                border: 'none',
                                color: 'var(--glass-text-on-accent)',
                                cursor: 'pointer',
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {editor.timelineState.playing
                                ? <AppIcon name="pause" className="w-4 h-4" />
                                : <AppIcon name="play" className="w-4 h-4" />}
                        </button>
                        <button onClick={() => editor.seek(totalDuration)} className="glass-btn-base glass-btn-ghost px-2 py-1">
                            <AppIcon name="chevronRight" className="w-4 h-4" />
                        </button>

                        {/* 变速 */}
                        {editor.selectedClip && (
                            <>
                                <div style={{ width: '1px', height: '20px', background: 'var(--glass-stroke-base)' }} />
                                <span style={{ fontSize: '11px', color: 'var(--glass-text-tertiary)' }}>
                                    {t('editor.speed')}
                                </span>
                                <select
                                    value={editor.selectedClip.speed || 1}
                                    onChange={(e) => editor.updateClip(editor.selectedClip!.id, { speed: parseFloat(e.target.value) })}
                                    style={{
                                        background: 'var(--glass-bg-muted)',
                                        border: '1px solid var(--glass-stroke-base)',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        fontSize: '11px',
                                        color: 'var(--glass-text-primary)'
                                    }}
                                >
                                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map(s => (
                                        <option key={s} value={s}>{s}x</option>
                                    ))}
                                </select>
                            </>
                        )}
                    </div>
                </div>

                {/* Properties Panel */}
                {showProperties && (
                    <div style={{
                        width: '260px',
                        borderLeft: '1px solid var(--glass-stroke-base)',
                        padding: '12px',
                        background: 'var(--glass-bg-surface-strong)',
                        overflowY: 'auto',
                        fontSize: '12px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '13px', color: 'var(--glass-text-secondary)' }}>
                                {t('editor.right.title')}
                            </h3>
                            <button
                                onClick={() => setShowProperties(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--glass-text-tertiary)', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        {editor.selectedClip ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {/* 片段信息 */}
                                <div>
                                    <p style={{ margin: '0 0 4px 0' }}>
                                        <span style={{ color: 'var(--glass-text-secondary)' }}>{t('editor.right.clipLabel')}</span>{' '}
                                        {editor.selectedClip.metadata?.description || t('editor.right.clipFallback', { index: editor.project.timeline.findIndex(c => c.id === editor.selectedClip!.id) + 1 })}
                                    </p>
                                    <p style={{ margin: '0 0 4px 0' }}>
                                        <span style={{ color: 'var(--glass-text-secondary)' }}>{t('editor.right.durationLabel')}</span>{' '}
                                        {framesToTime(editor.selectedClip.durationInFrames, editor.project.config.fps)}
                                    </p>
                                    {editor.selectedClip.speed && editor.selectedClip.speed !== 1 && (
                                        <p style={{ margin: '0 0 4px 0' }}>
                                            <span style={{ color: 'var(--glass-text-secondary)' }}>{t('editor.speed')}:</span>{' '}
                                            {editor.selectedClip.speed}x
                                        </p>
                                    )}
                                </div>

                                {/* 转场设置 */}
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--glass-text-secondary)' }}>
                                        {t('editor.right.transitionLabel')}
                                    </h4>
                                    <TransitionPicker
                                        value={(editor.selectedClip.transition?.type as TransitionType) || 'none'}
                                        duration={editor.selectedClip.transition?.durationInFrames || 15}
                                        onChange={(type, duration) => {
                                            editor.updateClip(editor.selectedClip!.id, {
                                                transition: type === 'none' ? undefined : { type, durationInFrames: duration }
                                            })
                                        }}
                                    />
                                </div>

                                {/* 删除 */}
                                <button
                                    onClick={() => {
                                        if (confirm(t('editor.right.deleteConfirm'))) {
                                            editor.removeClip(editor.selectedClip!.id)
                                            editor.selectClip(null)
                                        }
                                    }}
                                    className="glass-btn-base glass-btn-tone-danger px-3 py-1.5 text-xs"
                                >
                                    {t('editor.right.deleteClip')}
                                </button>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--glass-text-tertiary)' }}>
                                {t('editor.right.selectClipHint')}
                            </p>
                        )}
                    </div>
                )}

                {/* 属性面板折叠时的展开按钮 */}
                {!showProperties && (
                    <button
                        onClick={() => setShowProperties(true)}
                        style={{
                            position: 'absolute',
                            right: '8px',
                            top: '60px',
                            background: 'var(--glass-bg-surface)',
                            border: '1px solid var(--glass-stroke-base)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            color: 'var(--glass-text-secondary)',
                            fontSize: '11px',
                            zIndex: 10
                        }}
                    >
                        {t('editor.right.title')} →
                    </button>
                )}
            </div>

            {/* ═══════ AI Command Bar ═══════ */}
            <AiCommandBar
                visible={showAiBar}
                onClose={() => setShowAiBar(false)}
                onApply={handleAiApply}
                currentTimeline={editor.project.timeline}
                fps={editor.project.config.fps}
            />

            {/* ═══════ Timeline ═══════ */}
            <div style={{
                height: '260px',
                borderTop: '1px solid var(--glass-stroke-base)',
                flexShrink: 0
            }}>
                <Timeline
                    clips={editor.project.timeline}
                    timelineState={editor.timelineState}
                    config={editor.project.config}
                    onReorder={editor.reorderClips}
                    onSelectClip={editor.selectClip}
                    onZoomChange={editor.setZoom}
                    onSeek={editor.seek}
                    onScrollXChange={editor.setScrollX}
                    onToolChange={editor.setTool}
                    onTrimClip={editor.trimClip}
                    onSplitAtFrame={editor.splitClipAtFrame}
                />
            </div>
        </div>
    )
}

export default VideoEditorStage
