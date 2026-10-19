/** 参数 JSON 的可折叠树。只读展示，不修改内容。 */

import * as React from 'react'

const MAX_PREVIEW = 120

function previewOf(value) {
  const text = JSON.stringify(value)
  return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}…` : text
}

function Variable({ value }) {
  if (value === null) return <span className="dpl-json-null">null</span>
  if (typeof value === 'number') return <span className="dpl-json-number">{String(value)}</span>
  if (typeof value === 'boolean') return <span className="dpl-json-bool">{String(value)}</span>
  if (typeof value === 'string') return <span className="dpl-json-string">{JSON.stringify(value)}</span>
  return <span className="dpl-json-null">{String(value)}</span>
}

function Key({ name }) {
  if (name === null) return null
  return (
    <>
      <span className="dpl-json-key">{JSON.stringify(name)}</span>
      <span className="dpl-json-colon">:</span>
    </>
  )
}

function Node({ name, value, depth }) {
  const isObject = value !== null && typeof value === 'object'
  const entries = isObject ? Object.entries(value) : []
  const [open, setOpen] = React.useState(depth < 2)

  if (!isObject) {
    return (
      <div className="dpl-json-row">
        <Key name={name} />
        <Variable value={value} />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="dpl-json-row">
        <Key name={name} />
        <span className="dpl-json-null">{Array.isArray(value) ? '[]' : '{}'}</span>
      </div>
    )
  }

  const summary = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`
  return (
    <div className="dpl-json-node" style={depth === 0 ? { paddingLeft: 0, borderLeft: 0 } : undefined}>
      <div className="dpl-json-row">
        <button
          type="button"
          className="dpl-json-toggle"
          onClick={() => setOpen(current => !current)}
          aria-expanded={open}
          aria-label={open ? 'collapse' : 'expand'}
        >
          {open ? '−' : '+'}
        </button>
        <Key name={name} />
        {open ? null : <span className="dpl-json-null">{summary}</span>}
      </div>
      {open
        ? entries.map(([key, child]) => <Node key={key} name={key} value={child} depth={depth + 1} />)
        : <div className="dpl-json-row" style={{ paddingLeft: 18 }}><span className="dpl-json-null">{previewOf(value)}</span></div>}
    </div>
  )
}

/**
 * 渲染任意 JSON 值。
 * @param {{ data: unknown }} props 要渲染的值。
 */
export function JsonTree({ data }) {
  return <Node name={null} value={data} depth={0} />
}
