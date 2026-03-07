// ========================================
// Video Editor Module - Public API
// ========================================

// Types
export type {
    VideoEditorProject,
    VideoClip,
    BgmClip,
    ClipAttachment,
    ClipTransition,
    ClipMetadata,
    EditorConfig,
    TimelineState,
    EditorTool,
    ComputedClip,
    SaveEditorProjectRequest,
    RenderRequest,
    RenderStatus
} from './types/editor.types'

// Utils
export {
    calculateTimelineDuration,
    computeClipPositions,
    framesToTime,
    timeToFrames,
    generateClipId,
    createDefaultProject
} from './utils/time-utils'

export {
    migrateProjectData,
    validateProjectData
} from './utils/migration'

export {
    autoSelectTransition,
    applyAutoTransitions
} from './utils/ai-transitions'

export type { AssemblyStyle } from './utils/ai-assembly'
export { autoAssembleTimeline } from './utils/ai-assembly'

// Components
export { VideoEditorStage } from './components/VideoEditorStage'
export { TransitionPicker } from './components/TransitionPicker'

// Hooks
export { useEditorState } from './hooks/useEditorState'
export { useEditorActions, createProjectFromPanels } from './hooks/useEditorActions'
export { useUndoRedo } from './hooks/useUndoRedo'
export { useEditorKeyboard } from './hooks/useEditorKeyboard'
export { useThumbnailStrip } from './hooks/useThumbnailStrip'
