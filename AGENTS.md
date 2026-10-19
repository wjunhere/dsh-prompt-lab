# AGENTS.md

## 这是什么

DSH 插件：会话顶栏的「提示词」页（只读检查）+ 右侧编辑抽屉（写追加指令、工具描述覆盖）。

## 目录

```
src/host/index.js    宿主：注册 systemPrompt 段落 + 在 system-prompt/assemble 上改工具 description
src/client/index.jsx 客户端入口：注册 conversation.view 槽位、样式、locale
src/client/view.jsx  主视图（提示词 / 工具 / 选项 / 对比 / 载荷）
src/client/payload.js 载荷层：surface 折叠、事件→消息、DeepSeek wire 映射（纯函数，可直接测）
src/client/editor.jsx 编辑抽屉（configForms 读写）
src/client/data.js   纯数据层：事件折叠、diff、token 估算、追加段定位（node --test 直接测）
src/client/json.jsx  参数 JSON 树
scripts/build.mjs    esbuild 构建两个半侧，客户端包成 lazy-CJS factory
lib/                 构建产物（两份都提交，安装时不依赖构建）
test/                node --test
```

## 命令

```bash
node scripts/build.mjs        # 构建 lib/index.js 与 lib/client.js
node --test test/*.test.mjs   # 23 项测试：数据层 + 载荷层 + 宿主产物 + 客户端产物静态渲染
node scripts/preview.mjs      # 仅开发：需要 DSH_SRC=<harness 源码树>；截图写到 ./tmp/preview
```

## 必须守住的不变量

1. **工具只改 description**。`parameters` 是执行侧 `defineTool` 闭包里的校验真源，改它必然脱钩。宿主里 `applyToolOverrides` 只碰 description。
2. **展示数据只来自会话事件**。`request/header.header.tools` 与 `system/message` 就是模型实际收到的内容；不要改成自建捕获或 `systemPrompt.assemble()` 探针（那是"重新装配"，不等于已发送内容）。
3. **写入只走 `ctx.configForms`**，配置字段必须 `.volatile()`。不要自建 HTTP 路由、不要写 `$DSH_HOME` 下的私有 JSON。
4. **追加段** `order: 1_000_000`、`interpolate: false`（用户文本里的 `{{...}}` 原样保留）、空文本零贡献。
5. 客户端产物必须是 `window.__ModuleLoader__.load({id:'@wjunhere/dsh-prompt-lab', factory})`，`id` 等于包名，`react` 外置。
6. **载荷层口径**：surface 折叠用 `append` 追加 / `replace` 移除 `[startSeq,endSeq]` 再加入；空 system/developer/assistant 不产生消息；tool 结果消息带 `toolCallId`。wire 映射里第一条 system 消息进顶层 `system`，后续 system 消息作为 role:`system` 的 in-history 更新；reasoning → thinking；tool-call → tool_use；tool 结果 → user 轮里的 tool_result。改这些规则先改 `test/payload.test.mjs`。

## 构建与安装

- 宿主用 esbuild 打包（schemastery 内联），输出 ESM；客户端输出 CJS 再包一层 factory。
- 发布版从 npm 安装（`@wjunhere/dsh-prompt-lab`）；开发时可用 `link:` 装本地目录，此时 DSH 从软链接的真实路径加载，`lib/` 必须是已构建状态。
- 装进 desktop profile 后要**重启 DSH**；客户端 bundle 由宿主在启动时扫描 `dsh.client` 下发。
- 改完先 `node scripts/build.mjs && node --test test/*.test.mjs`，再重启看效果。

## 已知坑

- `useSyncExternalStore` 在 ssr 下必须传第三个参数（`getServerSnapshot`），否则测试报 Missing getServerSnapshot；已传。
- `ctx.configForms.get(entryId)` 的 entryId 是 profile 条目 id（`prompt-lab`），不是包名。
- Config 里全是 volatile 字段时不会有"重启生效"问题；`.get()` 每次装配时读一次。
- 视图根节点高度必须是 100%，底部留 `calc(var(--dsh-composer-height, 152px) + 24px)`，否则会被悬浮输入框盖住。
