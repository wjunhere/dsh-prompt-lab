/** 宿主半侧：导出形状、Config 校验、以及 apply 注册的两条装配接线。 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, Config, inject, name, SECTION_NAME, SECTION_ORDER } from '../lib/index.js'

test('导出形状符合 Cordis 插件约定', () => {
  assert.equal(name, '@wjunhere/dsh-prompt-lab')
  assert.deepEqual(inject, ['systemPrompt'])
  assert.equal(typeof apply, 'function')
  assert.equal(typeof Config, 'function')
})

test('Config 提供 volatile 默认值并拒绝错误类型', () => {
  const value = Config({})
  assert.equal(value.promptText.get(), '')
  assert.equal(value.toolDescriptions.get(), '{}')
  assert.equal(Config({ promptText: 'hi' }).promptText.get(), 'hi')
  assert.throws(() => Config({ promptText: 42 }))
  assert.throws(() => Config({ toolDescriptions: [] }))
})

test('Config 把两个字段声明为 volatile', () => {
  const json = Config.toJSON()
  const root = json.refs?.[String(json.uid)] ?? json
  const fields = root.dict
  const prompt = json.refs?.[String(fields.promptText)] ?? fields.promptText
  const tools = json.refs?.[String(fields.toolDescriptions)] ?? fields.toolDescriptions
  assert.equal(prompt.meta?.volatile, true)
  assert.equal(tools.meta?.volatile, true)
})

test('apply 注册追加段与装配覆盖两条接线', async () => {
  const sections = []
  const listeners = new Map()
  let textProvider
  const ctx = {
    effect(fn) {
      const dispose = fn()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    on(event, handler) {
      listeners.set(event, handler)
      return () => {}
    },
    systemPrompt: {
      section(section) {
        sections.push(section)
        textProvider = section.text
        return () => {}
      },
    },
    logger: { warn() {} },
  }
  apply(ctx, { promptText: { get: () => 'my rule' }, toolDescriptions: { get: () => '{"bash":"override"}' } })

  assert.equal(sections.length, 1)
  assert.equal(sections[0].name, SECTION_NAME)
  assert.equal(sections[0].order, SECTION_ORDER)
  assert.equal(sections[0].interpolate, false)
  assert.equal(textProvider(), 'my rule')

  const assemble = listeners.get('system-prompt/assemble')
  assert.equal(typeof assemble, 'function')
  const downstream = { tools: [{ name: 'bash', description: 'original', parameters: { a: 1 } }] }
  const result = await assemble({}, {}, async () => downstream)
  assert.equal(result.tools[0].description, 'override')
  assert.deepEqual(result.tools[0].parameters, { a: 1 })
  assert.equal(downstream.tools[0].description, 'original')
})
