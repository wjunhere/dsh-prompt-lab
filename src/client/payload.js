/**
 * 请求载荷：把会话事件折成模型实际收到的消息序列，并按 DeepSeek Messages API
 * 生成一份 wire 预览。
 *
 * 口径与官方 `@deepseek-ai/dsh-session/surface` 一致（surface 折叠 + 事件到消息的
 * 投影规则），但插件拿不到宿主侧的插件级消息投影（如图片卸载改写），因此界面会
 * 明确标注“按日志重建”。
 */

/** 能进入模型可见 surface 的事件类型。 */
const SURFACE_TYPES = new Set([
  'system/message',
  'developer/message',
  'user/message',
  'assistant/message',
  'tool/result',
])

/**
 * 按 surface 语义折叠事件：append 追加，replace 先移除被遮蔽区间再加入自己。
 * @param {readonly any[]} entries 事件窗口条目。
 * @param {number} [untilSeq] 只折叠到该序号（含）。
 * @returns {{ nodes: any[], replacements: number, unresolved: number }} 保活的事件序列。
 */
export function foldSurface(entries, untilSeq = Number.POSITIVE_INFINITY) {
  const nodes = []
  let replacements = 0
  let unresolved = 0
  for (const entry of entries) {
    if (entry?.type !== 'event') continue
    const event = entry.event
    if (event.seq > untilSeq) break
    if (!SURFACE_TYPES.has(event.type) || event.surfaceOp === undefined) continue
    const op = event.surfaceOp
    if (op === 'append') {
      nodes.push(event)
      continue
    }
    if (op !== null && typeof op === 'object' && op.op === 'replace') {
      const start = nodes.findIndex(node => node.seq === op.startSeq)
      const end = nodes.findIndex(node => node.seq === op.endSeq)
      if (start < 0 || end < start) {
        // 窗口没有包含完整被遮蔽区间（更早的历史还没加载）：无法精确折叠，
        // 保留替换节点并计数，由界面提示。
        unresolved += 1
        nodes.push(event)
        continue
      }
      nodes.splice(start, end - start + 1, event)
      replacements += 1
      continue
    }
    nodes.push(event)
  }
  return { nodes, replacements, unresolved }
}

/**
 * 把内容块里的可读文本汇总出来，用于字节统计。
 * @param {readonly any[]} content 内容块。
 * @returns {string} 文本表示。
 */
export function contentText(content) {
  const parts = []
  for (const block of content ?? []) {
    switch (block.type) {
      case 'text':
        parts.push(block.text)
        break
      case 'reasoning':
        parts.push(block.text)
        break
      case 'tool-call':
        parts.push(block.arguments ?? '')
        break
      case 'tool-addition':
      case 'tool-removal':
        parts.push(block.toolName)
        break
      case 'image':
        parts.push('[image]')
        break
      case 'file':
        parts.push(`[file ${block.attachment?.name ?? ''}]`)
        break
      default:
        break
    }
  }
  return parts.join('\n')
}

/**
 * 事件 → 模型消息（与 deriveEventMessage 同规则）。
 * @param {readonly any[]} nodes surface 事件。
 * @returns {{ seq: number, role: string, sourceKind: string, content: any[], bytes: number }[]} 消息序列。
 */
export function deriveMessages(nodes) {
  const messages = []
  for (const event of nodes) {
    let message
    if (event.type === 'user/message') message = event.data
    else if (event.type === 'tool/result') message = event.data.message
    else if (event.type === 'system/message' || event.type === 'developer/message' || event.type === 'assistant/message') {
      // 空内容的消息保留 surface 位置但不产生 wire 消息。
      if ((event.data.message?.content ?? []).length === 0) continue
      message = event.data.message
    } else continue
    const content = message?.content ?? []
    messages.push({
      seq: event.seq,
      role: message?.role ?? 'user',
      sourceKind: message?.source?.kind ?? '-',
      content,
      ...message?.toolCallId === undefined ? {} : { toolCallId: message.toolCallId },
      ...message?.isError === true ? { isError: true } : {},
      bytes: utf8Bytes(contentText(content)),
    })
  }
  return messages
}

