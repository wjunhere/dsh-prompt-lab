/**
 * 会话顶栏的「提示词」页：按请求查看模型实际收到的系统提示词、工具目录与选项，
 * 并在右侧抽屉里编辑追加指令与工具描述。
 *
 * 数据全部来自浏览器已加载的会话事件窗口（request/header + system/message），
 * 不新增宿主捕获、不落 sidecar，因此与官方 Trajectory 的口径一致。
 */

import * as React from 'react'
import { diffLines, diffTools, estimateTokens, foldRequestPrompt, locateAddition } from './data.js'
import { EditorPanel } from './editor.jsx'
import { JsonTree } from './json.jsx'
import { buildPayload, contentText } from './payload.js'
import {
  ChevronLeft, ChevronRight, CopyIcon, EditIcon, RefreshIcon, SearchIcon,
} from './icons.jsx'

const TABS = ['system', 'tools', 'options', 'diff', 'payload']
const TAB_LABEL = {
  system: 'tab.system',
  tools: 'tab.tools',
  options: 'tab.options',
  diff: 'tab.diff',
  payload: 'tab.payload',
}
const REASON_LABEL = {
  initial: 'nav.reason.initial',
  resume: 'nav.reason.resume',
  change: 'nav.reason.change',
  series: 'nav.reason.series',
}

/** 订阅一个 ObservableSnapshot（getSnapshot/subscribe）。 */
function useSnapshot(source) {
  const subscribe = React.useCallback(callback => source.subscribe(callback), [source])
  const getSnapshot = React.useCallback(() => source.getSnapshot(), [source])
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function parseToolOverrides(text) {
  if (typeof text !== 'string' || text.trim() === '') return {}
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string'))
  } catch {
    return {}
  }
}

