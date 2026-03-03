/**
 * Robust JSON parsing utilities for LLM responses.
 *
 * LLMs frequently produce malformed JSON:
 *   - Curly/smart quotes instead of straight quotes
 *   - Unescaped straight quotes inside string values
 *   - Trailing commas
 *   - Control characters inside strings
 *
 * This module provides multi-strategy parsing that handles all of the above.
 */

const OPEN_CURLY_QUOTES = new Set(['\u201C', '\u201E', '\u201F', '\u2033', '\u2036'])
const CLOSE_CURLY_QUOTES = new Set(['\u201D'])

function isJsonStructuralFollower(text: string, from: number): boolean {
  let j = from
  while (j < text.length && ' \t\r\n'.includes(text[j])) j++
  if (j >= text.length) return true
  const ch = text[j]
  return ch === ',' || ch === '}' || ch === ']' || ch === ':'
}

export function cleanJsonString(input: string): string {
  const text = input.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")

  let result = ''
  let inString = false
  let escape = false
  let stringOpenedWithCurly = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      result += ch
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      result += ch
      continue
    }

    const isOpenCurly = OPEN_CURLY_QUOTES.has(ch)
    const isCloseCurly = CLOSE_CURLY_QUOTES.has(ch)
    const isStraight = ch === '"'

    if (!inString) {
      if (isStraight || isOpenCurly) {
        inString = true
        stringOpenedWithCurly = isOpenCurly
        result += '"'
      } else if (isCloseCurly) {
        result += '"'
      } else {
        result += ch
      }
    } else if (stringOpenedWithCurly) {
      if (isCloseCurly) {
        inString = false
        result += '"'
      } else if (isStraight) {
        result += '\\"'
      } else if (isOpenCurly) {
        result += ch
      } else if (ch === '\n') { result += '\\n'
      } else if (ch === '\r') { result += '\\r'
      } else if (ch === '\t') { result += '\\t'
      } else if (/[\x00-\x1f\x7f]/.test(ch)) {
        result += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
      } else {
        result += ch
      }
    } else {
      if (isStraight) {
        if (isJsonStructuralFollower(text, i + 1)) {
          inString = false
          result += '"'
        } else {
          result += '\\"'
        }
      } else if (isOpenCurly || isCloseCurly) {
        result += ch
      } else if (ch === '\n') { result += '\\n'
      } else if (ch === '\r') { result += '\\r'
      } else if (ch === '\t') { result += '\\t'
      } else if (/[\x00-\x1f\x7f]/.test(ch)) {
        result += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
      } else {
        result += ch
      }
    }
  }

  result = result.replace(/,\s*([\]}])/g, '$1')

  return result
}

/**
 * Extract JSON from an LLM response (handles ```json fences and bare JSON).
 */
export function extractJsonBlock(text: string): string {
  let cleaned = text.trim()
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1)
  }
  return cleaned
}

/**
 * Parse a JSON object from an LLM response with multiple fallback strategies.
 * Returns the parsed object, or throws with a diagnostic snippet on failure.
 */
export function robustJsonParse<T = Record<string, unknown>>(responseText: string): T {
  const rawJson = extractJsonBlock(responseText)

  // Strategy 1: Direct parse
  try {
    return JSON.parse(rawJson) as T
  } catch { /* fall through */ }

  // Strategy 2: Smart cleaning
  try {
    const cleaned = cleanJsonString(rawJson)
    return JSON.parse(cleaned) as T
  } catch { /* fall through */ }

  // All strategies failed — include snippet for debugging
  const snippet = rawJson.length > 800
    ? rawJson.slice(0, 400) + ' ... ' + rawJson.slice(-400)
    : rawJson
  throw new Error(`Failed to parse AI JSON response. Raw length: ${rawJson.length}. Snippet: ${snippet}`)
}
