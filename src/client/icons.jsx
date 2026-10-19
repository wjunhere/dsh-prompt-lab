/** 轻量图标：沿用 DSH 的细线风格，不引入图标库。 */

import * as React from 'react'

const base = {
  width: 14,
  height: 14,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export function ChevronRight({ open, className }) {
  return (
    <svg {...base} className={className} data-open={open === true ? 'true' : 'false'} style={{ transition: 'transform 200ms cubic-bezier(0.32,0.72,0,1)' }}>
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  )
}

export function ChevronLeft(props) {
  return <svg {...base} {...props}><path d="M10 3.5 5.5 8 10 12.5" /></svg>
}

export function ChevronDown(props) {
  return <svg {...base} {...props}><path d="M3.5 6 8 10.5 12.5 6" /></svg>
}

export function CopyIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.6" />
      <path d="M10.5 5.5V4.2c0-.9-.7-1.6-1.6-1.6H4.2c-.9 0-1.6.7-1.6 1.6v4.7c0 .9.7 1.6 1.6 1.6h1.3" />
    </svg>
  )
}

export function SearchIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="7.2" cy="7.2" r="4.2" />
      <path d="M10.4 10.4 13.5 13.5" />
    </svg>
  )
}

export function EditIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9.8 2.9 13.1 6.2 6.5 12.8 2.9 13.1 3.2 9.5z" />
      <path d="M8.6 4.1 11.9 7.4" />
    </svg>
  )
}

export function CloseIcon(props) {
  return <svg {...base} {...props}><path d="M4 4 12 12M12 4 4 12" /></svg>
}

export function RefreshIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M13 8a5 5 0 1 1-1.6-3.7" />
      <path d="M13.2 2.8v2.8h-2.8" />
    </svg>
  )
}
