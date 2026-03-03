import type { Job } from 'bullmq'
import { prisma } from '@/lib/prisma'
import { executeAiTextStep } from '@/lib/ai-runtime'
import { countWords } from '@/lib/word-count'
import { withInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'
import { reportTaskProgress } from '@/lib/workers/shared'
import { assertTaskActive } from '@/lib/workers/utils'
import { getUserModelConfig } from '@/lib/config-service'
import { createTextMarkerMatcher } from '@/lib/novel-promotion/story-to-script/clip-matching'
import { createWorkerLLMStreamCallbacks, createWorkerLLMStreamContext } from './llm-stream'
import type { TaskJobData } from '@/lib/task/types'
import { buildPrompt, PROMPT_IDS } from '@/lib/prompt-i18n'
import { cleanJsonString } from './json-repair'

type EpisodeSplit = {
  number?: number
  title?: string
  summary?: string
  startMarker?: string
  endMarker?: string
}

type SplitResponse = {
  episodes?: EpisodeSplit[]
}

const MAX_EPISODE_SPLIT_ATTEMPTS = 3
const MARKER_MATCH_THRESHOLD = 0.75

const EPISODE_SPLIT_BOUNDARY_SUFFIX = `

[Boundary Constraints]
1. Each episode MUST include both startMarker and endMarker from the original text.
2. Markers must be locatable in the original text; allow punctuation/whitespace differences only.
3. If boundaries cannot be located reliably, return an empty episodes array.`

// JSON cleaning is provided by ./json-repair.ts (cleanJsonString)

function parseSplitResponse(aiResponse: string): SplitResponse {
  const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response: missing JSON payload')
  }

  const rawJson = jsonMatch[1] || jsonMatch[0]

  // Strategy 1: Parse raw JSON directly
  try {
    const parsed = JSON.parse(rawJson) as SplitResponse
    if (parsed && Array.isArray(parsed.episodes) && parsed.episodes.length > 0) return parsed
  } catch { /* fall through */ }

  // Strategy 2: Smart cleaning (handles curly quotes, unescaped interior quotes, control chars)
  try {
    const cleaned = cleanJsonString(rawJson)
    const parsed = JSON.parse(cleaned) as SplitResponse
    if (parsed && Array.isArray(parsed.episodes) && parsed.episodes.length > 0) return parsed
  } catch { /* fall through */ }

  // Strategy 3: Regex-based field extraction as last resort
  try {
    const parsed = extractEpisodesViaRegex(rawJson)
    if (parsed && Array.isArray(parsed.episodes) && parsed.episodes.length > 0) return parsed
  } catch { /* fall through */ }

  // All strategies failed — log raw for debugging
  const snippet = rawJson.length > 800 ? rawJson.slice(0, 400) + ' ... ' + rawJson.slice(-400) : rawJson
  throw new Error(`Failed to parse AI JSON response. Raw length: ${rawJson.length}. Snippet: ${snippet}`)
}

function extractEpisodesViaRegex(text: string): SplitResponse {
  const episodes: EpisodeSplit[] = []
  // Match episode-like blocks: look for number/title/summary/startMarker/endMarker patterns
  const blockPattern = /\{[^{}]*?"number"\s*:\s*(\d+)[^{}]*?"title"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|[\u201C]((?:[^\u201D\\]|\\.)*)[\u201D])[^{}]*?\}/g
  let match: RegExpExecArray | null

  while ((match = blockPattern.exec(text)) !== null) {
    const block = match[0]
    const number = parseInt(match[1], 10)
    const title = (match[2] || match[3] || '').replace(/\\"/g, '"')

    const summaryMatch = block.match(/"summary"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|[\u201C]((?:[^\u201D\\]|\\.)*)[\u201D])/)
    const startMatch = block.match(/"startMarker"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|[\u201C]((?:[^\u201D\\]|\\.)*)[\u201D])/)
    const endMatch = block.match(/"endMarker"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|[\u201C]((?:[^\u201D\\]|\\.)*)[\u201D])/)

    episodes.push({
      number,
      title,
      summary: summaryMatch ? (summaryMatch[1] || summaryMatch[2] || '') : '',
      startMarker: startMatch ? (startMatch[1] || startMatch[2] || '') : '',
      endMarker: endMatch ? (endMatch[1] || endMatch[2] || '') : '',
    })
  }

  return { episodes }
}

function readBoundaryMarker(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const marker = value.trim()
  return marker.length > 0 ? marker : null
}

type MatchedEpisode = {
  index: number
  startPos: number
  endPos: number
  ep: EpisodeSplit
}

type FailedEpisode = {
  index: number
  ep: EpisodeSplit
  reason: string
}

function buildRetryFeedback(failedEpisodes: FailedEpisode[]): string {
  const lines = [
    '上次分集结果存在以下问题，请修正：',
    '',
  ]

  for (const f of failedEpisodes) {
    const startMarker = readBoundaryMarker(f.ep.startMarker) || '(空)'
    const endMarker = readBoundaryMarker(f.ep.endMarker) || '(空)'
    lines.push(`- 第 ${f.index + 1} 集: ${f.reason}`)
    lines.push(`  startMarker="${startMarker}"`)
    lines.push(`  endMarker="${endMarker}"`)
  }

  lines.push('')
  lines.push('请确保 startMarker 和 endMarker 是从原文中直接复制的连续子串（30-50个字符），不要修改任何标点或空格。')

  return lines.join('\n')
}

