# 闪记 AI 命令执行设计（第 5 步：接入真实 AI）

> 配套文档：`ai-command-bar.md`（交互规格）、`command-input-architecture.md`（组件架构）。
> 本文档聚焦**后端 AI 执行链路**：命令栏的 `/search /add /delete /edit` 与自然语言 `/` 如何真正调用 LLM。

## 1. 背景与目标

第 1–4 步已搭好命令栏的**异步处理态框架**（输入锁定 / 处理中提示 / 可终止按钮 / `AbortController`），但 `runCommand` 目前是 `MainView` 里的**本地 mock**：`/search` 只做本地过滤，`/add` 建 mock 卡片，`/delete /edit` 只 `console.log`。

本步目标：把四个操作全部接到**真实 AI + 真实数据**，覆盖：

| 操作 | 目标行为 |
|------|---------|
| `/search X` | 语义搜索：**FTS5 召回候选 → LLM 重排/过滤** → 结果集展示 |
| `/add X` | AI 解析 → 建**已发布**笔记（复用现有解析管线） |
| `/delete X` | AI 定位候选 → **确认面板** → 确认后删除 |
| `/edit X` | AI 定位目标 + 生成修改预览 → **确认面板** → 确认后应用 |
| `/ 自然语言` | AI 识别意图（search/add/delete/edit）→ 路由到上述之一 |

约束（已与用户确认）：**非流式**（结构化结果一次性返回）；四操作全做，含 delete/edit 的定位+确认流。

## 2. 现状基线（事实，含文件路径）

- **AI 抽象很窄**：`AIProvider`（`src/main/services/ai/base.ts`）只有 `parse(rawInput): Promise<SmartParseResult>` + `testConnection()`。**无通用调用、无流式、无 AbortSignal、无超时/重试**。
- **两个 provider**：`AnthropicProvider`（SDK）、`OpenAICompatibleProvider`（`fetch`，支持 `response_format: json_object`）。二者共用 `extractJSON()`。
- **编排**：`AIService.parse()`（`src/main/services/ai/index.ts`）= 缓存 → 活跃 provider → `heuristicParse` 兜底。provider 配置存 SQLite `settings` 表 `ai_providers`，**API key 在主进程**，故 AI 必须跑在主进程。
- **搜索只有 FTS5**：`searchNotes()`（`src/main/services/index.service.ts`）BM25 前缀 AND 匹配，无向量；有 `text` 时忽略 tag/category。存储原语 `createNote/modifyNote/removeNote`（`storage.service.ts`）齐全。
- **异步范式已存在**：笔记创建走 `note:create`（`src/main/ipc/notes.ipc.ts`）= `heuristicParse` → 存草稿 → `taskManager.enqueue` + 广播 → 异步 `aiService.parse` → markDone/Failed → 发布 → 广播。TaskInfo/事件/TaskBar 体系完整。
- **IPC 模式**：`window.electronAPI.*`（preload contextBridge）→ `ipcMain.handle`（`safeHandler` 包裹）→ service。事件走 `window.electronAPI.on('event:*', cb)`。
- **命令栏现状**：`MainView` `USE_MOCK=true`，`runCommand` 全本地。`AbortController` 已就位但未连真实取消。QuickCapture 用自己的简单 input，不走 `/` 命令。

## 3. 总体架构

AI 命令**不复用 note-create 的 fire-and-forget 任务模型**，因为命令栏需要「可取消的请求—响应 + 结果/确认」。改用 **invoke + 取消通道 + 二次确认** 模型：

