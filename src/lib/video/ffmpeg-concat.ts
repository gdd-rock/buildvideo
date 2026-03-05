import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import { logInfo, logError } from '@/lib/logging/core'

/**
 * 使用 ffprobe 获取视频时长（秒）
 */
async function getVideoDuration(filePath: string): Promise<number> {
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
    logInfo(`[FFmpeg] 执行: ffmpeg ${args.join(' ')}`)
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

export interface ConcatOptions {
  inputFiles: string[]
  outputFile: string
  transition?: 'none' | 'fade'
  transitionDuration?: number // 秒，默认 0.5
}

/**
 * 使用 FFmpeg 拼接多个视频文件
 *
 * - transition='none': 使用 concat demuxer（快速，无需重编码）
 * - transition='fade': 使用 xfade filter（需重编码，支持淡入淡出转场）
 */
export async function concatVideosWithFFmpeg(options: ConcatOptions): Promise<void> {
  const { inputFiles, outputFile, transition = 'none', transitionDuration = 0.5 } = options

  if (inputFiles.length === 0) {
    throw new Error('No input files provided')
  }

  if (inputFiles.length === 1) {
    // 单文件直接复制
    await fs.copyFile(inputFiles[0], outputFile)
    return
  }

  if (transition === 'none') {
    await concatWithDemuxer(inputFiles, outputFile)
  } else {
    await concatWithXfade(inputFiles, outputFile, transitionDuration)
  }
}

/**
 * 使用 concat demuxer 快速拼接（无转场，无需重编码）
 * 先统一所有片段的编码/分辨率，再 concat
 */
async function concatWithDemuxer(inputFiles: string[], outputFile: string): Promise<void> {
  const dir = path.dirname(outputFile)

  // 先把所有片段统一为相同分辨率和编码格式，避免 concat 报错
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

  // 生成 concat 列表文件
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

  // 清理临时文件
  for (const f of normalizedFiles) {
    await fs.unlink(f).catch(() => {})
  }
  await fs.unlink(concatListPath).catch(() => {})
}

/**
 * 使用 xfade filter 拼接（带淡入淡出转场，需重编码）
 */
async function concatWithXfade(
  inputFiles: string[],
  outputFile: string,
  transitionDuration: number,
): Promise<void> {
  // 获取所有视频时长
  const durations = await Promise.all(inputFiles.map(getVideoDuration))
  logInfo(`[FFmpeg] xfade: ${inputFiles.length} 个文件, 时长: ${durations.map(d => d.toFixed(1)).join('s, ')}s`)

  // 构建 FFmpeg 参数
  const inputs: string[] = []
  for (const f of inputFiles) {
    inputs.push('-i', f)
  }

  // 构建 xfade filter chain
  // 每两个视频之间添加一个 xfade
  const filterParts: string[] = []
  const n = inputFiles.length

  // 先将所有输入统一分辨率
  for (let i = 0; i < n; i++) {
    filterParts.push(
      `[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}]`,
    )
  }

  // 递进构建 xfade chain
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

  // 音频处理：简单拼接所有音频
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
