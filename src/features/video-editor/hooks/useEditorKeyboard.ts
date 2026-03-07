'use client'

import { useEffect, useCallback } from 'react'

interface KeyboardActions {
    playPause: () => void
    undo: () => void
    redo: () => void
    deleteSelected: () => void
    splitAtPlayhead: () => void
    escape: () => void
    nudgeLeft: () => void
    nudgeRight: () => void
}

/**
 * 编辑器键盘快捷键
 * Space=播放/暂停, Delete=删除, Ctrl+Z=撤销, Ctrl+Shift+Z=重做
 * S=分割, ←→=逐帧, Escape=取消选择
 */
export function useEditorKeyboard(actions: KeyboardActions) {
    const handler = useCallback((e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

        const ctrl = e.metaKey || e.ctrlKey

        switch (true) {
            case e.key === ' ':
                e.preventDefault()
                actions.playPause()
                break
            case e.key === 'Delete' || e.key === 'Backspace':
                e.preventDefault()
                actions.deleteSelected()
                break
            case ctrl && e.key === 'z' && !e.shiftKey:
                e.preventDefault()
                actions.undo()
                break
            case ctrl && (e.key === 'Z' || (e.key === 'z' && e.shiftKey)):
            case ctrl && e.key === 'y':
                e.preventDefault()
                actions.redo()
                break
            case e.key === 's' || e.key === 'S':
                if (!ctrl) {
                    actions.splitAtPlayhead()
                }
                break
            case e.key === 'ArrowLeft':
                e.preventDefault()
                actions.nudgeLeft()
                break
            case e.key === 'ArrowRight':
                e.preventDefault()
                actions.nudgeRight()
                break
            case e.key === 'Escape':
                actions.escape()
                break
        }
    }, [actions])

    useEffect(() => {
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [handler])
}
