/** 右侧编辑抽屉：追加指令 + 工具描述覆盖。写入走官方 configForms，不碰文件。 */

import * as React from 'react'
import { CloseIcon } from './icons.jsx'

/**
 * @param {object} props
 * @param {(key: string, vars?: object) => string} props.t 翻译函数。
 * @param {any} props.form 客户端配置表单。
 * @param {any} props.snapshot 配置表单快照。
 * @param {readonly any[]} props.tools 当前请求的工具目录。
 * @param {(state: object | null) => void} props.onClose 关闭抽屉。
 * @param {() => void} [props.onSaved] 保存成功回调。
 */
export function EditorPanel({ t, form, snapshot, tools, onClose, onSaved }) {
  const initial = React.useMemo(() => {
    const value = snapshot.value ?? {}
    const overrides = {}
    try {
      const parsed = JSON.parse(typeof value.toolDescriptions === 'string' ? value.toolDescriptions : '{}')
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [name, description] of Object.entries(parsed)) {
          if (typeof description === 'string') overrides[name] = description
        }
      }
    } catch {
      // 已保存的覆盖表不是合法 JSON 时按“无覆盖”展示；宿主侧也会忽略它。
    }
    return { prompt: typeof value.promptText === 'string' ? value.promptText : '', overrides }
  }, [])

  const [promptDraft, setPromptDraft] = React.useState(initial.prompt)
  const [toolDrafts, setToolDrafts] = React.useState(initial.overrides)
  const [status, setStatus] = React.useState(null)
  const [busy, setBusy] = React.useState(false)

  const ready = snapshot.status === 'ready'
  const writable = ready && snapshot.writable === true
  const disabled = !writable || busy

  const commit = React.useCallback(async (promptText, overrides) => {
    setBusy(true)
    setStatus(null)
    try {
      const acceptedPrompt = await form.set('promptText', promptText)
      const acceptedTools = await form.set('toolDescriptions', JSON.stringify(overrides))
      if (acceptedPrompt === true && acceptedTools === true) {
        setStatus({ tone: 'ok', text: t('editor.saved') })
        onSaved?.()
      } else {
        setStatus({ tone: 'error', text: t('editor.failed', { reason: 'host refused the write' }) })
      }
    } catch (error) {
      setStatus({ tone: 'error', text: t('editor.failed', { reason: error?.message ?? String(error) }) })
    } finally {
      setBusy(false)
    }
  }, [form, onSaved, t])

  const save = React.useCallback(() => {
    const overrides = {}
    for (const tool of tools) {
      const draft = (toolDrafts[tool.name] ?? '').trim()
      if (draft !== '' && draft !== (tool.description ?? '')) overrides[tool.name] = draft
    }
    void commit(promptDraft, overrides)
  }, [commit, promptDraft, toolDrafts, tools])

  const reset = React.useCallback(() => {
    setPromptDraft('')
    setToolDrafts({})
    setStatus(null)
    void commit('', {})
  }, [commit])

  return (
    <aside className="dpl-drawer" aria-label={t('editor.title')}>
      <div className="dpl-drawer-head">
        <span className="dpl-drawer-title">{t('editor.title')}</span>
        <button type="button" className="dpl-icon-btn" onClick={onClose} aria-label={t('action.close')}>
          <CloseIcon />
        </button>
      </div>

      <div className="dpl-drawer-body">
        <div className="dpl-field">
          <div className="dpl-field-head">
            <label className="dpl-field-label" htmlFor="dpl-prompt-text">{t('editor.prompt')}</label>
            <span className="dpl-field-count">{t('editor.charCount', { count: promptDraft.length })}</span>
          </div>
          <p className="dpl-hint">{t('editor.promptHint')}</p>
          <textarea
            id="dpl-prompt-text"
            className="dpl-textarea"
            value={promptDraft}
            onChange={event => setPromptDraft(event.target.value)}
            placeholder={t('editor.promptPlaceholder')}
            spellCheck={false}
            disabled={!writable}
          />
        </div>

        <div className="dpl-field">
          <div className="dpl-field-head">
            <span className="dpl-field-label">{t('editor.tools')}</span>
          </div>
          <p className="dpl-hint">{t('editor.toolsHint')}</p>
          {tools.length === 0
            ? <p className="dpl-hint">{t('editor.toolsEmpty')}</p>
            : tools.map(tool => (
              <div className="dpl-tool-edit" key={tool.name}>
                <div className="dpl-tool-edit-head">
                  <span className="dpl-tool-edit-name">{tool.name}</span>
                  <span className="dpl-tool-edit-original" title={tool.description ?? ''}>
                    {t('editor.original')}: {tool.description ?? ''}
                  </span>
                </div>
                <textarea
                  className="dpl-textarea dpl-textarea--tool"
                  value={toolDrafts[tool.name] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setToolDrafts(current => ({ ...current, [tool.name]: value }))
                  }}
                  placeholder={tool.description ?? ''}
                  spellCheck={false}
                  disabled={!writable}
                />
              </div>
            ))}
        </div>
      </div>

      <div className="dpl-drawer-foot">
        <span className="dpl-status" data-tone={status?.tone}>
          {status?.text
            ?? (!ready ? (snapshot.status === 'loading' ? t('editor.loading') : t('editor.unavailable'))
              : !writable ? t('editor.readonly') : '')}
        </span>
        <button type="button" className="dpl-icon-btn" onClick={reset} disabled={!writable || busy}>
          {t('action.reset')}
        </button>
        <button type="button" className="dpl-icon-btn" data-primary="true" onClick={save} disabled={disabled}>
          {busy ? t('action.saving') : t('action.save')}
        </button>
      </div>
    </aside>
  )
}