```
[Renderer 命令栏]                    [Preload]              [Main 进程]
  Enter /search X                       │                      │
  requestId = uuid()                    │                      │
  aiCommand.run({id,type:'search',raw}) ├─ invoke('ai:cmd:run')┤
        │                               │        ┌─────────────▼──────────────┐
  处理态(锁定/转圈/终止)                 │        │ AICommandService.run(req,   │
        │                               │        │   signal)  ← AbortController │
  点终止 → aiCommand.cancel(requestId) ─┼─ invoke('ai:cmd:cancel')─ abort(id) │
        │                               │        │  search: FTS召回→LLM重排     │
        ▼                               │        │  add:    复用 parse+create   │
  拿到 AICommandResult ◄────────────────┴────────┤  delete: LLM定位→候选        │
        │                                        │  edit:   LLM定位+预览        │
  ├ search → 结果集渲染卡片墙                     └──────────────────────────────┘
  ├ add    → 新卡片(事件已广播)
  ├ delete → 确认面板 → aiCommand.confirm(...) → 删除
  └ edit   → 预览面板 → aiCommand.confirm(...) → 应用
```

**主进程持有 `Map<requestId, AbortController>`**：`run` 时建、结束时删；`cancel` 按 id `abort()`，使 `run` 以 `AbortError` 拒绝，渲染层静默解锁（与现有 `handleAbort` 语义一致）。

## 4. Provider 抽象扩展

新增一个**通用补全方法**并给 `parse` 加 signal。放在 `src/main/services/ai/base.ts`：

```ts
export interface AICompletionRequest {
  system: string
  user: string
  /** 若给出：OpenAI 兼容走 response_format=json_object，Anthropic 在 system 追加 schema 说明 */
  json?: boolean
  maxTokens?: number        // 覆盖 provider 默认（parse 默认很小，重排/意图需更大）
  temperature?: number      // 默认 0.1
  signal?: AbortSignal
}

export interface AIProvider {
  readonly config: AIProviderConfig
  parse(rawInput: string, signal?: AbortSignal): Promise<SmartParseResult>
  complete(req: AICompletionRequest): Promise<string>   // 返回原始文本；JSON 由调用方 extractJSON
  testConnection(): Promise<boolean>
}
```

实现要点：
- **`OpenAICompatibleProvider.complete`**：现有 `fetch` 加 `signal`；`json` 为真时带 `response_format:{type:'json_object'}`。
- **`AnthropicProvider.complete`**：`client.messages.create({...}, { signal })`（SDK 支持 signal）；`json` 为真时在 system 末尾追加「仅输出 JSON」约束（沿用现有 prompt 工程）。
- **`AIService`** 新增薄封装 `complete(req)`：取活跃 provider，无 provider 时**抛错**（命令操作不能像 parse 那样静默降级到 heuristic——搜索/删除/编辑没有 heuristic 版本，需明确提示「未配置 AI」）。
- **超时**：`complete` 内用 `AbortSignal.any([userSignal, AbortSignal.timeout(30_000)])` 合并用户取消与 30s 超时。

## 5. 主进程命令服务

新建 `src/main/services/ai/command.service.ts`，导出 `AICommandService`，四个方法 + 意图识别。全部接收 `signal`，全部通过 `AIService.complete` / `AIService.parse` 调 LLM，读写走 `storage.service` / `index.service`。

### 5.1 `/search` —— FTS 召回 + LLM 重排

```
1. 召回：searchNotes 以 OR 宽召回（放宽现有 AND），limit 40，拿候选 Note[]
         若候选 < 8，用最近笔记补齐到 ~20（避免关键词零重叠时空召回）
2. 构造重排输入：每条候选压成 { id, type, title, tags, snippet(content 前~160字) }
3. LLM complete(json)：给定用户 query + 候选列表，返回
     { ranked: [{ id, relevant: boolean, score: 0-1 }] }
4. 过滤 relevant 且 score≥阈值，按 score 降序 → 有序 noteId[]
5. 映射回 Note[]（按 LLM 顺序），作为结果集返回
```

结果类型：`{ kind:'search', query, notes: Note[] }`。候选压缩后约 40×180≈7KB，单次调用可控。重排输出小（只列 id/score），但 `maxTokens` 需≥512（provider 默认 parse 用的 300 不够）。

### 5.2 `/add` —— 复用解析管线

`/add X` = 显式要求 AI 建卡。直接复用现有 `note:create` 语义，但**同步等 AI 完成再返回已发布笔记**（命令栏要即时反馈，不同于 QuickCapture 的后台化）：

