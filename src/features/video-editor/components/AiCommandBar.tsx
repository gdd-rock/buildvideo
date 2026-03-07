'use client'

import React, { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { VideoClip } from '../types/editor.types'
import { generateClipId } from '../utils/time-utils'

interface AiCommandBarProps {
    visible: boolean
    onClose: () => void
    onApply: (newTimeline: VideoClip[]) => void
    currentTimeline: VideoClip[]
    fps: number
}

/**
 * AI 自然语言指令栏
 * 支持常用指令快速操作时间轴
 */
export const AiCommandBar: React.FC<AiCommandBarProps> = ({
    visible,
    onClose,
    onApply,
    currentTimeline,
    fps
}) => {
    const t = useTranslations('video')
    const [input, setInput] = useState('')
    const [feedback, setFeedback] = useState('')

    const execute = useCallback(() => {
        const cmd = input.trim().toLowerCase()
        if (!cmd) return

        const result = parseAndApplyCommand(cmd, currentTimeline, fps)
        if (result) {
            onApply(result)
            setFeedback('✓')
            setTimeout(() => { setFeedback(''); setInput('') }, 800)
        } else {
            setFeedback(t('editor.ai.unknownCommand'))
            setTimeout(() => setFeedback(''), 2000)
        }
    }, [input, currentTimeline, fps, onApply, t])

    if (!visible) return null

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--glass-bg-surface-strong)',
            borderTop: '1px solid var(--glass-stroke-base)',
        }}>
            <span style={{ fontSize: '14px' }}>⚡</span>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') execute()
                    if (e.key === 'Escape') onClose()
                }}
                placeholder={t('editor.ai.commandPlaceholder')}
                autoFocus
                style={{
                    flex: 1,
                    background: 'var(--glass-bg-muted)',
                    border: '1px solid var(--glass-stroke-base)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    color: 'var(--glass-text-primary)',
                    outline: 'none'
                }}
            />
            {feedback && (
                <span style={{ fontSize: '12px', color: 'var(--glass-text-secondary)' }}>
                    {feedback}
                </span>
            )}
            <button
                onClick={onClose}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--glass-text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '16px'
                }}
            >
                ✕
            </button>
        </div>
    )
}

/**
 * 解析自然语言指令并转换为时间轴操作
 */
function parseAndApplyCommand(
    command: string,
    timeline: VideoClip[],
    fps: number
): VideoClip[] | null {
    // 让节奏更快 / punchier / faster
    if (/更快|快一点|punchier|faster|quicker/i.test(command)) {
        return timeline.map(c => ({
            ...c,
            id: generateClipId(),
            durationInFrames: Math.max(fps, Math.round(c.durationInFrames * 0.7))
        }))
    }

    // 更慢 / 更有戏剧感 / dramatic
    if (/更慢|慢一点|戏剧|dramatic|slower|cinematic/i.test(command)) {
        return timeline.map(c => ({
            ...c,
            id: generateClipId(),
            durationInFrames: Math.round(c.durationInFrames * 1.3),
            transition: { type: 'dissolve' as const, durationInFrames: 30 }
        }))
    }

    // 删除X秒以下 / remove clips under Xs
    const shortMatch = command.match(/删除(\d+)秒以下|remove.*under.*(\d+)/i)
    if (shortMatch) {
        const threshold = parseInt(shortMatch[1] || shortMatch[2]) * fps
        const filtered = timeline.filter(c => c.durationInFrames >= threshold)
        if (filtered.length > 0) return filtered
    }

    // 统一时长 X秒 / set all to Xs
    const uniformMatch = command.match(/统一.*?(\d+)秒|all.*?(\d+)\s*s/i)
    if (uniformMatch) {
        const targetFrames = parseInt(uniformMatch[1] || uniformMatch[2]) * fps
        return timeline.map(c => ({
            ...c,
            id: generateClipId(),
            durationInFrames: targetFrames
        }))
    }

    // 去掉所有转场 / remove transitions
    if (/去掉.*转场|remove.*transition|no.*transition/i.test(command)) {
        return timeline.map(c => ({
            ...c,
            id: generateClipId(),
            transition: undefined
        }))
    }

    return null
}
