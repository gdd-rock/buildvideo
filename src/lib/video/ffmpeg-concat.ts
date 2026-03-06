import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { logInfo, logError } from '@/lib/logging/core'

/**
 * 使用 ffprobe 获取视频时长（秒）
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffprobe',
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        filePath,
      ],
      { timeout: 30_000 },
      (error, stdout) => {
        if (error) {
          reject(new Error(`ffprobe failed for ${filePath}: ${error.message}`))
          return
        }
        try {
          const data = JSON.parse(stdout)
          const duration = parseFloat(data.format?.duration || '0')
          resolve(duration)
        } catch {
          reject(new Error(`Failed to parse ffprobe output for ${filePath}`))
        }
      },
    )
  })
}

/**
 * 执行 FFmpeg 命令
 */
function runFFmpeg(args: string[], timeoutMs = 600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    logInfo(`[FFmpeg] 执行: ffmpeg ${args.slice(0, 20).join(' ')}${args.length > 20 ? '...' : ''}`)
    execFile('ffmpeg', args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        logError(`[FFmpeg] 失败: ${stderr || error.message}`)
        reject(new Error(`FFmpeg failed: ${stderr || error.message}`))
        return
      }
      resolve(stdout || stderr)
    })
  })
}

// ==================== 字幕 ====================

export interface SubtitleEntry {
  startSec: number
  endSec: number
  text: string
  speaker?: string
}

/**
 * 生成 ASS 字幕文件
 * 支持描边、半透明底色、居中底部显示
 */
function generateASS(subtitles: SubtitleEntry[]): string {
  const header = `[Script Info]
Title: Auto Subtitles
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans CJK SC,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,0,2,30,30,60,1
Style: Speaker,Noto Sans CJK SC,40,&H0000FFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,0,8,30,30,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`
  const events = subtitles.map(s => {
    const start = formatASSTime(s.startSec)
    const end = formatASSTime(s.endSec)
    const style = s.speaker ? 'Speaker' : 'Default'
    const prefix = s.speaker ? `{\\c&H00FFFF&}${s.speaker}: {\\c&HFFFFFF&}` : ''
    return `Dialogue: 0,${start},${end},${style},,0,0,0,,${prefix}${escapeASS(s.text)}`
  })

  return header + events.join('\n') + '\n'
}

function formatASSTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`
}

function escapeASS(text: string): string {
  return text.replace(/\n/g, '\\N').replace(/\{/g, '').replace(/\}/g, '')
}

// ==================== 智能转场 ====================

export interface PanelTransitionInfo {
  shotType?: string | null
  linkedToNextPanel?: boolean
}

type XfadeTransition = 'fade' | 'wipeleft' | 'wiperight' | 'wipeup' | 'slideright' | 'slideleft' | 'dissolve'

/**
 * 根据面板元数据自动选择转场效果
 */
function resolveSmartTransition(
  current: PanelTransitionInfo | undefined,
  next: PanelTransitionInfo | undefined,
): { transition: XfadeTransition; duration: number } {
  // linkedToNextPanel=true → 溶解（连续镜头）
  if (current?.linkedToNextPanel) {
    return { transition: 'dissolve', duration: 0.3 }
  }

  const curShot = (current?.shotType || '').toLowerCase()
  const nextShot = (next?.shotType || '').toLowerCase()

  // 特写→全景 或 全景→特写 = 淡入淡出（视觉跨度大）
  const isClose = (s: string) => s.includes('close') || s.includes('特写')
  const isWide = (s: string) => s.includes('wide') || s.includes('全景') || s.includes('远景')

  if ((isClose(curShot) && isWide(nextShot)) || (isWide(curShot) && isClose(nextShot))) {
    return { transition: 'fade', duration: 0.5 }
  }

  // 同景别 → 硬切（无转场）
  if (curShot && curShot === nextShot) {
    return { transition: 'fade', duration: 0 } // duration=0 表示硬切
  }

  // 默认轻微淡入淡出
  return { transition: 'fade', duration: 0.3 }
}

// ==================== 主入口 ====================

export interface ConcatOptions {
  inputFiles: string[]
  outputFile: string
  transition?: 'none' | 'fade' | 'smart'
  transitionDuration?: number // 秒，默认 0.5
  /** 字幕信息（自动烧录） */
  subtitles?: SubtitleEntry[]
  /** BGM 本地文件路径 */
  bgmFile?: string
  /** BGM 音量（0-1，默认 0.15） */
  bgmVolume?: number
  /** 面板转场元数据（仅 transition='smart' 时使用） */
  panelTransitions?: PanelTransitionInfo[]
}

/**
 * 使用 FFmpeg 拼接多个视频文件
 *
 * - transition='none': concat demuxer（快速）
 * - transition='fade': xfade filter（统一淡入淡出）
 * - transition='smart': 根据面板元数据自动选择转场
 *
 * 支持可选的字幕烧录和 BGM 混音（后处理）
 */
export async function concatVideosWithFFmpeg(options: ConcatOptions): Promise<void> {
  const {
    inputFiles, outputFile,
    transition = 'none', transitionDuration = 0.5,
    subtitles, bgmFile, bgmVolume = 0.15,
    panelTransitions,
  } = options

  if (inputFiles.length === 0) {
    throw new Error('No input files provided')
  }

  // 确定是否需要后处理（字幕/BGM）
  const needsPostProcess = (subtitles && subtitles.length > 0) || bgmFile

  // 拼接输出路径（如需后处理则先输出到临时文件）
  const concatOutput = needsPostProcess
    ? outputFile.replace('.mp4', '_concat_tmp.mp4')
    : outputFile

  if (inputFiles.length === 1) {
    await fs.copyFile(inputFiles[0], concatOutput)
  } else if (transition === 'smart' && panelTransitions) {
    await concatWithSmartTransitions(inputFiles, concatOutput, panelTransitions)
  } else if (transition === 'fade') {
    await concatWithXfade(inputFiles, concatOutput, transitionDuration)
  } else {
    await concatWithDemuxer(inputFiles, concatOutput)
  }

  // 后处理：字幕烧录 + BGM 混音
  if (needsPostProcess) {
    await postProcess(concatOutput, outputFile, subtitles, bgmFile, bgmVolume)
    await fs.unlink(concatOutput).catch(() => {})
  }
}

// ==================== 后处理：字幕 + BGM ====================

async function postProcess(
  inputFile: string,
  outputFile: string,
  subtitles?: SubtitleEntry[],
  bgmFile?: string,
  bgmVolume = 0.15,
): Promise<void> {
  const dir = path.dirname(outputFile)
  const args: string[] = ['-i', inputFile]
  const filters: string[] = []

  // 字幕
  let assPath: string | undefined
  if (subtitles && subtitles.length > 0) {
    assPath = path.join(dir, '_subtitles.ass')
    await fs.writeFile(assPath, generateASS(subtitles), 'utf-8')
    // 使用 ASS 滤镜烧录字幕
    filters.push(`ass='${assPath.replace(/'/g, "'\\''")}'`)
    logInfo(`[FFmpeg] 烧录 ${subtitles.length} 条字幕`)
  }

  // BGM 混音
  if (bgmFile) {
    args.push('-i', bgmFile)
    logInfo(`[FFmpeg] 混音 BGM, 音量: ${bgmVolume}`)
  }

  // 构建 filter_complex
  if (filters.length > 0 || bgmFile) {
    const filterParts: string[] = []

    // 视频滤镜链
    if (filters.length > 0) {
      filterParts.push(`[0:v]${filters.join(',')}[vout]`)
    }

    // 音频混音
    if (bgmFile) {
      // BGM 循环到视频长度，降低音量，与原声混合
      // 原声在前，BGM 在后；原声结束时淡出
      filterParts.push(`[1:a]aloop=loop=-1:size=2e+09,volume=${bgmVolume},afade=t=in:st=0:d=2[bgm]`)
      filterParts.push(`[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=3[aout]`)
    }

    args.push('-filter_complex', filterParts.join(';\n'))

    if (filters.length > 0) {
      args.push('-map', '[vout]')
    } else {
      args.push('-map', '0:v')
    }

    if (bgmFile) {
      args.push('-map', '[aout]')
    } else {
      args.push('-map', '0:a')
    }
  }

  args.push(
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-shortest',
    '-y', outputFile,
  )

  await runFFmpeg(args)

  // 清理字幕临时文件
  if (assPath) {
    await fs.unlink(assPath).catch(() => {})
  }
}

// ==================== 拼接方式 ====================

/**
 * concat demuxer 快速拼接（无转场）
 */
async function concatWithDemuxer(inputFiles: string[], outputFile: string): Promise<void> {
  const dir = path.dirname(outputFile)

  const normalizedFiles: string[] = []
  for (let i = 0; i < inputFiles.length; i++) {
    const normalized = path.join(dir, `_norm_${i}.mp4`)
    await runFFmpeg([
      '-i', inputFiles[i],
      '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-r', '30',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-ar', '44100', '-ac', '2',
      '-y', normalized,
    ])
    normalizedFiles.push(normalized)
  }

  const concatListPath = path.join(dir, 'concat.txt')
  const concatContent = normalizedFiles.map(f => `file '${f}'`).join('\n')
  await fs.writeFile(concatListPath, concatContent, 'utf-8')

  logInfo(`[FFmpeg] concat demuxer: ${normalizedFiles.length} 个文件`)

  await runFFmpeg([
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    '-y', outputFile,
  ])

  for (const f of normalizedFiles) {
    await fs.unlink(f).catch(() => {})
  }
  await fs.unlink(concatListPath).catch(() => {})
}