```
1. aiService.parse(raw, signal) → SmartParseResult（失败则 heuristicParse 兜底）
2. createNote(cleanedContent, {type,category,tags,title,sensitive,typedData}, status:'published')
3. 广播 EVENT_NOTE_CREATED（主窗口列表/卡片墙已监听 → 自动出现）
4. 返回 { kind:'add', note }
```

> 复用 `notes.ipc.ts` 的创建逻辑：抽出一个共享 `createFromParse()` 供 note-create 与 /add 共用，避免重复。

### 5.3 `/delete` —— 定位 → 确认 → 删除（两段）

**段一（含 AI，可取消）** `run`：
```
1. 召回候选（同 5.1 步骤 1–2）
2. LLM complete(json)：给 query + 候选，返回 { matches: [{id, reason}] }（AI 判定哪些是用户想删的）
3. 返回 { kind:'delete_candidates', query, matches: Note[], reasons }
```
**段二（无 AI）** `confirm`：用户在确认面板勾选/确认 → `aiCommand.confirm({type:'delete', noteIds})` → `removeNote(id)` 逐个 → 广播 `EVENT_NOTE_DELETED` → 返回删除计数。

安全：删除**必须**经确认面板，`run` 只返回候选，绝不直接删。

### 5.4 `/edit` —— 定位 + 预览 → 确认 → 应用（两段）

**段一** `run`：
```
1. 召回候选 → LLM 先定位唯一目标（多候选时返回列表让用户先选目标）
2. 对目标笔记：LLM complete(json) 生成建议修改
     { noteId, proposed: { title?, content?, tags?, category? }, summary }
3. 返回 { kind:'edit_preview', target: Note, proposed, summary }
```
**段二** `confirm`：用户看预览（原值 vs 建议值 diff）→ 确认 → `modifyNote({id, ...proposed})` → 广播 `EVENT_NOTE_UPDATED` → 返回更新后 Note。

### 5.5 自然语言 `/` —— 意图识别

`{type:'search', explicit:false}`（`parseCommand` 对 `/ 文本` 的产出）先过一层意图识别：
```
LLM complete(json): 给自然语言 → { intent: 'search'|'add'|'delete'|'edit', query }
→ 用 intent 重写 AICommand，再走 5.1–5.4
```
展示已识别意图标签（呼应 `ai-command-bar.md` 的「AI 识别意图 → 确认」），delete/edit 天然进确认面板。

## 6. IPC 设计

`src/shared/ipc-channels.ts` 新增：
```ts
AI_COMMAND_RUN:     'ai:command:run'      // invoke → AICommandResult
AI_COMMAND_CANCEL:  'ai:command:cancel'   // invoke(requestId) → void
AI_COMMAND_CONFIRM: 'ai:command:confirm'  // invoke → 删除计数 / 更新后 Note
```
新建 `src/main/ipc/ai-command.ipc.ts`：持有 `Map<string, AbortController>`；`run` 建 controller→调 `AICommandService`→`finally` 删除；`cancel` 按 id abort；`confirm` 执行删除/编辑的应用段。全部 `safeHandler` 包裹。在 `src/main/ipc/index.ts` 注册，注入 `AICommandService`。

`src/preload/index.ts` + `src/renderer/types/electron.d.ts` 暴露：
```ts
aiCommand: {
  run(req: AICommandRequest): Promise<AICommandResult>
  cancel(requestId: string): Promise<void>
  confirm(req: AICommandConfirmRequest): Promise<AICommandConfirmResult>
}
```

## 7. 渲染层状态机 + 确认 UI

命令栏从「idle / processing」扩展为小状态机（`MainView` 持有）：

```
idle ──Enter /cmd──► processing ──成功──► ┌ search/add → done（结果落卡片墙/新卡片）
  ▲                     │                  └ delete/edit → confirming（确认面板）
  │                  终止/Esc                          │
  └──────────────────── cancelled ◄── 取消 ────────────┘
                        error（失败 → 错误提示 + 重试）    confirm → applying → done
```

