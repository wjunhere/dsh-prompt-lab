#!/usr/bin/env node
/**
 * 生成静态预览并截图（仅开发用，不进入发布包）。
 *
 *   DSH_SRC=/path/to/deepseek-harness node scripts/preview.mjs
 *
 * 环境变量：
 *   DSH_SRC     DSH 源码树根目录（读 ui-theme 的主题令牌），必填
 *   CHROME_PATH 浏览器可执行文件；默认按平台常见路径探测
 *   PREVIEW_OUT 输出目录；默认 ./tmp/preview
 */

import { build } from 'esbuild'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { CSS_TEXT } from '../src/client/styles.js'

const run = promisify(execFile)
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT = resolve(process.env.PREVIEW_OUT ?? join(ROOT, 'tmp', 'preview'))
const DSH_SRC = process.env.DSH_SRC
const THEME_DIR = DSH_SRC === undefined
  ? undefined
  : join(DSH_SRC, 'packages', 'client', 'ui-theme', 'src', 'styles')

/** 按平台常见安装位置找浏览器；找不到就要求显式给 CHROME_PATH。 */
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean)
  return candidates.find(candidate => existsSync(candidate))
}

const CHROME = findChrome()
if (THEME_DIR === undefined) throw new Error('set DSH_SRC to a deepseek-harness checkout')
if (CHROME === undefined) throw new Error('set CHROME_PATH to a Chromium-based browser')

const bundle = await build({
  entryPoints: [join(ROOT, 'scripts', 'preview-entry.jsx')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'transform',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
})

const [baseCss, platformCss] = await Promise.all([
  readFile(join(THEME_DIR, 'base.css'), 'utf8'),
  readFile(join(THEME_DIR, 'design-platform.css'), 'utf8'),
])

const FRAME_CSS = `
html, body { height: 100%; margin: 0; }
body {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
}
.frame { --dsh-composer-height: 96px; position: relative; display: flex; flex-direction: column; height: 100dvh; overflow: hidden; }
.tabs { flex: none; display: flex; align-items: flex-end; gap: 22px; height: 46px; padding: 0 24px; border-bottom: 1px solid var(--dsw-alias-border-l1); font-size: 13px; color: var(--dsw-alias-label-tertiary); }
.tabs span { padding-bottom: 11px; }
.tabs .active { color: var(--dsw-alias-label-primary); box-shadow: inset 0 -2px 0 var(--dsw-alias-label-primary); }
.host { flex: 1; min-height: 0; }
.composer {
  position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%);
  width: min(760px, calc(100% - 48px)); height: 76px; border-radius: var(--dsw-radius-panel);
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 10px 28px rgb(0 0 0 / 7%);
}
.composer-hint { position: absolute; left: 22px; top: 24px; color: var(--dsw-alias-label-caption); font-size: 13px; }
`

function page(mode, dark) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>dsh-prompt-lab preview</title>
<style>${baseCss}</style>
<style>${platformCss}</style>
<style>${CSS_TEXT}</style>
<style>${FRAME_CSS}</style>
</head>
<body${dark ? ' data-ds-dark-theme' : ''}>
<div class="frame">
  <div class="tabs"><span>对话</span><span>轨迹</span><span class="active">提示词</span></div>
  <div class="host"><div id="root" style="height:100%"></div></div>
  <div class="composer"><span class="composer-hint">Ask anything…</span></div>
</div>
<script>${bundle.outputFiles[0].text}</script>
</body>
</html>
`
}

await mkdir(OUT, { recursive: true })
const shots = [
  ['system', false],
  ['system', true],
  ['tools', false],
  ['editor', true],
  ['diff', false],
  ['payload', false],
  ['payload', true],
  ['payload-wire', false],
]
for (const [mode, dark] of shots) {
  const file = join(OUT, `${mode}-${dark ? 'dark' : 'light'}.html`)
  await writeFile(file, page(mode, dark), 'utf8')
  const png = join(OUT, `${mode}-${dark ? 'dark' : 'light'}.png`)
  await run(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1280,860',
    '--virtual-time-budget=1500',
    `--screenshot=${png}`,
    `${pathToFileURL(file).href}?mode=${mode}`,
  ], { timeout: 60_000 })
  process.stdout.write(`shot ${png}\n`)
}
