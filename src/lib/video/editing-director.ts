/**
 * LLM 驱动的剪辑决策引擎
 *
 * 将面板元数据（景别、运镜、描述、角色、场景）喂给 LLM，
 * 输出专业剪辑标记：转场类型、运镜效果、节奏控制、标题卡位置。
 */

import { executeAiTextStep } from '@/lib/ai-runtime/client'
import { resolveAnalysisModel } from '@/lib/workers/handlers/resolve-analysis-model'
import { robustJsonParse } from '@/lib/workers/handlers/json-repair'
import { logInfo, logError } from '@/lib/logging/core'
import type { KenBurnsType } from './ffmpeg-concat'

// ==================== 输入 ====================

export interface PanelMeta {
  index: number
  shotType: string | null
  cameraMove: string | null
  description: string | null
  location: string | null
  characters: string | null
  linkedToNextPanel: boolean
  hasVoice: boolean
  voiceText: string | null
  clipIndex: number
  clipSummary: string | null
}

// ==================== 输出 ====================

export type TransitionType = 'none' | 'fade' | 'dissolve' | 'wipeleft' | 'wiperight'

export interface PanelEditingDecision {
  /** Ken Burns 运镜类型 */
  kenBurns: KenBurnsType
  /** 运镜强度 0-1 */
  kenBurnsIntensity: number
  /** 到下一个镜头的转场 */
  transitionToNext: TransitionType
  /** 转场时长（秒） */
  transitionDuration: number
  /** 无配音片段的最大时长（秒），0 = 不限 */
  maxSilentDuration: number
}

export interface EditingMarkup {
  panels: PanelEditingDecision[]
  /** 整体节奏 */
  pacing: 'fast' | 'medium' | 'slow'
  /** 在哪些面板前插入标题卡（面板索引） */
  titleCardPositions: number[]
  /** 片头淡入时长 */
  introFade: number
  /** 片尾淡出时长 */
  outroFade: number
}

// ==================== Prompt ====================

function buildPrompt(panels: PanelMeta[]): string {
  const panelDescriptions = panels.map((p, i) => {
    const parts = [`[${i}]`]
    if (p.shotType) parts.push(`景别:${p.shotType}`)
    if (p.cameraMove) parts.push(`运镜:${p.cameraMove}`)
    if (p.description) parts.push(`描述:${p.description.slice(0, 80)}`)
    if (p.location) parts.push(`场景:${p.location.slice(0, 30)}`)
    if (p.characters) parts.push(`角色:${p.characters.slice(0, 40)}`)
    if (p.hasVoice) parts.push(`有配音`)
    if (p.linkedToNextPanel) parts.push(`→连续`)
    parts.push(`clip:${p.clipIndex}`)
    return parts.join(' | ')
  }).join('\n')

  return `你是一位专业的视频剪辑师。根据以下分镜面板元数据，输出 JSON 格式的剪辑决策。

## 面板列表（共 ${panels.length} 个）
${panelDescriptions}

## 决策规则
1. **Ken Burns 运镜**：根据 cameraMove 选择，如果已有运镜标注就使用对应效果；如果"固定"或无标注，可酌情添加微小 zoom_in 增加动感。intensity 0.3-0.7。
2. **转场选择**：
   - "→连续"的镜头用 dissolve（0.2-0.4s）保持连贯
   - 同场景同角色用 none 或很短的 fade
   - 场景/角色切换用 fade（0.4-0.6s）
   - 章节（clip）切换用 fade（0.6-0.8s）
   - 戏剧性转折可用 wipeleft/wiperight
3. **节奏**：有很多对话/配音 → medium/slow；动作场面多 → fast
4. **标题卡**：在 clip 切换的边界处插入标题卡（取第一个面板的索引）
5. **静音片段**：无配音片段 maxSilentDuration 建议 3-5s，节奏快时 2-3s
6. **片头片尾**：根据整体氛围选择 introFade(0.5-1.5s) 和 outroFade(1.0-2.0s)

## 输出格式（严格 JSON）
\`\`\`json
{
  "pacing": "medium",
  "introFade": 1.0,
  "outroFade": 1.5,
  "titleCardPositions": [0, 5, 12],
  "panels": [
    {
      "kenBurns": "zoom_in",
      "kenBurnsIntensity": 0.5,
      "transitionToNext": "fade",
      "transitionDuration": 0.5,
      "maxSilentDuration": 4
    }
  ]
}
\`\`\`

panels 数组必须有 ${panels.length} 个元素，与面板一一对应。只输出 JSON，不要其他文字。`
}

// ==================== 解析 ====================