- **processing**：沿用第 1–4 步 UI（锁定 + 转圈 + 终止按钮），`onAbort` 改为调 `aiCommand.cancel(requestId)`。
- **confirming（新）**：输入框下方渲染 `CommandResultPanel`（新组件 `src/renderer/components/command/CommandResultPanel.tsx`）：
  - delete：候选笔记列表（标题+类型徽章+AI 理由），`[确认删除 N 项] [取消]`。
  - edit：目标笔记 + 原值/建议值 diff，`[应用修改] [取消]`。
  - 多目标 edit：先让用户点选目标，再展开预览。
- **search 结果呈现**：`run` 返回有序 `notes`，写入 store 新字段 `searchResult: { query, noteIds } | null`；`CardWall` 在该字段存在时按给定顺序**平铺**渲染（关系相关序，不做时间分组），顶部一行「AI 搜索: query · N 结果 · 清除」。编辑输入框即清空 `searchResult`（复用第 1–4 步「编辑退出搜索态」逻辑）。
- **error（新）**：失败在下方红字提示 + 可重试；「未配置 AI」引导去设置。

> 输入框内容在整个过程中**保持 `/search X` 不变**（延续用户已确认的模型）。

## 8. 数据类型（`src/shared/types.ts` 新增）

```ts
export interface AICommandRequest {
  id: string                                   // requestId，用于 cancel
  type: 'search' | 'add' | 'delete' | 'edit'
  raw: string
  explicit: boolean                            // false = 自然语言，需先识别意图
}

export type AICommandResult =
  | { kind: 'search'; query: string; notes: Note[] }
  | { kind: 'add'; note: Note }
  | { kind: 'delete_candidates'; query: string; matches: Note[]; reasons: Record<string,string> }
  | { kind: 'edit_preview'; target: Note; proposed: Partial<Pick<Note,'title'|'content'|'tags'|'category'>>; summary: string }
  | { kind: 'intent'; intent: AICommandRequest['type']; query: string }   // 自然语言二段

export type AICommandConfirmRequest =
  | { type: 'delete'; noteIds: string[] }
  | { type: 'edit'; noteId: string; proposed: Partial<Note> }

export type AICommandConfirmResult =
  | { kind: 'deleted'; count: number }
  | { kind: 'edited'; note: Note }
```

## 9. Prompt 设计（`src/main/services/ai/prompts.ts` 新增）

- `RERANK_SYSTEM_PROMPT`：输入 query + 候选（id/type/title/tags/snippet），输出 `{ranked:[{id,relevant,score}]}`；强调按语义相关性、容忍中英混合、无关则 relevant=false。
- `DELETE_LOCATE_SYSTEM_PROMPT`：找出用户描述指向的笔记，输出 `{matches:[{id,reason}]}`；宁缺毋滥（不确定不返回，交由用户）。
- `EDIT_PROPOSE_SYSTEM_PROMPT`：对目标笔记按指令产出 `{proposed:{...}, summary}`；只改必要字段，保留其余。
- `INTENT_SYSTEM_PROMPT`：自然语言 → `{intent, query}`。

均要求「仅输出 JSON」，复用 `extractJSON()` 解析，字段缺失给默认值。

## 10. 错误 / 超时 / 取消 / 成本

- **取消**：终止/Esc → `aiCommand.cancel(id)` → 主进程 `abort` → `run` 以 `AbortError` 拒绝 → 渲染层静默回 idle，**不落任何副作用**（删除/编辑的应用段只在 confirm 触发，天然安全）。
- **超时**：`complete` 内 30s 超时（`AbortSignal.any`），超时按错误处理。
- **无 provider**：`complete` 抛「未配置 AI」，命令栏 error 态引导设置。
- **成本控制**：候选集封顶 40、snippet 截断 160 字、`maxTokens` 分档（parse 沿用、重排 512、意图 256）；**搜索/删除/编辑结果不进 AICache**（数据相关，易失效），仅 `/add` 的 parse 沿用现有缓存。
- **失败降级**：仅 `/add` 可 `heuristicParse` 兜底；search/delete/edit 失败即报错，不臆造结果。

## 11. 从 mock 切真实后端