/**
 * Build episodes from matched anchor points, filling gaps for failed episodes.
 */
function buildEpisodesFromAnchors(
  content: string,
  splitEpisodes: EpisodeSplit[],
  matched: MatchedEpisode[],
  failed: FailedEpisode[],
): Array<{ number: number; title: string; summary: string; content: string; wordCount: number }> {
  if (matched.length === 0) {
    throw new Error('没有任何集的 marker 匹配成功')
  }

  // Sort matched by position
  matched.sort((a, b) => a.startPos - b.startPos)

  // Build a position map: for each episode index, store its resolved range
  const positionMap = new Map<number, { startPos: number; endPos: number }>()
  for (const m of matched) {
    positionMap.set(m.index, { startPos: m.startPos, endPos: m.endPos })
  }

  // Fill gaps for failed episodes by interpolating between anchors
  const failedIndices = failed.map((f) => f.index).sort((a, b) => a - b)

  for (const failIdx of failedIndices) {
    // Find the nearest matched episode before and after
    let prevEnd = 0
    let nextStart = content.length

    for (let i = failIdx - 1; i >= 0; i--) {
      const pos = positionMap.get(i)
      if (pos) { prevEnd = pos.endPos; break }
    }
    for (let i = failIdx + 1; i < splitEpisodes.length; i++) {
      const pos = positionMap.get(i)
      if (pos) { nextStart = pos.startPos; break }
    }

    if (nextStart <= prevEnd) continue // No room to fill

    // Count how many consecutive failed episodes share this gap
    let gapFailedCount = 1
    let gapStart = failIdx
    let gapEnd = failIdx
    for (let i = failIdx - 1; i >= 0 && !positionMap.has(i) && failedIndices.includes(i); i--) {
      gapStart = i
      gapFailedCount++
    }
    for (let i = failIdx + 1; i < splitEpisodes.length && !positionMap.has(i) && failedIndices.includes(i); i++) {
      gapEnd = i
      gapFailedCount++
    }

    // Divide the gap evenly among the consecutive failed episodes
    const gapLength = nextStart - prevEnd
    const sliceLength = Math.floor(gapLength / gapFailedCount)
    const posInGap = failIdx - gapStart
    const sliceStart = prevEnd + posInGap * sliceLength
    const sliceEnd = (posInGap === gapFailedCount - 1) ? nextStart : sliceStart + sliceLength

    if (sliceEnd > sliceStart) {
      positionMap.set(failIdx, { startPos: sliceStart, endPos: sliceEnd })
    }
  }

  // Build final episode list in order
  const result: Array<{ number: number; title: string; summary: string; content: string; wordCount: number }> = []

  for (let idx = 0; idx < splitEpisodes.length; idx++) {
    const pos = positionMap.get(idx)
    if (!pos) continue

    const ep = splitEpisodes[idx]
    const episodeNumber = typeof ep.number === 'number' && Number.isFinite(ep.number) && ep.number > 0
      ? Math.floor(ep.number)
      : idx + 1

    const title = typeof ep.title === 'string' ? ep.title.trim() : `第 ${idx + 1} 集`
    const episodeContent = content.slice(pos.startPos, pos.endPos).trim()
    if (!episodeContent) continue

    result.push({
      number: episodeNumber,
      title,
      summary: typeof ep.summary === 'string' ? ep.summary : '',
      content: episodeContent,
      wordCount: countWords(episodeContent),
    })
  }

  return result
}

