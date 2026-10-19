/**
 * dsh-prompt-lab — 宿主半侧。
 *
 * 只做两件事，都挂在 system-prompt 装配链路上：
 *   1. 注册一段“用户追加指令”，文本实时读 Config（volatile），空文本时不产生任何贡献；
 *   2. 在 system-prompt/assemble 的结果上改写工具 description，从不改 parameters
 *      （执行侧用注册表里的原始 schema 校验参数，改 schema 会让模型与执行脱钩）。
 *
 * 配置持久化由 DSH 的 config-editor 负责（volatile 字段写进 profile patch），
 * 本插件不写自己的文件、不注册 HTTP 路由。
 */

import Schema from '@deepseek-ai/schemastery'

/** Cordis 插件名（等于 npm 包名）。 */
export const name = '@wjunhere/dsh-prompt-lab'

/** 依赖的系统提示词注册表服务。 */
export const inject = ['systemPrompt']

/** 追加段落的名字：全局唯一，order 排在所有内置段之后。 */
export const SECTION_NAME = 'prompt-lab:user-prompt'

/** 内置段最大 order 是 10200（persona suffix），这里排在最后。 */
export const SECTION_ORDER = 1_000_000

/** 插件配置；两个字段都是 volatile，保存后无需重启即可被下一轮装配读到。 */
export const Config = Schema.object({
  promptText: Schema.string()
    .default('')
    .volatile()
    .description('追加到每轮系统提示词末尾的指令。留空时不产生任何贡献。'),
  toolDescriptions: Schema.string()
    .default('{}')
    .volatile()
    .description('工具描述的覆盖表，JSON 对象：{"工具名": "新描述"}。只影响模型侧展示，不影响执行。'),
})

/**
 * 解析工具描述覆盖表。
 * @param {unknown} text 配置里的 JSON 文本。
 * @returns {Record<string, string> | null} 合法映射；空值或非法 JSON 返回 null（视为不覆盖）。
 */
export function parseToolOverrides(text) {
  if (typeof text !== 'string' || text.trim() === '') return null
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const overrides = {}
  for (const [toolName, description] of Object.entries(parsed)) {
    if (toolName !== '' && typeof description === 'string') overrides[toolName] = description
  }
  return Object.keys(overrides).length === 0 ? null : overrides
}

/**
 * 把覆盖表应用到一份装配结果的工具列表上。
 * @param {{ tools?: readonly object[] } | undefined} assembly 装配结果。
 * @param {Record<string, string>} overrides 覆盖表。
 * @returns {{ assembly?: object, changed: boolean }} 新装配结果（未变化时原样返回）。
 */
export function applyToolOverrides(assembly, overrides) {
  if (assembly === undefined || assembly === null) return { assembly, changed: false }
  const tools = Array.isArray(assembly.tools) ? assembly.tools : []
  let changed = false
  const nextTools = tools.map((tool) => {
    const description = overrides[tool.name]
    if (typeof description !== 'string' || description === tool.description) return tool
    changed = true
    return { ...tool, description }
  })
  return changed ? { assembly: { ...assembly, tools: nextTools }, changed } : { assembly, changed: false }
}

/**
 * 挂载插件。
 * @param {import('@deepseek-ai/cordis').Context} ctx 宿主上下文。
 * @param {{ promptText: { get(): unknown }, toolDescriptions: { get(): unknown } }} config 插件配置。
 */
export function apply(ctx, config) {
  const reported = new Set()

  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: SECTION_ORDER,
    interpolate: false,
    text: () => {
      const value = config.promptText.get()
      return typeof value === 'string' ? value : ''
    },
  }), 'prompt-lab: user prompt section')

  ctx.effect(() => ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const downstream = await next()
    const raw = config.toolDescriptions.get()
    const overrides = parseToolOverrides(raw)
    if (overrides === null) {
      if (typeof raw === 'string' && raw.trim() !== '' && raw.trim() !== '{}' && !reported.has(raw)) {
        reported.add(raw)
        ctx.logger?.warn?.('prompt-lab: toolDescriptions is not a valid JSON object; overrides ignored')
      }
      return downstream
    }
    return applyToolOverrides(downstream, overrides).assembly
  }), 'prompt-lab: tool description overrides')
}
