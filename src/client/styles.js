/**
 * 插件样式。全部沿用 DSH 主题令牌（--dsw-* / --dsh-*），因此明暗主题、
 * 字体设置、圆角规范都由宿主负责，插件只组合它们。
 */

export const CSS_TEXT = `
.dpl-root {
  --dpl-bottom-clearance: calc(var(--dsh-composer-height, 152px) + 24px);
  --dpl-ease: cubic-bezier(0.32, 0.72, 0, 1);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: var(--dsh-content-font-size-secondary, 13px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
}

.dpl-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  flex: none;
}

.dpl-toolbar-title {
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.dpl-toolbar-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--dsw-alias-label-tertiary);
}

.dpl-model {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  max-width: 260px;
  min-width: 0;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
}

.dpl-model-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}

.dpl-model-provider { color: var(--dsw-alias-label-caption); }

.dpl-spacer { flex: 1; }

.dpl-segmented {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-2);
  flex: none;
}

.dpl-segment {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  padding: 4px 11px;
  border-radius: calc(var(--dsw-radius-md) - 2px);
  cursor: pointer;
  white-space: nowrap;
  transition: color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    background-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    box-shadow var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}

.dpl-segment:hover { color: var(--dsw-alias-label-primary); }

.dpl-segment[data-active='true'] {
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2);
}

.dpl-icon-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  min-width: 28px;
  padding: 0 9px;
  border-radius: var(--dsw-radius-sm);
  border: 1px solid var(--dsw-alias-border-l1);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  cursor: pointer;
  transition: background-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    transform 120ms var(--dpl-ease);
}

.dpl-icon-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dpl-icon-btn:active { transform: scale(0.98); }
.dpl-icon-btn[disabled] { opacity: 0.45; cursor: default; }
.dpl-icon-btn[data-primary='true'] {
  background: var(--dsw-alias-button-primary-fill);
  border-color: transparent;
  color: var(--dsw-alias-label-primary-foreground);
}
.dpl-icon-btn[data-primary='true']:hover { background: var(--dsw-alias-button-primary-hover); }

.dpl-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--dsw-radius-md);
  border: 1px solid var(--dsw-alias-border-l1);
}

.dpl-nav-label {
  min-width: 108px;
  text-align: center;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
}

.dpl-follow {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-link);
  font: inherit;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--dsw-radius-xs);
}
.dpl-follow:hover { background: var(--dsw-alias-interactive-bg-hover); }

.dpl-body {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.dpl-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 18px 24px var(--dpl-bottom-clearance);
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2) transparent;
}

.dpl-content {
  width: min(100%, 980px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dpl-subhead {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--dsw-alias-label-tertiary);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
}

.dpl-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 2px);
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.dpl-badge[data-tone='accent'] {
  color: var(--dsw-alias-state-business-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
}
.dpl-badge[data-tone='muted'] { color: var(--dsw-alias-label-caption); }
.dpl-badge[data-tone='warn'] {
  color: var(--dsw-alias-state-warn-label);
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);
}

.dpl-prompt-shell {
  padding: 1px;
  border-radius: var(--dsw-radius-lg);
  background: linear-gradient(180deg, var(--dsw-alias-border-l2), var(--dsw-alias-border-l1));
}

.dpl-prompt-card {
  border-radius: calc(var(--dsw-radius-lg) - 1px);
  background: var(--dsw-alias-markdown-code-block);
  overflow: hidden;
}

.dpl-prompt-scroll {
  padding: 12px 0;
}

.dpl-code-line {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: start;
  padding: 0 16px 0 0;
  min-height: 20px;
}

.dpl-code-line:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dpl-code-line[data-addition='true'] {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent);
  box-shadow: inset 2px 0 0 var(--dsw-alias-state-business-primary);
}

.dpl-code-no {
  padding-top: 2px;
  padding-right: 12px;
  text-align: right;
  color: var(--dsw-alias-label-caption);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
  line-height: 20px;
  user-select: none;
  font-variant-numeric: tabular-nums;
}

.dpl-code-text {
  margin: 0;
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 20px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--dsw-alias-label-primary);
}

.dpl-hit {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 28%, transparent);
  border-radius: 2px;
  color: inherit;
}

.dpl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 220px;
  padding: 24px;
  color: var(--dsw-alias-label-tertiary);
  text-align: center;
}

.dpl-empty-mark {
  width: 40px;
  height: 40px;
  border-radius: var(--dsw-radius-md);
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  display: grid;
  place-items: center;
  color: var(--dsw-alias-label-caption);
  font-family: var(--ds-font-family-code);
  font-size: 15px;
}

.dpl-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: var(--dsw-radius-md);
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  transition: border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}

.dpl-search:focus-within { border-color: var(--dsw-alias-border-l4); }

.dpl-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
}

.dpl-search input::placeholder { color: var(--dsw-alias-label-caption); }

.dpl-search-count {
  color: var(--dsw-alias-label-caption);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}

.dpl-tool-list { display: flex; flex-direction: column; gap: 8px; }

.dpl-tool-card {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
  transition: border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}

.dpl-tool-card:hover { border-color: var(--dsw-alias-border-l2); }

.dpl-tool-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dpl-chevron {
  flex: none;
  color: var(--dsw-alias-label-caption);
  transition: transform var(--ds-transition-duration) var(--dpl-ease);
}
.dpl-chevron[data-open='true'] { transform: rotate(90deg); }

.dpl-tool-name {
  flex: none;
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  color: var(--dsw-alias-label-primary);
}

.dpl-tool-desc {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
}

.dpl-tool-body {
  padding: 2px 12px 12px 32px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

.dpl-tool-full {
  margin: 10px 0 8px;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dpl-section-label {
  margin: 10px 0 6px;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dpl-json {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-markdown-code-block);
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 18px;
  overflow: auto;
  max-height: 320px;
}

.dpl-json-node { padding-left: 14px; border-left: 1px solid var(--dsw-alias-border-l1); }
.dpl-json-row { display: flex; gap: 6px; align-items: baseline; }
.dpl-json-key { color: var(--dsw-alias-label-secondary); }
.dpl-json-colon { color: var(--dsw-alias-label-caption); }
.dpl-json-string { color: var(--dsw-alias-state-success-primary); }
.dpl-json-number { color: var(--dsw-alias-state-business-primary); }
.dpl-json-bool { color: var(--dsw-alias-state-warn-label); }
.dpl-json-null { color: var(--dsw-alias-label-caption); }
.dpl-json-toggle {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-caption);
  font: inherit;
  cursor: pointer;
  padding: 0 4px 0 0;
}

.dpl-options { display: flex; flex-direction: column; border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md); overflow: hidden; }
.dpl-option-row { display: flex; gap: 16px; padding: 7px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dpl-option-row:last-child { border-bottom: 0; }
.dpl-option-key { width: 180px; flex: none; color: var(--dsw-alias-label-tertiary); }
.dpl-option-value { min-width: 0; flex: 1; font-family: var(--ds-font-family-code); font-size: 12px; overflow-wrap: anywhere; }

.dpl-diff-block {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  overflow: hidden;
  background: var(--dsw-alias-bg-base);
}

.dpl-diff-line {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 4px;
  padding: 0 10px;
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 19px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dpl-diff-line[data-kind='added'] { background: var(--dsw-alias-code-diff-added); }
.dpl-diff-line[data-kind='removed'] { background: var(--dsw-alias-code-diff-deleted); }
.dpl-diff-marker { color: var(--dsw-alias-label-caption); user-select: none; }
.dpl-diff-line[data-kind='added'] .dpl-diff-marker { color: var(--dsw-alias-state-success-primary); }
.dpl-diff-line[data-kind='removed'] .dpl-diff-marker { color: var(--dsw-alias-state-error-primary); }
.dpl-diff-skip { padding: 2px 10px; color: var(--dsw-alias-label-caption); font-size: 11px; }

.dpl-drawer {
  flex: none;
  width: 400px;
  max-width: 46vw;
  border-left: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 让抽屉的底栏停在悬浮输入框上方，而不是被它盖住。 */
  padding-bottom: calc(var(--dsh-composer-height, 152px) + 8px);
  box-sizing: border-box;
  animation: dpl-drawer-in 320ms var(--dpl-ease);
}

@keyframes dpl-drawer-in {
  from { transform: translateX(24px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.dpl-drawer-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

.dpl-drawer-title { font-weight: 600; flex: 1; }

.dpl-drawer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2) transparent;
}

.dpl-field { display: flex; flex-direction: column; gap: 6px; }
.dpl-field-head { display: flex; align-items: baseline; gap: 8px; }
.dpl-field-label { font-weight: 600; color: var(--dsw-alias-label-primary); }
.dpl-field-count { margin-left: auto; color: var(--dsw-alias-label-caption); font-size: 11px; font-variant-numeric: tabular-nums; }
.dpl-hint { color: var(--dsw-alias-label-tertiary); font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 2px); line-height: 18px; }

.dpl-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 132px;
  resize: vertical;
  padding: 10px 12px;
  border-radius: var(--dsw-radius-md);
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 19px;
  outline: none;
  transition: border-color var(--ds-transition-duration-fast) var(--ds-ease-in-out),
    box-shadow var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}

.dpl-textarea:focus {
  border-color: var(--dsw-alias-brand-primary-new-color, var(--dsw-alias-link));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-link) 14%, transparent);
}

.dpl-textarea--tool { min-height: 64px; }

.dpl-tool-edit { display: flex; flex-direction: column; gap: 6px; padding: 10px 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.dpl-tool-edit:last-child { border-bottom: 0; }
.dpl-tool-edit-head { display: flex; align-items: baseline; gap: 8px; }
.dpl-tool-edit-name { font-family: var(--ds-font-family-code); font-size: 12px; color: var(--dsw-alias-label-primary); }
.dpl-tool-edit-original { color: var(--dsw-alias-label-caption); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }

.dpl-drawer-foot {
  padding: 12px 16px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  display: flex;
  align-items: center;
  gap: 8px;
}

.dpl-status { flex: 1; min-width: 0; color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dpl-status[data-tone='ok'] { color: var(--dsw-alias-state-success-primary); }
.dpl-status[data-tone='error'] { color: var(--dsw-alias-state-error-primary); }

.dpl-toast {
  position: absolute;
  right: 18px;
  bottom: calc(var(--dsh-composer-height, 152px) + 18px);
  padding: 7px 12px;
  border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-toast-bg);
  color: var(--dsw-alias-toast-label);
  font-size: 12px;
  pointer-events: none;
  animation: dpl-toast-in 220ms var(--dpl-ease);
}

@keyframes dpl-toast-in {
  from { transform: translateY(6px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.dpl-root { position: relative; }

@media (max-width: 880px) {
  .dpl-toolbar { flex-wrap: wrap; padding: 8px 12px; row-gap: 8px; }
  .dpl-main { padding-inline: 12px; }
  .dpl-drawer { position: absolute; inset: 0 0 0 auto; width: min(100%, 420px); max-width: none; box-shadow: -24px 0 48px rgb(0 0 0 / 12%); }
}

@media (prefers-reduced-motion: reduce) {
  .dpl-drawer, .dpl-toast { animation: none; }
  .dpl-chevron, .dpl-segment, .dpl-icon-btn { transition: none; }
}

.dpl-segmented--compact { padding: 1px; }
.dpl-segmented--compact .dpl-segment { padding: 3px 10px; }

.dpl-msg-list { display: flex; flex-direction: column; gap: 6px; }

.dpl-msg {
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-base);
  overflow: hidden;
}

.dpl-msg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dpl-msg-head:hover { background: var(--dsw-alias-interactive-bg-hover); }

.dpl-role {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.dpl-role[data-role='system'] {
  color: var(--dsw-alias-state-business-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, transparent);
}
.dpl-role[data-role='developer'] {
  color: var(--dsw-alias-state-warn-label);
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);
}
.dpl-role[data-role='user'] {
  color: var(--dsw-alias-state-success-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 35%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 8%, transparent);
}
.dpl-role[data-role='tool'] { color: var(--dsw-alias-label-tertiary); }

.dpl-msg-kind {
  flex: none;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
}

.dpl-msg-meta {
  flex: none;
  color: var(--dsw-alias-label-caption);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.dpl-msg-preview {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
}

.dpl-msg-body {
  border-top: 1px solid var(--dsw-alias-border-l1);
  padding: 10px 12px;
}

.dpl-msg-text {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary);
}

.dpl-msg-actions { display: flex; justify-content: flex-end; margin-top: 8px; }

.dpl-headers {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
  overflow: hidden;
}

.dpl-header-row {
  display: flex;
  gap: 12px;
  padding: 5px 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
}
.dpl-header-row:last-child { border-bottom: 0; }
.dpl-header-name { width: 220px; flex: none; color: var(--dsw-alias-label-tertiary); }
.dpl-header-value { min-width: 0; overflow-wrap: anywhere; color: var(--dsw-alias-label-secondary); }

.dpl-notes {
  margin: 0;
  padding-left: 18px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 18px;
}

.dpl-json--payload { max-height: 520px; }
`

