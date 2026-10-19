# dsh-prompt-lab

在 DSH 会话顶栏加一个 **「提示词」** 页，和「对话」「轨迹」并列。它显示模型每一轮实际收到的：

- 完整系统提示词（含你追加的那段会在哪一行）
- 完整工具目录（名字、描述、参数 schema）
- 模型选项（provider / model / 采样参数）
- 与上一次请求的差异
- 请求载荷：这次实际发出去的消息序列（含 AGENTS.md、运行时上下文、工具结果），以及按 DeepSeek Messages API 映射的 wire 预览

右侧「编辑」可以直接改两样东西（保存后下一轮生效，不用重启）：

- **追加指令**：追加到系统提示词末尾的一段文字
- **工具描述覆盖**：只改模型看到的描述，参数和执行逻辑不变

## 为什么不是「再装一个上下文分析插件」

系统提示词和工具定义本来就会被 DSH 记进会话日志（`system/message` 与 `request/header`），所以这个插件不抓包、不落盘、不做二次存储，直接读浏览器里已有的会话数据。你看到的就是模型收到的，不是"探针重新装配"的近似结果。

## 安装

已发布到 npm，一条命令装进 profile（Web / Desktop 的 profile 名分别是 `web` 和 `desktop`）：

```sh
dsh plugin --profile desktop add @wjunhere/dsh-prompt-lab
```

也可以走 GUI：「插件」页 → **Add plugin** → 填包名 `@wjunhere/dsh-prompt-lab` → Install。

安装后**重启 DSH**（宿主插件需要重新加载）。

开发时改为装本地目录：「插件」页 → Add plugin → 本地路径，填入本仓库所在目录。

> 本包宿主半侧打包时已内联依赖，没有运行时 npm 依赖；不需要在插件目录里 `npm install` 才能跑（只有开发和构建时需要）。

## 开发

```sh
npm install
npm run build          # 生成 lib/index.js 与 lib/client.js
npm test               # 23 项测试
```

改了源码要重新 build；装进 profile 后还需重启 DSH 才能看到新客户端 bundle。

## 使用

打开任意会话，顶部标签栏会出现「提示词」：

| 区域 | 作用 |
| --- | --- |
| 左上 model 徽标 | 这次请求用的 provider / model |
| 请求导航 | 前后翻看该会话发过的每次请求 |
| 系统提示词 | 全文、行号、搜索高亮、复制；含你的追加段时高亮并标注 |
| 工具 | 每个工具的描述与参数 JSON，可复制；被改过描述的工具会打标 |
| 选项 | 请求头里的模型与采样参数 |
| 对比 | 与上一次请求的系统提示词行级差异、工具增删改 |
| 载荷 | 按顺序列出这次请求的全部消息（system / developer / user / assistant / tool，标来源与字节），可搜索、展开、复制；切到「Wire 预览」看顶层 `system`、映射后的 `messages`、`tools`、请求头与说明 |
| 编辑 | 右侧抽屉：追加指令 + 工具描述覆盖 |

## 边界

- **只改描述，不改参数**。参数 schema 是执行侧校验的真源，改了会让模型按新 schema 生成、执行按旧 schema 拒绝。
- 追加指令固定排在所有内置段之后；它不会覆盖或删除内置段落。
- 配置存在 profile 的 patch 层里（和 DSH 自己的插件配置同一套持久化），不放私有文件。
- 「载荷」页按会话日志重建，宿主插件对消息的投影（如图片卸载）不计入；wire 预览内置的是 `deepseek-*` 的映射，其他 provider 只显示 provider 无关结构。
- 不联网。

## 卸载

在「插件」页移除 `dsh-prompt-lab`，重启 DSH。

## 许可

MIT