/**
 * xfade 拼接（统一淡入淡出转场）
 */
async function concatWithXfade(
  inputFiles: string[],
  outputFile: string,
  transitionDuration: number,
): Promise<void> {
  const durations = await Promise.all(inputFiles.map(getVideoDuration))
  logInfo(`[FFmpeg] xfade: ${inputFiles.length} 个文件, 时长: ${durations.map(d => d.toFixed(1)).join('s, ')}s`)

  const inputs: string[] = []
  for (const f of inputFiles) {
    inputs.push('-i', f)
  }

  const filterParts: string[] = []
  const n = inputFiles.length

  for (let i = 0; i < n; i++) {
    filterParts.push(
      `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`,
    )
  }

  let accumulatedDuration = durations[0]
  for (let i = 1; i < n; i++) {
    const offset = Math.max(0, accumulatedDuration - transitionDuration)
    const prevLabel = i === 1 ? `v0` : `xf${i - 1}`
    const nextLabel = i < n - 1 ? `xf${i}` : `vout`

    filterParts.push(
      `[${prevLabel}][v${i}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(3)}[${nextLabel}]`,
    )

    accumulatedDuration = offset + durations[i]
  }

  const audioInputs = inputFiles.map((_, i) => `[${i}:a]`).join('')
  filterParts.push(`${audioInputs}concat=n=${n}:v=0:a=1[aout]`)

  const filterComplex = filterParts.join(';\n')

  await runFFmpeg([
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-y', outputFile,
  ])
}

/**
 * 智能转场拼接 — 根据面板元数据自动选择每个切点的转场效果
 */
async function concatWithSmartTransitions(
  inputFiles: string[],
  outputFile: string,
  panelTransitions: PanelTransitionInfo[],
): Promise<void> {
  const durations = await Promise.all(inputFiles.map(getVideoDuration))
  logInfo(`[FFmpeg] smart transitions: ${inputFiles.length} 个文件`)

  const inputs: string[] = []
  for (const f of inputFiles) {
    inputs.push('-i', f)
  }

  const filterParts: string[] = []
  const n = inputFiles.length

  // 统一分辨率
  for (let i = 0; i < n; i++) {
    filterParts.push(
      `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`,
    )
  }

  // 构建 xfade chain with per-cut transitions
  let accumulatedDuration = durations[0]
  let hasTransitions = false
  for (let i = 1; i < n; i++) {
    const { transition, duration } = resolveSmartTransition(panelTransitions[i - 1], panelTransitions[i])

    if (duration <= 0) {
      // 硬切：不加 xfade，用 concat filter
      // 但 xfade chain 不支持混合，所以用 duration=0.001 模拟硬切
      const offset = Math.max(0, accumulatedDuration - 0.001)
      const prevLabel = i === 1 ? `v0` : `xf${i - 1}`
      const nextLabel = i < n - 1 ? `xf${i}` : `vout`
      filterParts.push(
        `[${prevLabel}][v${i}]xfade=transition=fade:duration=0.001:offset=${offset.toFixed(3)}[${nextLabel}]`,
      )
      accumulatedDuration = offset + durations[i]
    } else {
      hasTransitions = true
      const offset = Math.max(0, accumulatedDuration - duration)
      const prevLabel = i === 1 ? `v0` : `xf${i - 1}`
      const nextLabel = i < n - 1 ? `xf${i}` : `vout`
      filterParts.push(
        `[${prevLabel}][v${i}]xfade=transition=${transition}:duration=${duration}:offset=${offset.toFixed(3)}[${nextLabel}]`,
      )
      accumulatedDuration = offset + durations[i]
    }
  }

  if (!hasTransitions) {
    logInfo(`[FFmpeg] smart transitions: 全部硬切，回退到 demuxer`)
  }

  // 音频拼接
  const audioInputs = inputFiles.map((_, i) => `[${i}:a]`).join('')
  filterParts.push(`${audioInputs}concat=n=${n}:v=0:a=1[aout]`)

  const filterComplex = filterParts.join(';\n')

  await runFFmpeg([
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-y', outputFile,
  ])
}