export async function handleEpisodeSplitTask(job: Job<TaskJobData>) {
  const payload = (job.data.payload || {}) as Record<string, unknown>
  const projectId = job.data.projectId
  const content = typeof payload.content === 'string' ? payload.content : ''
  if (!content || content.length < 100) {
    throw new Error('文本太短，至少需要 100 字')
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      mode: true,
    },
  })
  if (!project) {
    throw new Error('Project not found')
  }
  if (project.mode !== 'novel-promotion') {
    throw new Error('Not a novel promotion project')
  }

  const novelProject = await prisma.novelPromotionProject.findFirst({
    where: { projectId },
    select: { id: true },
  })
  if (!novelProject) {
    throw new Error('Novel promotion data not found')
  }

  const userConfig = await getUserModelConfig(job.data.userId)
  const analysisModel = userConfig.analysisModel
  if (!analysisModel) {
    throw new Error('请先在设置页面配置分析模型')
  }

  const promptBase = buildPrompt({
    promptId: PROMPT_IDS.NP_EPISODE_SPLIT,
    locale: job.data.locale,
    variables: {
      CONTENT: content,
    },
  })
  const prompt = `${promptBase}${EPISODE_SPLIT_BOUNDARY_SUFFIX}`

  await reportTaskProgress(job, 20, {
    stage: 'episode_split_prepare',
    stageLabel: '准备分集参数',
    displayMode: 'detail',
  })
  await assertTaskActive(job, 'episode_split_prepare')

  const streamContext = createWorkerLLMStreamContext(job, 'episode_split')
  const streamCallbacks = createWorkerLLMStreamCallbacks(job, streamContext)
  type EpisodeOutput = {
    number: number
    title: string
    summary: string
    content: string
    wordCount: number
  }
  let episodes: EpisodeOutput[] | null = null
  let lastError: Error | null = null
  let lastAiResponse: string | null = null
  let lastFailedEpisodes: FailedEpisode[] = []

  try {
    for (let attempt = 1; attempt <= MAX_EPISODE_SPLIT_ATTEMPTS; attempt += 1) {
      try {
        await assertTaskActive(job, `episode_split_attempt:${attempt}`)

        // Build messages: on retry, include previous response + error feedback
        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
          { role: 'user', content: prompt },
        ]
        if (attempt > 1 && lastAiResponse && lastFailedEpisodes.length > 0) {
          messages.push(
            { role: 'assistant', content: lastAiResponse },
            { role: 'user', content: buildRetryFeedback(lastFailedEpisodes) },
          )
        }

        const completion = await withInternalLLMStreamCallbacks(
          streamCallbacks,
          async () =>
            await executeAiTextStep({
              userId: job.data.userId,
              model: analysisModel,
              messages,
              temperature: 0.3,
              reasoning: true,
              reasoningEffort: 'low',
              projectId,
              action: 'episode_split',
              meta: {
                stepId: 'episode_split',
                stepAttempt: attempt,
                stepTitle: '智能分集',
                stepIndex: 1,
                stepTotal: 1,
              },
            }),
        )

        const aiResponse = completion.text
        if (!aiResponse) {
          throw new Error('AI 返回为空')
        }
        lastAiResponse = aiResponse

        await reportTaskProgress(job, 60, {
          stage: 'episode_split_parse',
          stageLabel: attempt === 1 ? '解析分集结果' : `解析分集结果（重试 ${attempt - 1}）`,
          displayMode: 'detail',
        })
        await assertTaskActive(job, 'episode_split_parse')

        const splitResult = parseSplitResponse(aiResponse)
        const splitEpisodes = splitResult.episodes || []
        if (splitEpisodes.length === 0) {
          throw new Error('分集结果为空')
        }

        await reportTaskProgress(job, 80, {
          stage: 'episode_split_match',
          stageLabel: '匹配剧集内容范围',
          displayMode: 'detail',
        })

        // Best-effort matching: try each episode, skip failures instead of aborting
        const markerMatcher = createTextMarkerMatcher(content, {
          approxConfidenceThreshold: MARKER_MATCH_THRESHOLD,
        })
        const matched: MatchedEpisode[] = []
        const failed: FailedEpisode[] = []
        let searchFrom = 0

        for (let idx = 0; idx < splitEpisodes.length; idx += 1) {
          await assertTaskActive(job, `episode_split_match:${idx + 1}`)
          const ep = splitEpisodes[idx]

          const startMarker = readBoundaryMarker(ep.startMarker)
          const endMarker = readBoundaryMarker(ep.endMarker)
          if (!startMarker || !endMarker) {
            failed.push({ index: idx, ep, reason: '缺少 startMarker 或 endMarker' })
            continue
          }

          const startMatch = markerMatcher.matchMarker(startMarker, searchFrom)
          if (!startMatch) {
            failed.push({ index: idx, ep, reason: 'startMarker 在原文中找不到' })
            continue
          }

          const endMatch = markerMatcher.matchMarker(endMarker, startMatch.endIndex)
          if (!endMatch) {
            failed.push({ index: idx, ep, reason: 'endMarker 在原文中找不到' })
            continue
          }

          const startPos = startMatch.startIndex
          const endPos = endMatch.endIndex
          if (startPos < searchFrom || endPos <= startPos || endPos > content.length) {
            failed.push({ index: idx, ep, reason: '边界区间无效' })
            continue
          }

          matched.push({ index: idx, startPos, endPos, ep })
          searchFrom = endPos
        }

        lastFailedEpisodes = failed

        // If >= 60% of episodes matched, fill gaps and succeed
        const matchRatio = matched.length / splitEpisodes.length
        if (matchRatio >= 0.6) {
          episodes = buildEpisodesFromAnchors(content, splitEpisodes, matched, failed)
          if (episodes.length > 0) break
        }

        throw new Error(
          `仅匹配到 ${matched.length}/${splitEpisodes.length} 集（${Math.round(matchRatio * 100)}%），不足 60%`
        )
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }
    }
  } finally {
    await streamCallbacks.flush()
  }

  if (!episodes) {
    throw lastError || new Error('分集边界匹配失败')
  }

  await reportTaskProgress(job, 96, {
    stage: 'episode_split_done',
    stageLabel: '智能分集完成',
    displayMode: 'detail',
  })

  return {
    success: true,
    episodes,
  }
}