function formatOption(value) {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return '—'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** 人类可读的字节数。 */
function formatBytes(count) {
  if (!Number.isFinite(count) || count < 0) return '—'
  if (count < 1024) return `${count} B`
  if (count < 1024 * 1024) return `${(count / 1024).toFixed(1)} KB`
  return `${(count / (1024 * 1024)).toFixed(2)} MB`
}

/** 把一行里的搜索命中包成 <mark>。 */
function highlight(text, query) {
  if (query === '') return text
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  const parts = []
  let cursor = 0
  let index = haystack.indexOf(needle, cursor)
  let key = 0
  while (index >= 0) {
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(<mark className="dpl-hit" key={key}>{text.slice(index, index + needle.length)}</mark>)
    key += 1
    cursor = index + needle.length
    index = haystack.indexOf(needle, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function countHits(text, query) {
  if (query === '' || typeof text !== 'string') return 0
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  let count = 0
  let index = haystack.indexOf(needle)
  while (index >= 0) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

function lineIndexAt(text, offset) {
  let line = 0
  for (let i = 0; i < offset; i += 1) if (text.charCodeAt(i) === 10) line += 1
  return line
}

function ChangeBadge({ t, change }) {
  if (change === undefined) return null
  const kind = change.kind
  if (kind === 'initial') return null
  const key = kind === 'system'
    ? 'meta.change.system'
    : kind === 'tools' ? 'meta.change.tools' : 'meta.change.both'
  return <span className="dpl-badge" data-tone="accent">{t(key)}</span>
}

const MESSAGE_PREVIEW_CHARS = 220
const MESSAGE_BODY_CHARS = 20_000

/** 一条派生消息：角色、来源、序号、字节数，展开后看全文。 */
function MessageRow({ t, message, query, onCopy }) {
  const [open, setOpen] = React.useState(false)
  const text = React.useMemo(() => contentText(message.content), [message])
  const preview = text.length > MESSAGE_PREVIEW_CHARS ? `${text.slice(0, MESSAGE_PREVIEW_CHARS)}…` : text
  const body = text.length > MESSAGE_BODY_CHARS ? text.slice(0, MESSAGE_BODY_CHARS) : text
  return (
    <div className="dpl-msg" data-role={message.role}>
      <button type="button" className="dpl-msg-head" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <ChevronRight open={open} className="dpl-chevron" />
        <span className="dpl-role" data-role={message.role}>{t(`payload.role.${message.role}`)}</span>
        {message.sourceKind !== '-' && <span className="dpl-msg-kind">{message.sourceKind}</span>}
        <span className="dpl-msg-meta">{t('payload.seq', { seq: message.seq })} · {formatBytes(message.bytes)}</span>
        {open ? null : <span className="dpl-msg-preview">{highlight(preview, query)}</span>}
      </button>
      {open && (
        <div className="dpl-msg-body">
          <pre className="dpl-msg-text">{highlight(body, query)}</pre>
          {text.length > MESSAGE_BODY_CHARS && (
            <p className="dpl-hint">{t('payload.truncated', { count: MESSAGE_BODY_CHARS })}</p>
          )}
          <div className="dpl-msg-actions">
            <button type="button" className="dpl-icon-btn" onClick={() => onCopy(JSON.stringify(message, null, 2))}>
              <CopyIcon />
              {t('action.copy')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** 「载荷」页：消息序列 + wire 预览。 */
function PayloadPanel({ t, record, entries, revision, session, query, onQuery, onCopy, initialView = 'messages' }) {
  const [view, setView] = React.useState(initialView)
  const payload = React.useMemo(
    () => buildPayload(entries, record, session?.sessionId),
    [entries, revision, record, session],
  )
  const toolBytes = React.useMemo(
    () => new TextEncoder().encode(JSON.stringify(record.prompt.tools ?? [])).length,
    [record],
  )
  const filtered = React.useMemo(() => {
    if (query === '') return payload.messages
    const needle = query.toLowerCase()
    return payload.messages.filter(message => contentText(message.content).toLowerCase().includes(needle))
  }, [payload.messages, query])

  const subhead = (
    <div className="dpl-subhead">
      <span>{t('payload.summary', { count: payload.summary.count, bytes: formatBytes(payload.summary.bytes) })}</span>
      <span>·</span>
      <span>{t('payload.summaryTools', { count: record.prompt.tools?.length ?? 0, bytes: formatBytes(toolBytes) })}</span>
      {payload.folded.replacements > 0 && <span className="dpl-badge">{t('payload.replacements', { count: payload.folded.replacements })}</span>}
      {payload.folded.unresolved > 0 && <span className="dpl-badge" data-tone="warn">{t('payload.unresolved', { count: payload.folded.unresolved })}</span>}
      <span className="dpl-spacer" />
      <div className="dpl-segmented dpl-segmented--compact" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'messages'}
          className="dpl-segment"
          data-active={view === 'messages' ? 'true' : 'false'}
          onClick={() => setView('messages')}
        >
          {t('payload.messages')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'wire'}
          className="dpl-segment"
          data-active={view === 'wire' ? 'true' : 'false'}
          onClick={() => setView('wire')}
        >
          {t('payload.wire')}
        </button>
      </div>
    </div>
  )

  if (view === 'messages') {
    return (
      <>
        {subhead}
        <div className="dpl-search">
          <SearchIcon />
          <input
            value={query}
            onChange={event => onQuery(event.target.value)}
            placeholder={t('payload.searchPlaceholder')}
            aria-label={t('action.search')}
          />
          {query === '' ? null : <span className="dpl-search-count">{filtered.length}</span>}
        </div>
        {filtered.length === 0
          ? <div className="dpl-empty"><div className="dpl-empty-mark">≡</div><div>{t('payload.empty')}</div></div>
          : (
            <div className="dpl-msg-list">
              {filtered.map(message => (
                <MessageRow key={message.seq} t={t} message={message} query={query} onCopy={onCopy} />
              ))}
            </div>
          )}
      </>
    )
  }

  const body = payload.wire === null
    ? payload.neutral
    : payload.wire.body
  return (
    <>
      {subhead}
      {payload.wire === null && (
        <p className="dpl-hint">{t('payload.wireUnsupported', { provider: payload.provider || '—' })}</p>
      )}
      <p className="dpl-hint">{t('payload.rebuilt')}</p>
      {payload.wire !== null && (
        <>
          <div className="dpl-section-label">{t('payload.headers')}</div>
          <div className="dpl-headers">
            {payload.wire.headers.map(header => (
              <div className="dpl-header-row" key={header.name}>
                <span className="dpl-header-name">{header.name}</span>
                <span className="dpl-header-value">{header.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="dpl-section-label">{payload.wire === null ? t('payload.neutralTitle') : t('payload.bodyTab')}</div>
      <div className="dpl-json dpl-json--payload"><JsonTree data={body} /></div>
      {payload.wire !== null && (
        <>
          <div className="dpl-section-label">{t('payload.notes')}</div>
          <ul className="dpl-notes">
            {payload.wire.notes.map((note, index) => <li key={index}>{note}</li>)}
          </ul>
          <div className="dpl-msg-actions">
            <button type="button" className="dpl-icon-btn" onClick={() => onCopy(JSON.stringify(payload.wire.body, null, 2))}>
              <CopyIcon />
              {t('payload.copyJson')}
            </button>
          </div>
        </>
      )}
    </>
  )
}

/**
 * 主视图组件。
 * @param {object} props 槽位注入的运行期 props。
 * @param {string} [props.initialTab] 初始标签页（预览/测试用，默认 system）。
 * @param {boolean} [props.initialEditorOpen] 初始是否打开编辑抽屉（预览/测试用）。
 */
export function PromptLabView({
  t, events, session, inspectSystem, inspectRequest, configForm,
  initialTab = 'system', initialEditorOpen = false, initialPayloadView = 'messages',
}) {
  const windowSnapshot = useSnapshot(events)
  const configSnapshot = useSnapshot(configForm)

  const inspect = React.useRef({ inspectSystem, inspectRequest })
  inspect.current = { inspectSystem, inspectRequest }

  const folded = React.useMemo(
    () => foldRequestPrompt(
      windowSnapshot.entries,
      inspect.current.inspectSystem,
      inspect.current.inspectRequest,
    ),
    [windowSnapshot.revision],
  )

  const [tab, setTab] = React.useState(initialTab)
  const [pinnedSeq, setPinnedSeq] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const [editorOpen, setEditorOpen] = React.useState(initialEditorOpen)
  const [toast, setToast] = React.useState(null)
  const [loadingOlder, setLoadingOlder] = React.useState(false)
  const [showEffective, setShowEffective] = React.useState(false)
  const toastTimer = React.useRef(null)

  const requests = folded.requests
  const total = requests.length
  const index = pinnedSeq === null ? total - 1 : requests.findIndex(record => record.seq === pinnedSeq)
  const record = index >= 0 && index < total ? requests[index] : undefined
  const previous = index > 0 ? requests[index - 1] : undefined
  const isLatest = pinnedSeq === null || (record !== undefined && index === total - 1)

  React.useEffect(() => {
    if (pinnedSeq !== null && index < 0 && total > 0) setPinnedSeq(null)
  }, [pinnedSeq, index, total])

  React.useEffect(() => () => { if (toastTimer.current !== null) clearTimeout(toastTimer.current) }, [])

  const showToast = React.useCallback((text) => {
    setToast(text)
    if (toastTimer.current !== null) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1600)
  }, [])

  const setQueryAndReset = React.useCallback((value) => setQuery(value), [])

  const go = React.useCallback((delta) => {
    if (total === 0) return
    const next = Math.min(total - 1, Math.max(0, index + delta))
    setPinnedSeq(requests[next].seq)
    setShowEffective(false)
  }, [index, requests, total])

  const follow = React.useCallback(() => {
    setPinnedSeq(null)
    setShowEffective(false)
  }, [])

  const config = record?.prompt.config ?? {}
  const addition = typeof configSnapshot.value?.promptText === 'string' ? configSnapshot.value.promptText : ''
  const toolOverrides = parseToolOverrides(configSnapshot.value?.toolDescriptions)

  const effective = folded.effectiveSystem
  const effectiveIsNewer = record !== undefined && effective !== undefined
    && effective.seq > record.seq && effective.text !== '' && effective.text !== record.prompt.system
  const systemText = showEffective && effectiveIsNewer ? effective.text : (record?.prompt.system ?? '')
  const lines = React.useMemo(() => (systemText === '' ? [] : systemText.split('\n')), [systemText])
  const additionRange = React.useMemo(() => locateAddition(systemText, addition), [systemText, addition])
  const additionLine = additionRange === null ? -1 : lineIndexAt(systemText, additionRange.start)
  const hitCount = React.useMemo(() => countHits(systemText, query), [systemText, query])

  const tools = record?.prompt.tools ?? []
  const filteredTools = React.useMemo(() => {
    if (query === '') return tools
    const needle = query.toLowerCase()
    return tools.filter(tool => `${tool.name}\n${tool.description ?? ''}`.toLowerCase().includes(needle))
  }, [tools, query])

  const optionRows = React.useMemo(() => Object.entries(record?.prompt.config ?? {}), [record])

  const systemDiff = React.useMemo(
    () => (record === undefined || previous === undefined
      ? null
      : diffLines(previous.prompt.system, record.prompt.system)),
    [record, previous],
  )
  const toolDiff = React.useMemo(
    () => (record === undefined || previous === undefined
      ? null
      : diffTools(previous.prompt.tools, record.prompt.tools)),
    [record, previous],
  )

  const copy = React.useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(t('action.copied'))
    } catch {
      showToast(t('action.copyFailed'))
    }
  }, [showToast, t])

  const loadOlder = React.useCallback(async () => {
    if (session === undefined || typeof session.loadOlder !== 'function') return
    setLoadingOlder(true)
    try {
      await session.loadOlder()
    } finally {
      setLoadingOlder(false)
    }
  }, [session])

  const additionBadge = addition.trim() === ''
    ? null
    : additionRange === null
      ? <span className="dpl-badge" data-tone="warn">{t('badge.absent')}</span>
      : <span className="dpl-badge" data-tone="accent">{t('badge.addition')}</span>

  return (
    <div className="dpl-root">
      <div className="dpl-toolbar">
        <span className="dpl-toolbar-title">{t('view.title')}</span>
        {record !== undefined && (
          <div className="dpl-toolbar-meta">
            <span className="dpl-model" title={`${config.provider ?? ''} / ${config.model ?? ''}`}>
              <span className="dpl-model-provider">{config.provider ?? '—'}</span>
              <span className="dpl-model-name">{config.model ?? '—'}</span>
            </span>
            <span className="dpl-badge" data-tone="muted">{t(REASON_LABEL[record.reason] ?? 'nav.reason.change')}</span>
            <ChangeBadge t={t} change={record.change} />
          </div>
        )}
        <span className="dpl-spacer" />
        {total > 0 && (
          <nav className="dpl-nav" aria-label="request navigation">
            <button type="button" className="dpl-icon-btn" onClick={() => go(-1)} disabled={index <= 0} aria-label={t('nav.prev')}>
              <ChevronLeft />
            </button>
            <span className="dpl-nav-label">{t('nav.request', { index: index + 1, total })}</span>
            <button type="button" className="dpl-icon-btn" onClick={() => go(1)} disabled={index >= total - 1} aria-label={t('nav.next')}>
              <ChevronRight />
            </button>
          </nav>
        )}
        {!isLatest && (
          <button type="button" className="dpl-follow" onClick={follow}>{t('nav.follow')}</button>
        )}
        <div className="dpl-segmented" role="tablist">
          {TABS.map(key => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className="dpl-segment"
              data-active={tab === key ? 'true' : 'false'}
              onClick={() => setTab(key)}
            >
              {t(TAB_LABEL[key])}
            </button>
          ))}
        </div>
        <button type="button" className="dpl-icon-btn" onClick={() => setEditorOpen(open => !open)} aria-label={t('action.edit')}>
          <EditIcon />
          {t('action.edit')}
        </button>
      </div>

      <div className="dpl-body">
        <main className="dpl-main">
          {record === undefined
            ? (
              <div className="dpl-empty">
                <div className="dpl-empty-mark">{'{ }'}</div>
                <div>{windowSnapshot.hasMore ? t('empty.waiting') : t('empty.noRequest')}</div>
                {windowSnapshot.hasMore && (
                  <button type="button" className="dpl-icon-btn" onClick={loadOlder} disabled={loadingOlder}>
                    <RefreshIcon />
                    {t('action.older')}
                  </button>
                )}
              </div>
            )
            : (
              <div className="dpl-content">
                {tab === 'system' && (
                  <>
                    <div className="dpl-subhead">
                      <span>{t('meta.chars', { count: systemText.length })}</span>
                      <span>·</span>
                      <span>{t('meta.lines', { count: lines.length })}</span>
                      <span>·</span>
                      <span>{t('meta.tokens', { count: estimateTokens(systemText) })}</span>
                      {additionBadge}
                      <span className="dpl-spacer" />
                      {effectiveIsNewer && (
                        <button type="button" className="dpl-follow" onClick={() => setShowEffective(value => !value)}>
                          {showEffective ? t('request.viewRequest') : t('request.viewUpdate')}
                        </button>
                      )}
                      <button type="button" className="dpl-icon-btn" onClick={() => copy(systemText)}>
                        <CopyIcon />
                        {t('action.copy')}
                      </button>
                    </div>
                    <div className="dpl-search">
                      <SearchIcon />
                      <input
                        value={query}
                        onChange={event => setQueryAndReset(event.target.value)}
                        placeholder={t('action.searchPlaceholder')}
                        aria-label={t('action.search')}
                      />
                      {query === '' ? null : <span className="dpl-search-count">{hitCount}</span>}
                    </div>
                    {effectiveIsNewer && <p className="dpl-hint">{t('request.afterUpdate')}</p>}
                    <div className="dpl-prompt-shell">
                      <div className="dpl-prompt-card">
                        <div className="dpl-prompt-scroll">
                          {lines.length === 0
                            ? <div className="dpl-code-line"><span className="dpl-code-no">1</span><pre className="dpl-code-text">{t('system.empty')}</pre></div>
                            : lines.map((line, lineIndex) => (
                              <div
                                className="dpl-code-line"
                                data-addition={additionLine >= 0 && lineIndex >= additionLine && lineIndex < additionLine + Math.max(1, addition.split('\n').length) ? 'true' : 'false'}
                                key={lineIndex}
                              >
                                <span className="dpl-code-no">{lineIndex + 1}</span>
                                <pre className="dpl-code-text">{highlight(line, query)}</pre>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {tab === 'tools' && (
                  <>
                    <div className="dpl-subhead">
                      <span>{t('meta.tools', { count: tools.length })}</span>
                      <span>·</span>
                      <span>{t('meta.tokens', { count: estimateTokens(JSON.stringify(tools)) })}</span>
                      <span className="dpl-spacer" />
                      <button type="button" className="dpl-icon-btn" onClick={() => copy(JSON.stringify(tools, null, 2))}>
                        <CopyIcon />
                        {t('action.copy')}
                      </button>
                    </div>
                    <div className="dpl-search">
                      <SearchIcon />
                      <input
                        value={query}
                        onChange={event => setQueryAndReset(event.target.value)}
                        placeholder={t('action.searchPlaceholder')}
                        aria-label={t('action.search')}
                      />
                      {query === '' ? null : <span className="dpl-search-count">{filteredTools.length}</span>}
                    </div>
                    {filteredTools.length === 0
                      ? <div className="dpl-empty"><div className="dpl-empty-mark">{'{}'}</div><div>{t('tool.empty')}</div></div>
                      : (
                        <div className="dpl-tool-list">
                          {filteredTools.map(tool => (
                            <ToolCard
                              key={tool.name}
                              tool={tool}
                              t={t}
                              overridden={toolOverrides[tool.name] !== undefined}
                              query={query}
                              onCopy={() => copy(JSON.stringify(tool, null, 2))}
                            />
                          ))}
                        </div>
                      )}
                  </>
                )}

                {tab === 'options' && (
                  optionRows.length === 0
                    ? <div className="dpl-empty"><div className="dpl-empty-mark">{'{ }'}</div><div>{t('options.empty')}</div></div>
                    : (
                      <div className="dpl-options">
                        {optionRows.map(([key, value]) => (
                          <div className="dpl-option-row" key={key}>
                            <span className="dpl-option-key">{key}</span>
                            <span className="dpl-option-value">{highlight(formatOption(value), query)}</span>
                          </div>
                        ))}
                      </div>
                    )
                )}

                {tab === 'diff' && (
                  systemDiff === null
                    ? <div className="dpl-empty"><div className="dpl-empty-mark">{'±'}</div><div>{t('diff.empty')}</div></div>
                    : (
                      <>
                        <div className="dpl-subhead">
                          <span>{t('diff.system')}</span>
                          <span className="dpl-badge" data-tone="muted">
                            +{systemDiff.filter(row => row.kind === 'added').length}
                            {' / '}
                            −{systemDiff.filter(row => row.kind === 'removed').length}
                          </span>
                        </div>
                        <div className="dpl-diff-block">
                          {systemDiff.slice(0, 800).map((row, rowIndex) => (
                            <div className="dpl-diff-line" data-kind={row.kind} key={rowIndex}>
                              <span className="dpl-diff-marker">{row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : ' '}</span>
                              <span>{row.text === '' ? ' ' : row.text}</span>
                            </div>
                          ))}
                          {systemDiff.length > 800 && <div className="dpl-diff-skip">… {systemDiff.length - 800}</div>}
                        </div>
                        <div className="dpl-subhead">
                          <span>{t('diff.tools')}</span>
                          {toolDiff.added.length === 0 && toolDiff.removed.length === 0 && toolDiff.changed.length === 0
                            ? <span>{t('diff.noChange')}</span>
                            : (
                              <>
                                {toolDiff.added.length > 0 && <span className="dpl-badge" data-tone="accent">{t('diff.added')}: {toolDiff.added.join(', ')}</span>}
                                {toolDiff.removed.length > 0 && <span className="dpl-badge" data-tone="warn">{t('diff.removed')}: {toolDiff.removed.join(', ')}</span>}
                                {toolDiff.changed.length > 0 && <span className="dpl-badge">{t('diff.changed')}: {toolDiff.changed.join(', ')}</span>}
                              </>
                            )}
                        </div>
                      </>
                    )
                )}

                {tab === 'payload' && (
                  <PayloadPanel
                    t={t}
                    record={record}
                    entries={windowSnapshot.entries}
                    revision={windowSnapshot.revision}
                    session={session}
                    query={query}
                    onQuery={setQueryAndReset}
                    onCopy={copy}
                    initialView={initialPayloadView}
                  />
                )}
              </div>
            )}
        </main>

        {editorOpen && (
          <EditorPanel
            t={t}
            form={configForm}
            snapshot={configSnapshot}
            tools={tools}
            onClose={() => setEditorOpen(false)}
            onSaved={() => showToast(t('editor.saved'))}
          />
        )}
      </div>

      {toast !== null && <div className="dpl-toast">{toast}</div>}
    </div>
  )
}

function ToolCard({ tool, t, overridden, query, onCopy }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="dpl-tool-card">
      <button type="button" className="dpl-tool-head" onClick={() => setOpen(value => !value)} aria-expanded={open}>
        <ChevronRight open={open} className="dpl-chevron" />
        <span className="dpl-tool-name">{tool.name}</span>
        <span className="dpl-tool-desc">{highlight(tool.description ?? '', query)}</span>
        {overridden && <span className="dpl-badge" data-tone="accent">{t('tool.modified')}</span>}
      </button>
      {open && (
        <div className="dpl-tool-body">
          {tool.description !== '' && <p className="dpl-tool-full">{tool.description}</p>}
          <div className="dpl-section-label">{t('tool.parameters')}</div>
          <div className="dpl-json"><JsonTree data={tool.parameters ?? {}} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="dpl-icon-btn" onClick={onCopy}>
              <CopyIcon />
              {t('action.copy')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