const VALID_KB: Set<string> = new Set(['zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down', 'none'])
const VALID_TR: Set<string> = new Set(['none', 'fade', 'dissolve', 'wipeleft', 'wiperight'])

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function parseEditingMarkup(raw: Record<string, unknown>, panelCount: number): EditingMarkup {
  const rawPanels = Array.isArray(raw.panels) ? raw.panels : []

  const panels: PanelEditingDecision[] = []
  for (let i = 0; i < panelCount; i++) {
    const rp = (rawPanels[i] || {}) as Record<string, unknown>
    panels.push({
      kenBurns: (VALID_KB.has(rp.kenBurns as string) ? rp.kenBurns : 'none') as KenBurnsType,
      kenBurnsIntensity: clamp(Number(rp.kenBurnsIntensity) || 0.5, 0, 1),
      transitionToNext: (VALID_TR.has(rp.transitionToNext as string) ? rp.transitionToNext : 'fade') as TransitionType,
      transitionDuration: clamp(Number(rp.transitionDuration) || 0.5, 0, 1.5),
      maxSilentDuration: clamp(Number(rp.maxSilentDuration) || 4, 1, 10),
    })
  }

  const pacingRaw = String(raw.pacing || 'medium')
  const pacing = (['fast', 'medium', 'slow'].includes(pacingRaw) ? pacingRaw : 'medium') as 'fast' | 'medium' | 'slow'

  const titleCardPositions = Array.isArray(raw.titleCardPositions)
    ? (raw.titleCardPositions as number[]).filter(n => typeof n === 'number' && n >= 0 && n < panelCount)
    : []

  return {
    panels,
    pacing,
    titleCardPositions,
    introFade: clamp(Number(raw.introFade) || 1.0, 0, 3),
    outroFade: clamp(Number(raw.outroFade) || 1.5, 0, 3),
  }
}

// ==================== 主入口 ====================

export async function generateEditingMarkup(
  panels: PanelMeta[],
  userId: string,
  projectId: string,
): Promise<EditingMarkup> {
  if (panels.length === 0) {
    return { panels: [], pacing: 'medium', titleCardPositions: [], introFade: 1, outroFade: 1.5 }
  }

  // 解析模型
  let model: string
  try {
    model = await resolveAnalysisModel({ userId })
  } catch {
    logError('[editing-director] 无分析模型配置，使用规则回退')
    return fallbackMarkup(panels)
  }

  const prompt = buildPrompt(panels)

  logInfo(`[editing-director] 请求 LLM 剪辑决策: ${panels.length} 个面板`)

  try {
    const result = await executeAiTextStep({
      userId,
      model,
      messages: [{ role: 'user', content: prompt }],
      projectId,
      action: 'editing_director',
      temperature: 0.4,
      reasoning: false,
      meta: {
        stepId: 'editing_director',
        stepTitle: 'AI 剪辑决策',
        stepIndex: 1,
        stepTotal: 1,
      },
    })

    const parsed = robustJsonParse<Record<string, unknown>>(result.text)
    const markup = parseEditingMarkup(parsed, panels.length)

    logInfo(`[editing-director] 决策完成: pacing=${markup.pacing}, 标题卡=${markup.titleCardPositions.length}个`)

    return markup
  } catch (err) {
    logError('[editing-director] LLM 调用失败，使用规则回退:', err)
    return fallbackMarkup(panels)
  }
}

// ==================== 规则回退 ====================

function fallbackMarkup(panels: PanelMeta[]): EditingMarkup {
  const titleCardPositions: number[] = []
  let lastClipIndex = -1

  const panelDecisions: PanelEditingDecision[] = panels.map((p, i) => {
    // 标题卡位置
    if (p.clipIndex !== lastClipIndex && p.clipSummary) {
      titleCardPositions.push(i)
      lastClipIndex = p.clipIndex
    }

    // Ken Burns 回退逻辑
    let kenBurns: KenBurnsType = 'none'
    const cm = (p.cameraMove || '').toLowerCase()
    if (cm.includes('推') || cm.includes('zoom in')) kenBurns = 'zoom_in'
    else if (cm.includes('拉') || cm.includes('zoom out')) kenBurns = 'zoom_out'
    else if (cm.includes('左')) kenBurns = 'pan_left'
    else if (cm.includes('右')) kenBurns = 'pan_right'
    else if (cm.includes('上')) kenBurns = 'tilt_up'
    else if (cm.includes('下')) kenBurns = 'tilt_down'

    // 转场回退逻辑
    let transitionToNext: TransitionType = 'fade'
    let transitionDuration = 0.5
    if (p.linkedToNextPanel) {
      transitionToNext = 'dissolve'
      transitionDuration = 0.3
    } else if (i < panels.length - 1 && panels[i + 1].clipIndex !== p.clipIndex) {
      transitionDuration = 0.7
    }

    return {
      kenBurns,
      kenBurnsIntensity: 0.5,
      transitionToNext,
      transitionDuration,
      maxSilentDuration: 4,
    }
  })

  return {
    panels: panelDecisions,
    pacing: 'medium',
    titleCardPositions,
    introFade: 1.0,
    outroFade: 1.5,
  }
}
