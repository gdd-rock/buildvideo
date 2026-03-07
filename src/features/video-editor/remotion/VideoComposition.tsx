import React, { useState } from 'react'
import { AbsoluteFill, Sequence, Video, Audio, useCurrentFrame, interpolate } from 'remotion'
import { VideoClip, BgmClip, EditorConfig } from '../types/editor.types'
import { computeClipPositions } from '../utils/time-utils'

interface VideoCompositionProps {
    clips: VideoClip[]
    bgmTrack: BgmClip[]
    config: EditorConfig
}

/**
 * Remotion 主合成组件
 * 使用 Sequence 实现磁性时间轴布局，支持转场效果和变速
 */
export const VideoComposition: React.FC<VideoCompositionProps> = ({
    clips,
    bgmTrack,
    config
}) => {
    const computedClips = computeClipPositions(clips)

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {/* 视频轨道 */}
            {computedClips.map((clip, index) => {
                const transitionDuration = clip.transition?.durationInFrames || 0

                return (
                    <Sequence
                        key={clip.id}
                        from={clip.startFrame}
                        durationInFrames={clip.durationInFrames}
                        name={`Clip ${index + 1}`}
                    >
                        <ClipRenderer
                            clip={clip}
                            config={config}
                            transitionType={clip.transition?.type}
                            transitionDuration={transitionDuration}
                            isLastClip={index === computedClips.length - 1}
                        />
                    </Sequence>
                )
            })}

            {/* BGM 轨道 */}
            {bgmTrack.map((bgm) => (
                <Sequence
                    key={bgm.id}
                    from={bgm.startFrame}
                    durationInFrames={bgm.durationInFrames}
                    name={`BGM: ${bgm.id}`}
                >
                    <BgmRenderer bgm={bgm} />
                </Sequence>
            ))}
        </AbsoluteFill>
    )
}

/**
 * BGM 渲染器 - 支持淡入淡出
 */
const BgmRenderer: React.FC<{ bgm: BgmClip }> = ({ bgm }) => {
    const frame = useCurrentFrame()
    const fadeIn = bgm.fadeIn || 0
    const fadeOut = bgm.fadeOut || 0

    let volume = bgm.volume

    if (fadeIn > 0 && frame < fadeIn) {
        volume *= interpolate(frame, [0, fadeIn], [0, 1], { extrapolateRight: 'clamp' })
    }

    if (fadeOut > 0 && frame > bgm.durationInFrames - fadeOut) {
        volume *= interpolate(
            frame,
            [bgm.durationInFrames - fadeOut, bgm.durationInFrames],
            [1, 0],
            { extrapolateLeft: 'clamp' }
        )
    }

    return <Audio src={bgm.src} volume={volume} />
}

/**
 * 单个片段渲染器 - 支持转场效果 + 变速
 */
interface ClipRendererProps {
    clip: VideoClip & { startFrame: number; endFrame: number }
    config: EditorConfig
    transitionType?: 'none' | 'dissolve' | 'fade' | 'slide'
    transitionDuration: number
    isLastClip: boolean
}

const ClipRenderer: React.FC<ClipRendererProps> = ({
    clip,
    transitionType = 'none',
    transitionDuration,
    isLastClip
}) => {
    const frame = useCurrentFrame()
    const clipDuration = clip.durationInFrames
    const [videoError, setVideoError] = useState(false)

    // 计算转场效果
    let opacity = 1
    let transform = 'none'

    if (transitionType !== 'none' && transitionDuration > 0) {
        // 出场转场效果
        if (!isLastClip && frame > clipDuration - transitionDuration) {
            const exitProgress = interpolate(
                frame,
                [clipDuration - transitionDuration, clipDuration],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )

            switch (transitionType) {
                case 'dissolve':
                case 'fade':
                    opacity = 1 - exitProgress
                    break
                case 'slide':
                    transform = `translateX(${-exitProgress * 100}%)`
                    break
            }
        }

        // 入场转场效果
        if (frame < transitionDuration) {
            const enterProgress = interpolate(
                frame,
                [0, transitionDuration],
                [0, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            )

            switch (transitionType) {
                case 'dissolve':
                case 'fade':
                    opacity = enterProgress
                    break
                case 'slide':
                    transform = `translateX(${(1 - enterProgress) * 100}%)`
                    break
            }
        }
    }

    return (
        <AbsoluteFill style={{ opacity, transform }}>
            {videoError ? (
                <AbsoluteFill style={{
                    backgroundColor: '#1a1a2e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        color: '#666',
                        fontSize: '16px',
                        textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠</div>
                        视频加载失败
                    </div>
                </AbsoluteFill>
            ) : (
                <Video
                    src={clip.src}
                    startFrom={clip.trim?.from || 0}
                    playbackRate={clip.speed || 1}
                    onError={() => setVideoError(true)}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                    }}
                />
            )}

            {clip.attachment?.audio && (
                <Audio
                    src={clip.attachment.audio.src}
                    volume={clip.attachment.audio.volume}
                />
            )}

            {clip.attachment?.subtitle && (
                <SubtitleOverlay
                    text={clip.attachment.subtitle.text}
                    style={clip.attachment.subtitle.style}
                    fontSize={clip.attachment.subtitle.fontSize}
                    position={clip.attachment.subtitle.position}
                    color={clip.attachment.subtitle.color}
                />
            )}
        </AbsoluteFill>
    )
}

/**
 * 字幕叠加层
 */
interface SubtitleOverlayProps {
    text: string
    style: 'default' | 'cinematic' | 'bold' | 'outline'
    fontSize?: number
    position?: 'bottom' | 'top' | 'center'
    color?: string
}

const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
    text,
    style,
    fontSize,
    position = 'bottom',
    color
}) => {
    const baseSize = fontSize || (style === 'cinematic' ? 28 : 24)
    const textColor = color || 'white'

    const styles: Record<string, React.CSSProperties> = {
        default: {
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 16px',
            borderRadius: '4px',
            fontSize: `${baseSize}px`,
            color: textColor
        },
        cinematic: {
            background: 'transparent',
            padding: '12px 24px',
            fontSize: `${baseSize}px`,
            color: textColor,
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
            fontWeight: 'bold' as const
        },
        bold: {
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '10px 20px',
            borderRadius: '6px',
            fontSize: `${baseSize}px`,
            color: textColor,
            fontWeight: 'bold' as const,
            letterSpacing: '1px'
        },
        outline: {
            background: 'transparent',
            padding: '8px 16px',
            fontSize: `${baseSize}px`,
            color: textColor,
            WebkitTextStroke: '1px rgba(0,0,0,0.8)',
            textShadow: '0 0 8px rgba(0,0,0,0.5)'
        }
    }

    const positionStyle: React.CSSProperties = {
        justifyContent: position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end',
        alignItems: 'center',
        paddingTop: position === 'top' ? '60px' : undefined,
        paddingBottom: position === 'bottom' ? '60px' : undefined
    }

    return (
        <AbsoluteFill style={positionStyle}>
            <div style={styles[style]}>
                {text}
            </div>
        </AbsoluteFill>
    )
}

export default VideoComposition
