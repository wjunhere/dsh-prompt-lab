/** 载荷层：surface 折叠、消息派生、DeepSeek wire 映射。 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildDeepSeekWire, buildPayload, contentText, deriveMessages, foldSurface, summarizeMessages,
} from '../src/client/payload.js'

function surface(seq, type, data, op = 'append') {
  return { type: 'event', event: { type, seq, time: seq, data, surfaceOp: op } }
}

const SYSTEM = surface(1, 'system/message', {
  message: { role: 'system', content: [{ type: 'text', text: 'SYS' }], source: { kind: 'system-prompt' }, id: 'm1' },
})
const USER = surface(2, 'user/message', {
  content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' }, role: 'user', id: 'm2',
})
const ASSISTANT = surface(3, 'assistant/message', {
  turn: 1, step: 1,
  message: {
    role: 'assistant',
    content: [
      { type: 'text', text: 'hi' },
      { type: 'reasoning', text: 'think' },
      { type: 'tool-call', id: 'call_1', name: 'bash', arguments: '{"command":"pwd"}' },
    ],
    source: { kind: 'model' },
    id: 'm3',
  },
})
const TOOL = surface(4, 'tool/result', {
  turn: 1, step: 1,
  message: {
    role: 'tool',
    toolCallId: 'call_1',
    content: [{ type: 'text', text: '/b' }],
    source: { kind: 'tool', callId: 'call_1' },
    id: 'm4',
  },
})

test('surface 折叠：append 追加，replace 替换被遮蔽区间', () => {
  const entries = [SYSTEM, USER, ASSISTANT, TOOL]
  const appended = foldSurface(entries)
  assert.deepEqual(appended.nodes.map(node => node.type), ['system/message', 'user/message', 'assistant/message', 'tool/result'])
  assert.equal(appended.replacements, 0)

  const replacedSystem = surface(5, 'system/message', {
    message: { role: 'system', content: [{ type: 'text', text: 'SYS2' }], source: { kind: 'system-prompt' }, id: 'm5' },
  }, { op: 'replace', startSeq: 1, endSeq: 1 })
  const replaced = foldSurface([SYSTEM, USER, ASSISTANT, TOOL, replacedSystem])
  assert.deepEqual(replaced.nodes.map(node => node.type), ['system/message', 'user/message', 'assistant/message', 'tool/result'])
  assert.equal(replaced.nodes[0].seq, 5)
  assert.equal(replaced.replacements, 1)
})

test('surface 折叠：窗口缺少被遮蔽区间时标记 unresolved', () => {
  const replacement = surface(9, 'system/message', {
    message: { role: 'system', content: [{ type: 'text', text: 'X' }], source: { kind: 'system-prompt' }, id: 'm9' },
  }, { op: 'replace', startSeq: 1, endSeq: 3 })
  const folded = foldSurface([replacement])
  assert.equal(folded.unresolved, 1)
  assert.equal(folded.nodes.length, 1)
})

test('派生消息：保留角色与来源，丢弃空 system/developer/assistant', () => {
  const emptySystem = surface(5, 'system/message', {
    message: { role: 'system', content: [], source: { kind: 'system-prompt' }, id: 'm5' },
  })
  const { nodes } = foldSurface([SYSTEM, USER, ASSISTANT, TOOL, emptySystem])
  const messages = deriveMessages(nodes)
  assert.deepEqual(messages.map(message => message.role), ['system', 'user', 'assistant', 'tool'])
  assert.equal(messages[3].sourceKind, 'tool')
  assert.equal(messages[2].bytes > 0, true)
  assert.match(contentText(messages[2].content), /pwd/)
})

test('DeepSeek wire：system 顶层、developer→system、tool→user tool_result', () => {
  const developer = surface(5, 'developer/message', {
    message: {
      role: 'developer',
      content: [{ type: 'tool-addition', toolName: 'bash' }],
      source: { kind: 'tool-registry' },
      id: 'm5',
    },
  })
  const { nodes } = foldSurface([SYSTEM, USER, ASSISTANT, TOOL, developer])
  const messages = deriveMessages(nodes)
  const wire = buildDeepSeekWire({
    config: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high', maxTokens: 256000 },
    tools: [{ name: 'bash', description: 'Run', parameters: { type: 'object' }, deferLoading: true }],
    systemText: 'SYS',
    messages,
    sessionId: 'session-1',
  })
  assert.equal(wire.body.system, 'SYS')
  assert.equal(wire.body.model, 'deepseek-flash')
  assert.equal(wire.body.stream, true)
  assert.equal(wire.body.max_tokens, 256000)
  assert.deepEqual(wire.body.thinking, { type: 'enabled' })
  assert.deepEqual(wire.body.output_config, { effort: 'high' })
  assert.deepEqual(wire.body.tools, [{
    name: 'bash', description: 'Run', input_schema: { type: 'object' }, defer_loading: true,
  }])

  const roles = wire.body.messages.map(message => message.role)
  assert.deepEqual(roles, ['user', 'assistant', 'user', 'system'])
  assert.deepEqual(wire.body.messages[0].content, [{ type: 'text', text: 'hello' }])
  assert.deepEqual(wire.body.messages[1].content[1], { type: 'thinking', thinking: 'think' })
  assert.deepEqual(wire.body.messages[1].content[2], {
    type: 'tool_use', id: 'call_1', name: 'bash', input: { command: 'pwd' },
  })
  assert.deepEqual(wire.body.messages[2].content[0], {
    type: 'tool_result', tool_use_id: 'call_1', content: [{ type: 'text', text: '/b' }],
  })
  assert.deepEqual(wire.body.messages[3].content, [{
    type: 'tool_addition', tool: { type: 'tool_reference', name: 'bash' },
  }])
  assert.equal(wire.headers.some(header => header.name === 'x-deepseek-harness-session-id' && header.value === 'session-1'), true)
  assert.equal(wire.notes.some(note => note.includes('按会话日志重建')), true)
})

test('DeepSeek wire：reasoningEffort=off 时 thinking 关闭且没有 output_config', () => {
  const wire = buildDeepSeekWire({
    config: { provider: 'deepseek-official', model: 'flash', reasoningEffort: 'off' },
    tools: [], systemText: '', messages: [], sessionId: 's',
  })
  assert.deepEqual(wire.body.thinking, { type: 'disabled' })
  assert.equal('output_config' in wire.body, false)
  assert.equal('system' in wire.body, false)
  assert.equal('tools' in wire.body, false)
})

test('buildPayload：deepseek 出 wire，其他 provider 只出中性结构', () => {
  const entries = [SYSTEM, USER, ASSISTANT, TOOL]
  const request = {
    seq: 4,
    prompt: {
      config: { provider: 'deepseek-official', model: 'deepseek-flash', reasoningEffort: 'high' },
      system: 'SYS',
      tools: [{ name: 'bash', description: 'Run', parameters: {} }],
    },
  }
  const deepseek = buildPayload(entries, request, 'session-1')
  assert.equal(deepseek.isDeepSeek, true)
  assert.equal(deepseek.messages.length, 4)
  assert.deepEqual(deepseek.summary.byRole.assistant.count, 1)
  assert.equal(deepseek.wire.body.messages.length, 3)

  const other = buildPayload(entries, {
    ...request,
    prompt: { ...request.prompt, config: { provider: 'opencode-go', model: 'kimi-k2.7-code' } },
  }, 'session-1')
  assert.equal(other.isDeepSeek, false)
  assert.equal(other.wire, null)
  assert.equal(other.neutral.messages.length, 4)
  assert.deepEqual(other.neutral.tools, request.prompt.tools)
})

test('消息统计按角色汇总', () => {
  const messages = [
    { role: 'user', bytes: 10 },
    { role: 'tool', bytes: 20 },
    { role: 'tool', bytes: 5 },
  ]
  const summary = summarizeMessages(messages)
  assert.equal(summary.count, 3)
  assert.equal(summary.bytes, 35)
  assert.deepEqual(summary.byRole.tool, { count: 2, bytes: 25 })
})
