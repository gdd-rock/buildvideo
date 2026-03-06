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
  /** AI 剪辑决策覆盖：指定转场类型 */
  _transitionOverride?: string
  /** AI 剪辑决策覆盖：指定转场时长 */
  _transitionDuration?: number
}

type XfadeTransition = 'fade' | 'wipeleft' | 'wiperight' | 'wipeup' | 'slideright' | 'slideleft' | 'dissolve'

const VALID_XFADE: Set<string> = new Set(['fade', 'wipeleft', 'wiperight', 'wipeup', 'slideright', 'slideleft', 'dissolve', 'none'])

/**
 * 根据面板元数据自动选择转场效果（支持 AI 决策覆盖）
 */
function resolveSmartTransition(
  current: PanelTransitionInfo | undefined,
  next: PanelTransitionInfo | undefined,
): { transition: XfadeTransition; duration: number } {
  // AI 决策覆盖
  if (current?._transitionOverride && VALID_XFADE.has(current._transitionOverride)) {
    const override = current._transitionOverride
    if (override === 'none') return { transition: 'fade', duration: 0 }
    return {
      transition: override as XfadeTransition,
      duration: current._transitionDuration ?? 0.5,
    }
  }

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

// ==================== Ken Burns 运镜 ====================

export type KenBurnsType = 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'none'

export interface KenBurnsEffect {
  type: KenBurnsType
  /** 运镜强度 0-1，默认 0.5 */
  intensity?: number
}

/**
 * 根据面板 cameraMove 字段解析 Ken Burns 效果
 */
export function resolveKenBurns(cameraMove: string | null | undefined): KenBurnsEffect {
  const cm = (cameraMove || '').toLowerCase()
  if (cm.includes('推') || cm.includes('zoom in') || cm.includes('push in')) return { type: 'zoom_in' }
  if (cm.includes('拉') || cm.includes('zoom out') || cm.includes('pull')) return { type: 'zoom_out' }
  if (cm.includes('左移') || cm.includes('左摇') || cm.includes('pan left')) return { type: 'pan_left' }
  if (cm.includes('右移') || cm.includes('右摇') || cm.includes('pan right')) return { type: 'pan_right' }
  if (cm.includes('上移') || cm.includes('上摇') || cm.includes('tilt up')) return { type: 'tilt_up' }
  if (cm.includes('下移') || cm.includes('下摇') || cm.includes('tilt down')) return { type: 'tilt_down' }
  return { type: 'none' }
}

/**
 * 构建 Ken Burns FFmpeg 滤镜（应用于已归一化的 1920x1080 视频）
 * - zoom: 使用 zoompan 滤镜
 * - pan/tilt: 先放大再动态裁切
 */
function buildKenBurnsFilter(effect: KenBurnsEffect, videoDur: number): string | null {
  if (effect.type === 'none' || videoDur <= 0) return null

  const intensity = effect.intensity || 0.5
  const margin = 0.15 * intensity // 最大运镜幅度
  const totalFrames = Math.max(1, Math.round(videoDur * 30))
  const dur = videoDur.toFixed(2)

  switch (effect.type) {
    case 'zoom_in': {
      const inc = (margin / totalFrames).toFixed(6)
      const maxZ = (1 + margin).toFixed(4)
      return `zoompan=z='min(zoom+${inc},${maxZ})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30`
    }
    case 'zoom_out': {
      const inc = (margin / totalFrames).toFixed(6)
      const maxZ = (1 + margin).toFixed(4)
      return `zoompan=z='if(eq(on,0),${maxZ},max(zoom-${inc},1.0))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30`
    }
    case 'pan_left': {
      const sw = Math.round(1920 * (1 + margin))
      const sh = Math.round(1080 * (1 + margin))
      const px = sw - 1920
      const py = Math.round((sh - 1080) / 2)
      return `scale=${sw}:${sh},crop=1920:1080:'${px}*(1-t/${dur})':'${py}'`
    }
    case 'pan_right': {
      const sw = Math.round(1920 * (1 + margin))
      const sh = Math.round(1080 * (1 + margin))
      const px = sw - 1920
      const py = Math.round((sh - 1080) / 2)
      return `scale=${sw}:${sh},crop=1920:1080:'${px}*t/${dur}':'${py}'`
    }
    case 'tilt_up': {
      const sw = Math.round(1920 * (1 + margin))
      const sh = Math.round(1080 * (1 + margin))
      const px = Math.round((sw - 1920) / 2)
      const py = sh - 1080
      return `scale=${sw}:${sh},crop=1920:1080:'${px}':'${py}*(1-t/${dur})'`
    }
    case 'tilt_down': {
      const sw = Math.round(1920 * (1 + margin))
      const sh = Math.round(1080 * (1 + margin))
      const px = Math.round((sw - 1920) / 2)
      const py = sh - 1080
      return `scale=${sw}:${sh},crop=1920:1080:'${px}':'${py}*t/${dur}'`
    }
    default:
      return null
  }
}

// ==================== 标题卡 ====================

export interface TitleCard {
  /** 主标题文字 */
  text: string
  /** 副标题 / 描述 */
  subtext?: string
  /** 时长（秒），默认 2 */
  duration?: number
  /** 插入到第 N 个片段之前（0=片头） */
  insertBefore: number
}

/** CJK 字体搜索路径 */
const CJK_FONT_PATHS = [
  '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/System/Library/Fonts/PingFang.ttc',
]

let _cachedFontPath: string | null | undefined

async function findCJKFont(): Promise<string | null> {
  if (_cachedFontPath !== undefined) return _cachedFontPath
  for (const fp of CJK_FONT_PATHS) {
    try {
      await fs.access(fp)
      _cachedFontPath = fp
      return fp
    } catch { /* try next */ }
  }
  _cachedFontPath = null
  return null
}

/**
 * 生成标题卡视频（深色背景 + 居中文字 + 淡入淡出）
 */
async function generateTitleCard(
  card: TitleCard,
  outputFile: string,
  tempDir: string,
): Promise<void> {
  const duration = card.duration || 2
  const fontPath = await findCJKFont()

  // 写文字到临时文件，避免 FFmpeg 转义问题
  const mainTextFile = path.join(tempDir, `_tc_main_${card.insertBefore}.txt`)
  await fs.writeFile(mainTextFile, card.text, 'utf-8')

  const fontOpt = fontPath ? `:fontfile='${fontPath}'` : ''

  const vfParts: string[] = []

  // 主标题
  vfParts.push(
    `drawtext=textfile='${mainTextFile}'${fontOpt}:fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2-20`,
  )

  // 副标题
  if (card.subtext) {
    const subTextFile = path.join(tempDir, `_tc_sub_${card.insertBefore}.txt`)
    await fs.writeFile(subTextFile, card.subtext, 'utf-8')
    vfParts.push(
      `drawtext=textfile='${subTextFile}'${fontOpt}:fontsize=36:fontcolor=0xAAAAAA:x=(w-text_w)/2:y=(h/2)+40`,
    )
  }

  // 装饰线
  vfParts.push(`drawbox=x=(w-400)/2:y=h/2+80:w=400:h=2:color=0x666666@0.6:t=fill`)

  // 淡入淡出
  vfParts.push(`fade=t=in:d=0.5`)
  vfParts.push(`fade=t=out:st=${(duration - 0.5).toFixed(1)}:d=0.5`)

  await runFFmpeg([
    '-f', 'lavfi', '-i', `color=c=0x0a0a1a:s=1920x1080:d=${duration}:r=30`,
    '-f', 'lavfi', '-i', `anullsrc=channel_layout=stereo:sample_rate=44100`,
    '-vf', vfParts.join(','),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-shortest', '-t', String(duration),
    '-y', outputFile,
  ])

  logInfo(`[FFmpeg] 标题卡生成: "${card.text}" (${duration}s)`)
}

// ==================== 音画同步 ====================

export interface ClipSyncInfo {
  /** 配音音频本地文件路径（用于替换原声） */
  voiceAudioFile?: string
  /** 配音音频时长（秒），用于调整视频速度 */
  audioDuration?: number
  /** 无配音片段的最大时长（秒），超过则加速 */
  maxSilentDuration?: number
}

/**
 * 对单个片段做预处理：归一化 → Ken Burns 运镜 → 音画同步（变速+音轨替换）
 */
async function preprocessClip(
  inputFile: string,
  outputFile: string,
  sync?: ClipSyncInfo,
  kenBurns?: KenBurnsEffect,
): Promise<void> {
  const videoDur = await getVideoDuration(inputFile)
  if (videoDur <= 0) {
    await fs.copyFile(inputFile, outputFile)
    return
  }

  // 构建视频滤镜链：归一化 → Ken Burns → 变速 → fps
  const vFilters: string[] = [
    'scale=1920:1080:force_original_aspect_ratio=decrease',
    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
    'setsar=1',
  ]

  // Ken Burns 运镜
  const kbFilter = kenBurns ? buildKenBurnsFilter(kenBurns, videoDur) : null
  if (kbFilter) {
    vFilters.push(kbFilter)
    logInfo(`[preprocess] Ken Burns: ${kenBurns!.type}`)
  }

  // 判断是否需要变速
  let needSpeedAdj = false
  let ptsFactor = '1'
  let hasVoice = false

  if (sync?.voiceAudioFile && sync.audioDuration && sync.audioDuration > 0) {
    hasVoice = true
    const speedRatio = Math.max(0.5, Math.min(2.0, videoDur / sync.audioDuration))
    ptsFactor = (1 / speedRatio).toFixed(4)
    needSpeedAdj = Math.abs(speedRatio - 1.0) > 0.02
    if (needSpeedAdj) {
      logInfo(`[preprocess] 视频 ${videoDur.toFixed(1)}s → 配音 ${sync.audioDuration.toFixed(1)}s, 速率 ${speedRatio.toFixed(2)}x`)
    }
  } else if (sync && (sync.maxSilentDuration || 0) > 0) {
    const maxDur = sync.maxSilentDuration || 4.0
    if (videoDur > maxDur) {
      const speedRatio = Math.max(0.5, Math.min(2.0, videoDur / maxDur))
      ptsFactor = (1 / speedRatio).toFixed(4)
      needSpeedAdj = true
      logInfo(`[preprocess] 无配音片段 ${videoDur.toFixed(1)}s → 压缩至 ${maxDur.toFixed(1)}s`)
    }
  }

  if (needSpeedAdj) {
    vFilters.push(`setpts=${ptsFactor}*PTS`)
  }

  vFilters.push('fps=30')

  // 构建 FFmpeg 命令
  const args: string[] = ['-i', inputFile]

  if (hasVoice) {
    args.push('-i', sync!.voiceAudioFile!)
    args.push('-filter_complex', `[0:v]${vFilters.join(',')}[v]`)
    args.push('-map', '[v]', '-map', '1:a')
    args.push('-shortest')
  } else if (needSpeedAdj) {
    const atempo = Math.min(2.0, parseFloat((1 / parseFloat(ptsFactor)).toFixed(4)))
    args.push('-filter_complex', `[0:v]${vFilters.join(',')}[v];[0:a]atempo=${atempo.toFixed(4)}[a]`)
    args.push('-map', '[v]', '-map', '[a]')
  } else {
    args.push('-vf', vFilters.join(','))
    args.push('-map', '0:v', '-map', '0:a?')
  }

  args.push(
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-ar', '44100', '-ac', '2',
    '-y', outputFile,
  )

  await runFFmpeg(args)
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
  /** 每个片段的音画同步信息（与 inputFiles 一一对应） */
  clipSync?: ClipSyncInfo[]
  /** Ken Burns 运镜效果（与 inputFiles 一一对应） */
  kenBurnsEffects?: KenBurnsEffect[]
  /** 标题卡（按 insertBefore 插入） */
  titleCards?: TitleCard[]
  /** 片头淡入时长（秒），0 = 不加 */
  introFadeDuration?: number
  /** 片尾淡出时长（秒），0 = 不加 */
  outroFadeDuration?: number
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
    panelTransitions, clipSync, kenBurnsEffects,
    titleCards, introFadeDuration = 0, outroFadeDuration = 0,
  } = options

  if (inputFiles.length === 0) {
    throw new Error('No input files provided')
  }

  const dir = path.dirname(outputFile)
  const tempFiles: string[] = []

  try {
    // Step 1: 预处理（归一化 + Ken Burns + 音画同步）
    const hasPreprocess = (clipSync && clipSync.length > 0) || (kenBurnsEffects && kenBurnsEffects.some(e => e.type !== 'none'))
    let processedFiles = inputFiles

    if (hasPreprocess) {
      const syncCount = clipSync?.filter(s => s?.voiceAudioFile).length || 0
      const kbCount = kenBurnsEffects?.filter(e => e.type !== 'none').length || 0
      logInfo(`[FFmpeg] 预处理: ${syncCount} 个配音同步, ${kbCount} 个运镜效果`)

      processedFiles = []
      for (let i = 0; i < inputFiles.length; i++) {
        const sync = clipSync?.[i]
        const kb = kenBurnsEffects?.[i]
        const needsProcess = (sync && (sync.voiceAudioFile || (sync.maxSilentDuration && sync.maxSilentDuration > 0))) || (kb && kb.type !== 'none')

        if (needsProcess) {
          const procPath = path.join(dir, `_proc_${i}.mp4`)
          await preprocessClip(inputFiles[i], procPath, sync, kb)
          processedFiles.push(procPath)
          tempFiles.push(procPath)
        } else {
          processedFiles.push(inputFiles[i])
        }
      }
    }

    // Step 2: 生成标题卡并插入
    if (titleCards && titleCards.length > 0) {
      logInfo(`[FFmpeg] 生成 ${titleCards.length} 个标题卡`)
      const cardFiles: { file: string; insertBefore: number }[] = []

      for (const card of titleCards) {
        const cardPath = path.join(dir, `_titlecard_${card.insertBefore}.mp4`)
        await generateTitleCard(card, cardPath, dir)
        cardFiles.push({ file: cardPath, insertBefore: card.insertBefore })
        tempFiles.push(cardPath)
      }

      // 按 insertBefore 降序插入，避免索引偏移
      cardFiles.sort((a, b) => b.insertBefore - a.insertBefore)
      const filesWithCards = [...processedFiles]
      for (const cf of cardFiles) {
        const idx = Math.min(cf.insertBefore, filesWithCards.length)
        filesWithCards.splice(idx, 0, cf.file)
      }
      processedFiles = filesWithCards
    }

    // Step 3: 拼接
    const needsPostProcess = (subtitles && subtitles.length > 0) || bgmFile || introFadeDuration > 0 || outroFadeDuration > 0
    const concatOutput = needsPostProcess
      ? outputFile.replace('.mp4', '_concat_tmp.mp4')
      : outputFile

    if (processedFiles.length === 1) {
      await fs.copyFile(processedFiles[0], concatOutput)
    } else if (transition === 'smart' && panelTransitions) {
      await concatWithSmartTransitions(processedFiles, concatOutput, panelTransitions)
    } else if (transition === 'fade') {
      await concatWithXfade(processedFiles, concatOutput, transitionDuration)
    } else {
      await concatWithDemuxer(processedFiles, concatOutput)
    }

    // Step 4: 后处理（字幕 + BGM + 片头片尾淡入淡出）
    if (needsPostProcess) {
      await postProcess(concatOutput, outputFile, subtitles, bgmFile, bgmVolume, introFadeDuration, outroFadeDuration)
      await fs.unlink(concatOutput).catch(() => {})
    }
  } finally {
    for (const f of tempFiles) {
      await fs.unlink(f).catch(() => {})
    }
  }
}

