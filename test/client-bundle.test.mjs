/**
 * 客户端产物的烟测：把 lib/client.js 当成浏览器里的 lazy factory 加载，
 * 用一份真实的会话事件窗口做静态渲染，确认工厂格式、槽位注册与视图渲染都成立。
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'

import { zh } from '../src/client/locales.js'

let captured
globalThis.window = { __ModuleLoader__: { load(spec) { captured = spec } } }
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '', remove() {} }),
  head: { appendChild() {} },
}

await import(new URL('../lib/client.js', import.meta.url).href)

const t = (key, vars) => {
  const template = zh[key] ?? key
  if (vars === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`))
}

function systemEvent(seq, text) {
  return {
    type: 'event',
    event: {
      type: 'system/message',
      seq,
      time: seq,
      surfaceOp: 'append',
      data: { turn: 1, step: 1, message: { role: 'system', content: [{ type: 'text', text }] } },
    },
  }
}

function headerEvent(seq, reason, tools) {
  return {
    type: 'event',
    event: {
      type: 'request/header',
      seq,
      time: seq,
      data: { reason, header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' }, tools } },
    },
  }
}

function inspectSystem(previous, entry) {
  const text = entry.type === 'system/message'
    ? entry.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('')
    : previous?.effective?.text ?? ''
  return { effective: { seq: entry.seq, time: entry.time, turn: 1, step: 1, text, update: false } }
}

function inspectRequest(previous, entry, system) {
  return {
    prompt: {
      config: entry.data.header.config,
      tools: entry.data.header.tools ?? [],
      system: system?.text ?? '',
    },
  }
}

function userEvent(seq, text) {
  return {
    type: 'event',
    event: {
      type: 'user/message', seq, time: seq, surfaceOp: 'append',
      data: { role: 'user', id: `u${seq}`, content: [{ type: 'text', text }], source: { kind: 'user' } },
    },
  }
}

function assistantEvent(seq, text) {
  return {
    type: 'event',
    event: {
      type: 'assistant/message', seq, time: seq, surfaceOp: 'append',
      data: {
        turn: 1, step: 1,
        message: {
          role: 'assistant', id: `a${seq}`,
          content: [
            { type: 'text', text },
            { type: 'tool-call', id: `call_${seq}`, name: 'bash', arguments: '{"command":"pwd"}' },
          ],
          source: { kind: 'model' },
        },
      },
    },
  }
}

function toolEvent(seq) {
  return {
    type: 'event',
    event: {
      type: 'tool/result', seq, time: seq, surfaceOp: 'append',
      data: {
        turn: 1, step: 1,
        message: {
          role: 'tool', id: `t${seq}`, toolCallId: `call_${seq - 1}`, content: [{ type: 'text', text: '/b' }],
          source: { kind: 'tool', callId: `call_${seq - 1}` },
        },
      },
    },
  }
}

/** 用同一份事件窗口挂载插件，返回注册与注入面。 */
function mount(entries) {
  const windowSnapshot = { entries, hasMore: false, revision: 1, change: { kind: 'replace', entries } }
  const eventSource = { getSnapshot: () => windowSnapshot, subscribe: () => () => {} }
  const config = { promptText: 'Be concise.', toolDescriptions: '{"bash":"Run a command"}' }
  const configForm = {
    getSnapshot: () => ({ status: 'ready', value: config, writable: true, revision: 1 }),
    subscribe: () => () => {},
    set: async () => true,
  }
  let registration
  const ctx = {
    effect(fn) { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
    locale: { register() {}, bind: () => t },
    configForms: { get: () => configForm },
    slots: {
      inject(_name, fn) { fn() },
      register(options, Component) {
        registration = { options, Component }
        return () => {}
      },
    },
    sessions: {
      binding: () => ({ eventSource, session: { sessionId: 'session-1', loadOlder: async () => {} } }),
    },
    uiConversation: { inspectSystemPrompt: inspectSystem, inspectRequestPrompt: inspectRequest },
  }
  const plugin = captured.factory(id => (id === 'react' ? React : undefined))
  plugin.apply(ctx)
  return { registration, face: registration.options.inject('session-1') }
}

test('客户端产物是合法的 lazy-CJS factory', () => {
  assert.equal(captured.id, '@wjunhere/dsh-prompt-lab')
  const plugin = captured.factory(id => {
    if (id === 'react') return React
    throw new Error(`unexpected external module: ${id}`)
  })
  assert.equal(typeof plugin.apply, 'function')
  assert.deepEqual(plugin.inject, ['slots', 'locale', 'sessions', 'uiConversation', 'configForms'])
})

test('槽位注册并静态渲染出系统提示词与工具', () => {
  const entries = [
    systemEvent(1, 'You are an agent.\n\nBe concise.'),
    headerEvent(2, 'initial', [{
      name: 'bash',
      description: 'Run a shell command',
      parameters: { type: 'object', properties: { command: { type: 'string' } } },
    }]),
  ]
  const { registration, face } = mount(entries)

  assert.equal(registration.options.name, 'conversation.view')
  assert.equal(registration.options.id, 'prompt-lab')
  assert.equal(registration.options.order, 20)
  assert.equal(registration.options.label(), '提示词')

  const html = renderToStaticMarkup(React.createElement(registration.Component, { ...face, t }))

  assert.match(html, /提示词与工具/)
  assert.match(html, /系统提示词/)
  assert.match(html, /You are an agent\./)
  assert.match(html, /deepseek-v4-flash/)
  assert.match(html, /含你的追加指令/)
  assert.match(html, /编辑/)
})

test('载荷页渲染出消息序列，wire 预览包含 system 与映射后的角色', () => {
  const entries = [
    systemEvent(1, 'You are an agent.'),
    userEvent(2, 'hello'),
    assistantEvent(3, 'working on it'),
    toolEvent(4),
    userEvent(5, 'continue'),
    headerEvent(6, 'initial', [{
      name: 'bash',
      description: 'Run a shell command',
      parameters: { type: 'object', properties: { command: { type: 'string' } } },
    }]),
  ]
  const { registration, face } = mount(entries)

  const messagesHtml = renderToStaticMarkup(React.createElement(registration.Component, {
    ...face, t, initialTab: 'payload',
  }))
  assert.match(messagesHtml, /载荷/)
  assert.match(messagesHtml, /消息序列/)
  assert.match(messagesHtml, /Wire 预览/)
  assert.match(messagesHtml, /条消息/)
  assert.match(messagesHtml, /助手/)
  assert.match(messagesHtml, /工具/)
})

