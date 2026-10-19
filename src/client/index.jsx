/**
 * 浏览器半侧入口：注册会话顶栏的「提示词」页。
 *
 * 只新增一个 conversation.view 槽位条目 + 一个样式表；不注册服务、不拦截事件、
 * 不改动任何其他视图。编辑能力复用 ctx.configForms 写入宿主配置。
 */

import { NS, en, zh } from './locales.js'
import { CSS_TEXT } from './styles.js'
import { PromptLabView } from './view.jsx'

/** 需要的客户端服务。 */
export const inject = ['slots', 'locale', 'sessions', 'uiConversation', 'configForms']

/** profile 条目 id，也是设置命名空间。 */
const ENTRY_ID = 'prompt-lab'

/** 样式表节点 id，用于重复挂载时去重。 */
const STYLE_ID = 'dsh-prompt-lab-styles'

/** 设置服务不可用时的只读占位表单。 */
function unavailableForm() {
  const snapshot = { status: 'unavailable', value: undefined, base: undefined, user: undefined, revision: undefined, writable: false }
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    set: async () => false,
    unset: async () => false,
    mutate: async () => false,
  }
}

/**
 * 挂载客户端插件。
 * @param {any} ctx 客户端 Cordis 上下文。
 */
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'prompt-lab: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.effect(() => {
    if (document.getElementById(STYLE_ID) !== null) return () => {}
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS_TEXT
    document.head.appendChild(style)
    return () => style.remove()
  }, 'prompt-lab: styles')

  const form = typeof ctx.configForms?.get === 'function'
    ? ctx.configForms.get(ENTRY_ID)
    : unavailableForm()

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: ENTRY_ID,
    order: 20,
    locale: NS,
    label: () => t('view.label'),
    inject: (sessionId) => {
      const binding = ctx.sessions.binding(sessionId)
      // 会话尚未物化时给出空窗口，让页面显示空状态而不是让整个视图抛错。
      const emptyWindow = { entries: [], hasMore: false, revision: 0, change: { kind: 'replace', entries: [] } }
      return {
        events: binding === undefined
          ? { getSnapshot: () => emptyWindow, subscribe: () => () => {} }
          : binding.eventSource,
        session: binding?.session,
        inspectSystem: (previous, event) => ctx.uiConversation.inspectSystemPrompt(previous, event),
        inspectRequest: (previous, event, effectiveSystem) =>
          ctx.uiConversation.inspectRequestPrompt(previous, event, effectiveSystem),
        configForm: form,
      }
    },
  }, PromptLabView))
}
