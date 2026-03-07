'use client'

import { useReducer, useCallback } from 'react'

interface UndoRedoState<T> {
    past: T[]
    present: T
    future: T[]
}

type UndoRedoAction<T> =
    | { type: 'PUSH'; state: T }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESET'; state: T }

const MAX_HISTORY = 50

function undoRedoReducer<T>(state: UndoRedoState<T>, action: UndoRedoAction<T>): UndoRedoState<T> {
    switch (action.type) {
        case 'PUSH':
            return {
                past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
                present: action.state,
                future: []
            }
        case 'UNDO': {
            if (state.past.length === 0) return state
            const previous = state.past[state.past.length - 1]
            return {
                past: state.past.slice(0, -1),
                present: previous,
                future: [state.present, ...state.future]
            }
        }
        case 'REDO': {
            if (state.future.length === 0) return state
            const next = state.future[0]
            return {
                past: [...state.past, state.present],
                present: next,
                future: state.future.slice(1)
            }
        }
        case 'RESET':
            return { past: [], present: action.state, future: [] }
        default:
            return state
    }
}

export function useUndoRedo<T>(initialState: T) {
    const [state, dispatch] = useReducer(undoRedoReducer<T>, {
        past: [],
        present: initialState,
        future: []
    })

    const pushState = useCallback((newState: T) => {
        dispatch({ type: 'PUSH', state: newState })
    }, [])

    const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
    const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
    const reset = useCallback((s: T) => dispatch({ type: 'RESET', state: s }), [])

    return {
        state: state.present,
        pushState,
        undo,
        redo,
        reset,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0
    }
}
