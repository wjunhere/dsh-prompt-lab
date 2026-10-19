import assert from 'node:assert/strict'
import test from 'node:test'

import {
  diffLines, diffTools, estimateTokens, foldRequestPrompt, isSystemSurfaceEvent,
  latestRequestIndex, locateAddition, toolsSignature,
} from '../src/client/data.js'
import { applyToolOverrides, parseToolOverrides } from '../src/host/index.js'

/** 事件窗口里的一条持久事件。 */
function event(seq, type, data, extra = {}) {
  return { type: 'event', event: { type, seq, time: seq, data, ...extra } }
}

/** 与官方签名一致的简化 system 折叠。 */
function inspectSystem(previous, entry) {
  const text = entry.type === 'system/message'
    ? entry.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('')
    : previous?.effective?.text ?? ''
  return {
    effective: { seq: entry.seq, time: entry.time, turn: 1, step: 1, text, update: false },
    introduced: undefined,
  }
}

/** 与官方签名一致的简化请求检查。 */
function inspectRequest(previous, entry, system) {
  return {
    prompt: {
      config: entry.data.header.config,
      tools: entry.data.header.tools ?? [],
      system: system?.text ?? '',
    },
    ...(previous === undefined ? {} : { change: { kind: 'tools' } }),
  }
}

function systemEvent(seq, text) {
  return event(seq, 'system/message', {
    turn: 1,
    step: 1,
    message: { role: 'system', content: [{ type: 'text', text }] },
  }, { surfaceOp: 'append' })
}

function headerEvent(seq, config, tools, reason = 'initial') {
  return event(seq, 'request/header', { reason, header: { config, tools } })
}

test('识别系统 surface 事件', () => {
  assert.equal(isSystemSurfaceEvent({ type: 'system/message' }), true)
  assert.equal(isSystemSurfaceEvent({ type: 'user/message', surfaceOp: 'replace' }), true)
  assert.equal(isSystemSurfaceEvent({ type: 'user/message', surfaceOp: 'append' }), false)
  assert.equal(isSystemSurfaceEvent({ type: 'user/message' }), false)
})

test('按请求折叠出系统提示词与工具目录', () => {
  const tools = [{ name: 'bash', description: 'Run', parameters: { type: 'object' } }]
  const entries = [
    systemEvent(1, 'You are an agent.'),
    headerEvent(2, { provider: 'deepseek', model: 'flash' }, tools),
    systemEvent(3, 'You are an agent.\n\nExtra line.'),
    headerEvent(4, { provider: 'deepseek', model: 'flash' }, tools, 'change'),
  ]
  const { requests, effectiveSystem } = foldRequestPrompt(entries, inspectSystem, inspectRequest)
  assert.equal(requests.length, 2)
  assert.equal(requests[0].prompt.system, 'You are an agent.')
  assert.equal(requests[1].prompt.system, 'You are an agent.\n\nExtra line.')
  assert.equal(requests[1].prompt.tools[0].name, 'bash')
  assert.equal(requests[0].change, undefined)
  assert.equal(requests[1].change.kind, 'tools')
  assert.equal(effectiveSystem.text, 'You are an agent.\n\nExtra line.')
  assert.equal(latestRequestIndex(requests), 1)
})

test('忽略瞬态事件与无关事件', () => {
  const entries = [
    { type: 'transient', event: { type: 'assistant/live-chunk', seq: 1, data: {} } },
    event(2, 'turn/start', { turn: 1 }),
    systemEvent(3, 'sys'),
    headerEvent(4, { model: 'm' }, []),
  ]
  const { requests } = foldRequestPrompt(entries, inspectSystem, inspectRequest)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].prompt.system, 'sys')
})

test('定位追加指令', () => {
  const text = 'base\n\nmy rule here\n'
  assert.deepEqual(locateAddition(text, 'my rule here'), { start: 6, end: 18 })
  assert.equal(locateAddition(text, '   '), null)
  assert.equal(locateAddition(text, 'missing'), null)
})

test('行级 diff 标记增删', () => {
  const rows = diffLines('a\nb\nc', 'a\nB\nc')
  assert.deepEqual(rows, [
    { kind: 'context', text: 'a' },
    { kind: 'removed', text: 'b' },
    { kind: 'added', text: 'B' },
    { kind: 'context', text: 'c' },
  ])
})

test('工具差异按名字比较描述与参数', () => {
  const previous = [
    { name: 'bash', description: 'Run', parameters: { a: 1 } },
    { name: 'read', description: 'Read', parameters: {} },
  ]
  const next = [
    { name: 'bash', description: 'Run a command', parameters: { a: 1 } },
    { name: 'write', description: 'Write', parameters: {} },
  ]
  assert.deepEqual(diffTools(previous, next), { added: ['write'], removed: ['read'], changed: ['bash'] })
  assert.equal(toolsSignature(next).includes('write'), true)
})

test('token 估算偏 CJK', () => {
  assert.equal(estimateTokens('abcd'), 1)
  assert.equal(estimateTokens('你好'), 2)
  assert.equal(estimateTokens(''), 0)
})

test('工具描述覆盖只接受字符串值', () => {
  assert.deepEqual(parseToolOverrides('{"bash":"Run commands"}'), { bash: 'Run commands' })
  assert.equal(parseToolOverrides('{"bash":42}'), null)
  assert.equal(parseToolOverrides('not json'), null)
  assert.equal(parseToolOverrides('{}'), null)
  assert.equal(parseToolOverrides(''), null)
})

test('装配结果改写 description 但不改 parameters', () => {
  const assembly = {
    sections: [],
    tools: [
      { name: 'bash', description: 'old', parameters: { type: 'object', properties: { command: { type: 'string' } } } },
      { name: 'read', description: 'Read', parameters: {} },
    ],
  }
  const { assembly: next, changed } = applyToolOverrides(assembly, { bash: 'new' })
  assert.equal(changed, true)
  assert.equal(next.tools[0].description, 'new')
  assert.deepEqual(next.tools[0].parameters, assembly.tools[0].parameters)
  assert.equal(next.tools[1], assembly.tools[1])
  assert.equal(applyToolOverrides(assembly, { bash: 'old' }).changed, false)
  assert.equal(applyToolOverrides(undefined, { bash: 'x' }).changed, false)
})
