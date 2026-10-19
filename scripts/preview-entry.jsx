/**
 * 静态预览入口（仅开发用）：用一份接近真实的会话数据渲染视图，
 * 供本地截图检查布局与主题令牌下的观感。
 */

import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { PromptLabView } from '../src/client/view.jsx'
import { zh } from '../src/client/locales.js'

const t = (key, vars) => {
  const template = zh[key] ?? key
  if (vars === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`))
}

const TOOLS = [
  {
    name: 'bash',
    description: 'Run a bash command in a persistent shell. Use for file and process operations.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to run.' },
        description: { type: 'string', description: 'Why this command is being run.' },
        timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds.' },
        runInBackground: { type: 'boolean' },
      },
      required: ['command', 'description'],
    },
  },
  {
    name: 'read',
    description: 'Read a UTF-8 text file, returning line-numbered content with offset and limit.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        offset: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'edit',
    description: 'Replace literal text in an existing UTF-8 file. The old string must appear exactly once.',
    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
        replace_all: { type: 'boolean' },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'grep',
    description: 'Search file contents with a ripgrep regular expression and return matching lines.',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string' }, path: { type: 'string' }, include: { type: 'string' } },
      required: ['pattern'],
    },
  },
  {
    name: 'glob',
    description: 'Find files whose paths match a glob pattern, ordered by modification time.',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string' }, path: { type: 'string' } },
      required: ['pattern'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch an HTTP(S) URL and return its decoded text content.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
]

const ADDITION = '## Your instructions\n\nLead with the conclusion, then the key evidence. When unsure, say so explicitly.'

const SYSTEM_PROMPT = `You are an AI agent powered by DeepSeek Harness.

You are helping the user inside the DeepSeek Harness desktop app.

## Working style

- Prefer read/edit/write over shell pipelines when changing files.
- Read a file before editing it.
- Use the read tool rather than cat to inspect text files.
- Keep answers concise and lead with the result.

## Tools

The following tools are available. Call them by name and pass lossless JSON arguments.

### bash
Run a bash command in a persistent shell.

### read
Read a UTF-8 text file with line numbers.

## Environment

- Harness source: /opt/deepseek-harness
- Working directory: /home/user/project
- Platform: win32`

const SYSTEM_WITH_ADDITION = `${SYSTEM_PROMPT}\n\n${ADDITION}`

function makeEntries() {
  const now = Date.now()
  return [
    {
      type: 'event',
      event: {
        type: 'system/message', seq: 1, time: now - 600000, surfaceOp: 'append',
        data: { turn: 1, step: 1, message: { role: 'system', content: [{ type: 'text', text: SYSTEM_PROMPT }], source: { kind: 'system-prompt' }, id: 'm1' } },
      },
    },
    {
      type: 'event',
      event: {
        type: 'user/message', seq: 2, time: now - 600000, surfaceOp: 'append',
        data: { role: 'user', id: 'u1', content: [{ type: 'text', text: '看一下这个仓库的结构，然后告诉我入口在哪。' }], source: { kind: 'user' } },
      },
    },
    {
      type: 'event',
      event: {
        type: 'request/header', seq: 3, time: now - 600000,
        data: { reason: 'initial', header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash', reasoningEffort: 'high', maxTokens: 384000 }, tools: TOOLS.slice(0, 5) } },
      },
    },
    {
      type: 'event',
      event: {
        type: 'assistant/message', seq: 4, time: now - 590000, surfaceOp: 'append',
        data: {
          turn: 1, step: 1,
          message: {
            role: 'assistant', id: 'a1',
            content: [
              { type: 'reasoning', text: '先看目录，再定位入口文件。' },
              { type: 'text', text: '我先列一下顶层目录。' },
              { type: 'tool-call', id: 'call_1', name: 'bash', arguments: '{"command":"ls -la","description":"List top-level entries"}' },
            ],
            source: { kind: 'model' },
          },
        },
      },
    },
    {
      type: 'event',
      event: {
        type: 'tool/result', seq: 5, time: now - 590000, surfaceOp: 'append',
        data: {
          turn: 1, step: 1,
          message: {
            role: 'tool', id: 'r1', toolCallId: 'call_1', content: [{ type: 'text', text: 'total 24\ndrwxr-xr-x  1 user user 0 Oct 18 18:42 .\ndrwxr-xr-x  1 user user 0 Oct 16 20:37 ..\ndrwxr-xr-x  1 user user 0 Sep 23 17:28 sample-library\ndrwxr-xr-x  1 user user 0 Sep 29 11:30 archive-tools\ndrwxr-xr-x  1 user user 0 Oct 18 19:53 dsh-prompt-lab' }],
            source: { kind: 'tool', callId: 'call_1' },
          },
        },
      },
    },
    {
      type: 'event',
      event: {
        type: 'assistant/message', seq: 6, time: now - 580000, surfaceOp: 'append',
        data: {
          turn: 1, step: 2,
          message: {
            role: 'assistant', id: 'a2',
            content: [{ type: 'text', text: '从目录看，`dsh-prompt-lab` 是刚建的项目。入口在 `src/client/index.jsx` 和 `src/host/index.js`。' }],
            source: { kind: 'model' },
          },
        },
      },
    },
    {
      type: 'event',
      event: {
        type: 'system/message', seq: 7, time: now - 300000, surfaceOp: 'append',
        data: { turn: 2, step: 1, message: { role: 'system', content: [{ type: 'text', text: SYSTEM_WITH_ADDITION }], source: { kind: 'system-prompt' }, id: 'm2' } },
      },
    },
    {
      type: 'event',
      event: {
        type: 'user/message', seq: 8, time: now - 300000, surfaceOp: 'append',
        data: { role: 'user', id: 'u2', content: [{ type: 'text', text: '继续，把工具目录也整理一下。' }], source: { kind: 'user' } },
      },
    },
    {
      type: 'event',
      event: {
        type: 'request/header', seq: 9, time: now - 300000,
        data: { reason: 'change', header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash', reasoningEffort: 'high', maxTokens: 384000 }, tools: TOOLS } },
      },
    },
  ]
}

function inspectSystem(previous, entry) {
  const text = entry.type === 'system/message'
    ? entry.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('')
    : previous?.effective?.text ?? ''
  return { effective: { seq: entry.seq, time: entry.time, turn: entry.data?.turn ?? 1, step: entry.data?.step ?? 1, text, update: false } }
}

function inspectRequest(previous, entry, system) {
  return {
    prompt: {
      config: entry.data.header.config,
      tools: entry.data.header.tools ?? [],
      system: system?.text ?? SYSTEM_PROMPT,
    },
    ...(previous === undefined ? {} : { change: { kind: entry.seq === 9 ? 'system-and-tools' : 'tools' } }),
  }
}

const entries = makeEntries()
const windowSnapshot = { entries, hasMore: true, revision: 1, change: { kind: 'replace', entries } }
const configSnapshot = {
  status: 'ready',
  value: {
    promptText: ADDITION,
    toolDescriptions: '{"bash":"Run a bash command in a persistent shell. Prefer the dedicated file tools for edits."}',
  },
  writable: true,
  revision: 3,
}

const params = new URLSearchParams(location.search)
const mode = params.get('mode') ?? 'system'

function Preview() {
  const tab = mode === 'tools' || mode === 'diff'
    ? mode
    : mode.startsWith('payload') ? 'payload' : 'system'
  return (
    <PromptLabView
      t={t}
      events={{ getSnapshot: () => windowSnapshot, subscribe: () => () => {} }}
      session={{ sessionId: 'session-preview', loadOlder: async () => {} }}
      inspectSystem={inspectSystem}
      inspectRequest={inspectRequest}
      configForm={{ getSnapshot: () => configSnapshot, subscribe: () => () => {}, set: async () => true }}
      initialTab={tab}
      initialEditorOpen={mode === 'editor'}
      initialPayloadView={mode === 'payload-wire' ? 'wire' : 'messages'}
    />
  )
}

createRoot(document.getElementById('root')).render(<Preview />)
