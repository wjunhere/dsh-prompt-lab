/**
 * 纯数据层：把客户端已加载的会话事件窗口折成「每次请求实际看到了什么」。
 *
 * 不依赖 React、不依赖 DOM，可以直接用 node --test 验证。
 * 折法与官方 Trajectory / Chat 同源：system 节点用 inspectSystem，请求头用
 * inspectRequest，因此结果与官方视图口径一致，而不是另写一套渲染语义。
 */

/**
 * 判断一个事件是否参与系统提示词 surface 折叠。
 * @param {any} event 持久会话事件。
 * @returns {boolean} 系统消息事件，或任何非 append 的 surface 替换事件。
 */
export function isSystemSurfaceEvent(event) {
  if (event.type === 'system/message') return true
  return typeof event.surfaceOp === 'string' && event.surfaceOp !== 'append'
}

/**
 * @typedef {object} PromptSnapshot
 * @property {any} config 请求头里的 provider/model 与采样配置。
 * @property {string} system 该请求生效的系统提示词全文。
 * @property {readonly any[]} tools 该请求完整工具目录。
 */

/**
 * @typedef {object} RequestRecord
 * @property {number} seq request/header 事件序号。
 * @property {number} time 事件时间（epoch ms）。
 * @property {string} reason 请求头原因：initial / resume / change / series。
 * @property {PromptSnapshot} prompt 该请求的模型可见提示词状态。
 * @property {any} [change] 与上一请求相比的变更分类。
 */

/**
 * 折叠事件窗口，得到按时间升序的请求记录。
 * @param {readonly any[]} entries `SessionEventWindow.entries`。
 * @param {(previous: any, event: any) => any} inspectSystem 官方 system 折叠函数。
 * @param {(previous: any, event: any, system: any) => any} inspectRequest 官方请求检查函数。
 * @returns {{ requests: RequestRecord[], effectiveSystem: any }} 请求列表与当前生效的系统节点。
 */
export function foldRequestPrompt(entries, inspectSystem, inspectRequest) {
  /** @type {RequestRecord[]} */
  const requests = []
  let systemState
  for (const entry of entries) {
    if (entry?.type !== 'event') continue
    const event = entry.event
    if (isSystemSurfaceEvent(event)) {
      systemState = inspectSystem(systemState, event)
      continue
    }
    if (event?.type !== 'request/header') continue
    const previous = requests.length === 0 ? undefined : requests[requests.length - 1].prompt
    const inspection = inspectRequest(previous, event, systemState?.effective)
    requests.push({
      seq: event.seq,
      time: event.time,
      reason: event.data?.reason ?? 'change',
      prompt: inspection.prompt,
      ...(inspection.change === undefined ? {} : { change: inspection.change }),
    })
  }
  return { requests, effectiveSystem: systemState?.effective }
}

/**
 * 找到离“当前生效系统提示词”最近的那次请求记录下标。
 * @param {readonly RequestRecord[]} requests 请求记录。
 * @returns {number} 下标；没有请求时为 -1。
 */
export function latestRequestIndex(requests) {
  return requests.length - 1
}

/**
 * 粗略 token 估算：CJK 按 1 token/字，其余按 4 字符/token。
 * 只用于界面上的量级提示，绝不冒充 provider 的实际用量。
 * @param {string} text 文本。
 * @returns {number} 估算 token 数。
 */
export function estimateTokens(text) {
  if (typeof text !== 'string' || text === '') return 0
  let cjk = 0
  let other = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code >= 0x2e80 && code <= 0x9fff) cjk += 1
    else if (code >= 0xac00 && code <= 0xd7af) cjk += 1
    else if (code >= 0xff00 && code <= 0xffef) cjk += 1
    else other += 1
  }
  return cjk + Math.ceil(other / 4)
}

/**
 * 工具目录的结构签名，用来判断两次请求之间工具是否变化。
 * @param {readonly any[]} tools 工具目录。
 * @returns {string} 稳定签名。
 */
export function toolsSignature(tools) {
  return (tools ?? []).map(tool => `${tool.name}\u0000${tool.description ?? ''}`).join('\u0001')
}

/**
 * 行级 diff（LCS），用于系统提示词对比。
 * @param {string} previous 旧文本。
 * @param {string} next 新文本。
 * @returns {{ kind: 'context' | 'added' | 'removed', text: string }[]} 行序列。
 */
export function diffLines(previous, next) {
  const before = previous === '' ? [] : previous.split('\n')
  const after = next === '' ? [] : next.split('\n')
  const rows = before.length
  const cols = after.length
  // 大文本退化为“整段替换”，避免在浏览器里做平方级 DP。
  if (rows * cols > 4_000_000) {
    return [
      ...before.map(text => ({ kind: 'removed', text })),
      ...after.map(text => ({ kind: 'added', text })),
    ]
  }
  const table = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1))
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[i][j] = before[i] === after[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const result = []
  let i = 0
  let j = 0
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      result.push({ kind: 'context', text: before[i] })
      i += 1
      j += 1
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ kind: 'removed', text: before[i] })
      i += 1
    } else {
      result.push({ kind: 'added', text: after[j] })
      j += 1
    }
  }
  while (i < rows) { result.push({ kind: 'removed', text: before[i] }); i += 1 }
  while (j < cols) { result.push({ kind: 'added', text: after[j] }); j += 1 }
  return result
}

/**
 * 工具目录差异：按名字比较描述与参数。
 * @param {readonly any[]} previous 旧工具目录。
 * @param {readonly any[]} next 新工具目录。
 * @returns {{ added: string[], removed: string[], changed: string[] }} 三类工具名。
 */
export function diffTools(previous, next) {
  const before = new Map((previous ?? []).map(tool => [tool.name, tool]))
  const after = new Map((next ?? []).map(tool => [tool.name, tool]))
  const added = []
  const removed = []
  const changed = []
  for (const name of after.keys()) if (!before.has(name)) added.push(name)
  for (const [name, tool] of before) {
    if (!after.has(name)) {
      removed.push(name)
      continue
    }
    const now = after.get(name)
    if ((tool.description ?? '') !== (now.description ?? '')
      || JSON.stringify(tool.parameters ?? {}) !== JSON.stringify(now.parameters ?? {})) changed.push(name)
  }
  return { added, removed, changed }
}

/**
 * 在一段文本里找到用户追加指令的位置。
 * @param {string} text 系统提示词全文。
 * @param {string} addition 用户追加指令。
 * @returns {{ start: number, end: number } | null} 命中区间；空指令或未命中返回 null。
 */
export function locateAddition(text, addition) {
  if (typeof text !== 'string' || typeof addition !== 'string') return null
  const needle = addition.trim()
  if (needle === '') return null
  const start = text.indexOf(needle)
  return start < 0 ? null : { start, end: start + needle.length }
}