`MainView` 目前 `USE_MOCK=true`、本地 `notes` state。本步：
- 置 `USE_MOCK=false`，改用 `useNoteStore` 的 `notes` + `fetchNotes()`（事件监听已存在，`/add` `/delete` `/edit` 的广播会自动刷新）。
- `runCommand` 重写为调 `window.electronAPI.aiCommand.run/confirm`，删除临时 `PROCESSING_TEST_DELAY_MS` + `sleep()`（真实 AI 有真实时长，处理态自然可见）。
- 保留第 1–4 步的**本地实时关键词过滤**（无 `/` 输入即时筛选）；`/search` 改为产出 AI `searchResult` 结果集。

## 12. 实施步骤（文件清单）

1. **shared**：`ipc-channels.ts`(+3 通道)、`types.ts`(命令请求/结果/确认类型)。
2. **provider 层**：`base.ts`(接口 + `AICompletionRequest`)、`anthropic.provider.ts` / `openai-compat.provider.ts`(实现 `complete` + signal)、`ai/index.ts`(`AIService.complete` 封装 + 超时)。
3. **prompts**：`prompts.ts`(+4 prompt)。
4. **命令服务**：`ai/command.service.ts`(新，四操作 + 意图)；从 `notes.ipc.ts` 抽 `createFromParse()` 复用。
5. **IPC**：`ai-command.ipc.ts`(新，run/cancel/confirm + AbortController Map)、`ipc/index.ts`(注册)。
6. **preload**：`preload/index.ts` + `renderer/types/electron.d.ts`(暴露 `aiCommand.*`)。
7. **store**：`noteStore.ts`(+`searchResult` 字段与 setter；`committedSearch` 字符串保留给本地实时过滤)。
8. **渲染**：`MainView.tsx`(切真实数据 + 状态机 + 取消/确认 wiring)、`CommandInput.tsx`(error/confirm 态挂点)、`CommandResultPanel.tsx`(新，删除/编辑确认 UI)、`CardWall.tsx`(按 `searchResult` 有序平铺 + 搜索结果头)。
9. **i18n**：`zh-CN.ts` → `en.ts`(意图标签、确认/删除/应用/重试、未配置 AI、AI 搜索结果头等 key)。

> 建议落地顺序：先 2→3→4→5→6 打通主进程 + IPC（可用脚本/单测验证），再 7→8→9 接渲染；四操作按 search → add → delete → edit 逐个点亮，每个可独立验证。

## 13. 验证方案

- **主进程单测**（vitest，参照现有 CLI 集成测试）：`AICommandService.search` 对固定笔记集重排出预期序；`delete/edit` 定位返回预期候选；`complete` 的 signal 取消能拒绝。可对 provider 打桩避免真实网络。
- **手动 E2E**（`pnpm dev`，配好 provider）：
  1. `/search docker 清理镜像` → 语义命中（即使无字面「清理」词），结果头显示 N 结果。
  2. `/add sk-xxx 这是我的 deepseek key` → 生成 apikey 类型、cleanedContent 去掉「这是我的」、卡片即时出现。
  3. `/delete 昨天那条 docker 命令` → 候选面板列出匹配 → 确认 → 卡片消失。
  4. `/edit openai key 改成测试环境` → 预览 diff → 应用 → 卡片更新。
  5. `/ 帮我找 docker 相关` → 识别为 search 并执行。
  6. 处理中点终止/Esc → 立即解锁、无副作用；关掉 provider → 报「未配置 AI」。
- `pnpm typecheck` + `pnpm test` 全绿；切 `en` 语言检查新增 key。

## 14. 未来（不在本步）

- **embedding 向量检索**：若 FTS 召回成为语义瓶颈，再引入 embedding + 向量索引（增量随笔记增删改更新），把 5.1 的召回换成向量召回、LLM 重排不变。
- **流式**：如需「AI 感」，给 `complete` 加 streaming 变体，命令栏处理态改为逐字。
- **QuickCapture（Alt+Space）接入**：本步先做主窗口；Alt+Space 复用 `aiCommand.*` 后续接。
- **多轮/追问**：edit 目标歧义时的多轮澄清。