// ==================== 后处理：字幕 + BGM ====================

async function postProcess(
  inputFile: string,
  outputFile: string,
  subtitles?: SubtitleEntry[],
  bgmFile?: string,
  bgmVolume = 0.15,
  introFade = 0,
  outroFade = 0,
): Promise<void> {
  const dir = path.dirname(outputFile)
  const args: string[] = ['-i', inputFile]
  const vFilters: string[] = []

  // 字幕
  let assPath: string | undefined
  if (subtitles && subtitles.length > 0) {
    assPath = path.join(dir, '_subtitles.ass')
    await fs.writeFile(assPath, generateASS(subtitles), 'utf-8')
    vFilters.push(`ass='${assPath.replace(/'/g, "'\\''")}'`)
    logInfo(`[FFmpeg] 烧录 ${subtitles.length} 条字幕`)
  }

  // 片头从黑场淡入
  if (introFade > 0) {
    vFilters.push(`fade=t=in:st=0:d=${introFade.toFixed(1)}`)
    logInfo(`[FFmpeg] 片头淡入: ${introFade}s`)
  }

  // 片尾淡出到黑场（需要知道总时长，用 -sseof 或从 ffprobe 获取）
  if (outroFade > 0) {
    const totalDur = await getVideoDuration(inputFile)
    if (totalDur > outroFade) {
      vFilters.push(`fade=t=out:st=${(totalDur - outroFade).toFixed(2)}:d=${outroFade.toFixed(1)}`)
      logInfo(`[FFmpeg] 片尾淡出: ${outroFade}s (总时长 ${totalDur.toFixed(1)}s)`)
    }
  }

  // BGM 混音
  if (bgmFile) {
    args.push('-i', bgmFile)
    logInfo(`[FFmpeg] 混音 BGM, 音量: ${bgmVolume}`)
  }

  // 构建 filter_complex
  if (vFilters.length > 0 || bgmFile) {
    const filterParts: string[] = []

    if (vFilters.length > 0) {
      filterParts.push(`[0:v]${vFilters.join(',')}[vout]`)
    }

    if (bgmFile) {
      filterParts.push(`[1:a]aloop=loop=-1:size=2e+09,volume=${bgmVolume},afade=t=in:st=0:d=2[bgm]`)
      filterParts.push(`[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=3[aout]`)
    }

    args.push('-filter_complex', filterParts.join(';\n'))

    if (vFilters.length > 0) {
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