/** 浏览器与 Node 通用的 UTF-8 字节数。 */
function utf8Bytes(text) {
  return new TextEncoder().encode(text).length
}

/**
 * 按 DeepSeek Messages API 映射消息。
 * @param {{ role: string, content: readonly any[], toolCallId?: string, isError?: boolean }[]} messages 派生消息。
 * @returns {{ wire: any[], notes: string[] }} wire 消息与映射告警。
 */
export function toDeepSeekMessages(messages) {
  const wire = []
  const notes = []
  let systemText
  const push = (role, content) => {
    if (content.length === 0) return
    const previous = wire.at(-1)
    if (previous?.role === role) previous.content.push(...content)
    else wire.push({ role, content })
  }
  for (const message of messages) {
    if (message.role === 'developer') {
      const content = message.content.map(block => {
        if (block.type === 'text') return { type: 'text', text: block.text }
        if (block.type === 'tool-addition') return { type: 'tool_addition', tool: { type: 'tool_reference', name: block.toolName } }
        if (block.type === 'tool-removal') return { type: 'tool_removal', tool: { type: 'tool_reference', name: block.toolName } }
        notes.push(`developer 内容块 ${block.type} 无法映射`)
        return null
      }).filter(Boolean)
      // 适配器把 developer 消息变成紧随用户轮之后的 system 更新；这里按原顺序追加。
      push('system', content)
      continue
    }
    if (message.role === 'system') {
      const text = message.content.map(block => (block.type === 'text' ? block.text : '')).join('')
      if (systemText === undefined) {
        systemText = text
        continue
      }
      push('system', [{ type: 'text', text }])
      continue
    }
    if (message.role === 'assistant') {
      const content = []
      for (const block of message.content) {
        if (block.type === 'text') {
          if (block.text !== '') content.push({ type: 'text', text: block.text })
        } else if (block.type === 'reasoning') {
          content.push({ type: 'thinking', thinking: block.text })
        } else if (block.type === 'tool-call') {
          let input
          try {
            input = JSON.parse(block.arguments ?? '{}')
          } catch {
            input = block.arguments
            notes.push(`工具调用 ${block.name} 的参数不是合法 JSON，原样展示`)
          }
          content.push({ type: 'tool_use', id: block.id, name: block.name, input })
        } else {
          notes.push(`assistant 内容块 ${block.type} 不发送`)
        }
      }
      push('assistant', content)
      continue
    }
    if (message.role === 'tool') {
      const blocks = message.content.flatMap(block => {
        if (block.type === 'text') return [{ type: 'text', text: block.text }]
        if (block.type === 'image') return [{ type: 'image', source: { type: 'at-send-time' } }]
        notes.push(`tool 结果内容块 ${block.type} 无法映射`)
        return []
      })
      // 适配器把 tool_result 放进 user 轮，并保留调用 id 配对。
      push('user', [{
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: blocks,
        ...message.isError === true ? { is_error: true } : {},
      }])
      continue
    }
    // user
    const content = []
    for (const block of message.content) {
      if (block.type === 'text') {
        if (block.text !== '') content.push({ type: 'text', text: block.text })
      } else if (block.type === 'image') {
        content.push({ type: 'image', source: { type: 'at-send-time' } })
      } else if (block.type === 'file') {
        content.push({ type: 'text', text: `[file ${block.attachment?.name ?? ''}]` })
        notes.push('文件引用在发送时投影为只读路径文本')
      } else {
        notes.push(`user 内容块 ${block.type} 不发送`)
      }
    }
    push('user', content)
  }
  return { wire, systemText, notes }
}

/**
 * 生成 deepseek-official 的 wire 预览。
 * @param {object} input 输入。
 * @param {object} input.config 请求头里的调用配置。
 * @param {readonly any[]} input.tools 该请求的工具目录。
 * @param {string} input.systemText 生效的系统提示词。
 * @param {readonly any[]} input.messages 派生消息。
 * @param {string} [input.sessionId] 会话 id。
 * @returns {{ headers: { name: string, value: string }[], body: object, notes: string[] }} 预览。
 */
export function buildDeepSeekWire({ config, tools, systemText, messages, sessionId }) {
  const mapped = toDeepSeekMessages(messages)
  const effort = config.reasoningEffort ?? 'high'
  // 历史里第一条 system 消息就是 wire 的顶层 system；之后的 system 消息是
  // in-history 更新，按适配器语义作为 role:'system' 消息留在 messages 里。
  const system = mapped.systemText ?? systemText
  const body = {
    model: config.model,
    stream: true,
    ...system === undefined || system === '' ? {} : { system },
    messages: mapped.wire,
    ...tools === undefined || tools.length === 0 ? {} : {
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
        ...tool.deferLoading === true ? { defer_loading: true } : {},
      })),
    },
    ...config.maxTokens === undefined ? {} : { max_tokens: config.maxTokens },
    thinking: { type: effort === 'off' ? 'disabled' : 'enabled' },
    ...effort === 'off' ? {} : { output_config: { effort } },
    ...config.temperature === undefined ? {} : { temperature: config.temperature },
    ...config.stop === undefined ? {} : { stop_sequences: config.stop },
  }
  const headers = [
    { name: 'content-type', value: 'application/json' },
    { name: 'accept', value: 'text/event-stream' },
    { name: 'anthropic-version', value: '2023-06-01' },
    { name: 'x-deepseek-harness-user-id', value: '<已脱敏>' },
    ...sessionId === undefined ? [] : [{ name: 'x-deepseek-harness-session-id', value: sessionId }],
    { name: 'authorization', value: '<由账号适配器注入>' },
  ]
  const notes = [
    '按 DeepSeek Messages API 映射；provider 不同时字段可能不同。',
    '历史里第一条 system 消息映射为顶层 system；之后的 system 消息作为 role:system 的 in-history 更新留在 messages 里。',
    'assistant 的 reasoning 块映射为 thinking；工具调用映射为 tool_use，工具结果映射为 user 轮里的 tool_result。',
    '图片等附件在真正发送时才展开为 base64 或 file_id。',
    '此处按会话日志重建，宿主插件对消息的投影（如图片卸载）未计入。',
    ...mapped.notes,
  ]
  return { headers, body, notes }
}

/**
 * 汇总一段消息序列的规模。
 * @param {readonly { role: string, bytes: number }[]} messages 派生消息。
 * @returns {{ count: number, bytes: number, byRole: Record<string, { count: number, bytes: number }> }} 统计。
 */
export function summarizeMessages(messages) {
  const byRole = {}
  let bytes = 0
  for (const message of messages) {
    bytes += message.bytes
    const row = byRole[message.role] ?? { count: 0, bytes: 0 }
    row.count += 1
    row.bytes += message.bytes
    byRole[message.role] = row
  }
  return { count: messages.length, bytes, byRole }
}

/**
 * 为一个请求生成完整载荷视图数据。
 * @param {readonly any[]} entries 会话事件窗口。
 * @param {object} request 选中的请求记录。
 * @param {string} [sessionId] 会话 id。
 * @returns {object} 折叠结果、消息、统计与 wire 预览。
 */
export function buildPayload(entries, request, sessionId) {
  const folded = foldSurface(entries, request.seq)
  const messages = deriveMessages(folded.nodes)
  const summary = summarizeMessages(messages)
  const config = request.prompt.config ?? {}
  const tools = request.prompt.tools ?? []
  const provider = String(config.provider ?? '')
  const isDeepSeek = provider.startsWith('deepseek')
  const wire = isDeepSeek
    ? buildDeepSeekWire({
      config,
      tools,
      systemText: request.prompt.system,
      messages,
      sessionId,
    })
    : null
  const neutral = {
    ...config,
    messages: messages.map(message => ({
      role: message.role,
      source: message.sourceKind,
      ...message.content.length === 0 ? {} : { content: message.content },
      ...message.toolCallId === undefined ? {} : { toolCallId: message.toolCallId },
      ...message.isError === true ? { isError: true } : {},
    })),
    tools,
  }
  return { folded, messages, summary, wire, neutral, provider, isDeepSeek }
}
