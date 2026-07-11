# 闪记 搜索与 AI 管线：整体设计与原理

> 本文档记录命令栏背后的**搜索与 AI 执行管线**的整体架构、每一层的原理、以及 FTS 分词的已知问题与优化方案。
> 关联文档：`ai-command-bar.md`(交互规格)、`command-input-architecture.md`(命令输入组件)、`ai-command-execution.md`(第 5 步接入真实 AI 的设计)。

---

## 1. 全局概览

命令栏(`/search /add /delete /edit` + 自然语言 `/`)统一入口 → 主进程 AI 命令服务执行 → 结果回渲染层。搜索是**两阶段管线**:

```
用户命令
  │  渲染层 MainView.runAICommand → IPC aiCommand.run
  ▼
主进程 AICommandService.run  (src/main/services/ai/command.service.ts)
  │
  ├─ ① 若自然语言 → 先意图识别(1 次 AI)
  │
  └─ search 分两步：
       ├─ 阶段一 召回 recallCandidates()   【SQLite FTS5，无 AI，宽召回】
       └─ 阶段二 重排 rerank()             【1 次 AI，精排+过滤】
```

**核心设计原则:召回宽(高召回、低精度)、重排准(AI 精排)。** 召回只负责"别漏",精度交给 AI。

### 各命令的 AI 调用次数

| 触发 | AI 调用 | 步骤 |
|------|:---:|------|
| `/search X`(显式) | **1** | 重排 |
| `/ 自然语言` | **2** | 意图识别 → 对应操作 |
| `/add X` | 1 | 解析(parse) |
| `/delete X` | 1 | 定位候选 |
| `/edit X` | 2 | 定位目标 → 生成修改预览 |

> 显式子命令(`explicit:true`)会**跳过意图识别**。写副作用(删/改)只在用户确认后的 `confirm` 阶段发生。

---

## 2. 阶段一：FTS 召回

### 2.1 存储与索引

- 笔记存 SQLite `notes` 表 + Markdown 文件(`storage.service.ts`)。
- 全文索引是 FTS5 外部内容表(`index.service.ts`):
  ```sql
  CREATE VIRTUAL TABLE notes_fts USING fts5(
    title, content, tags, category,
    content='notes', content_rowid='rowid'
  )
  ```
- **未指定 `tokenize=`,默认 `unicode61`**。索引由 `updateFtsContent()` 手动维护(写入完整 content,而非 `notes` 表里截断的 2000 字预览)。

### 2.2 召回逻辑 `recallCandidates(text, limit)`

```
① 切词：text.trim().replace(/['"]/g,'').split(/\s+/)   ← 只按空格切
② 组 FTS：每词 "term"* 前缀，用 OR 连  →  "a"* OR "b"*
③ FTS5 MATCH，status='published'，ORDER BY rank(BM25)，LIMIT 40
④ 若命中 < 8(RECALL_TOPUP_THRESHOLD) → 用"最近更新的笔记"补齐到 40
⑤ 返回 Note[] → 送 AI 重排
```

**OR 集合语义**:FTS 的 OR 返回**去重并集**——同时命中多个词的笔记只出现一次(BM25 排名更靠前),不重复计数。例:`"openai"*` 命中 4 条、`"key"*` 命中 8 条且前者是后者子集 → 并集 = 8。

### 2.3 【关键问题】分词失效(实测证据)

用查询 `OpenAi的API Key尾部是1111的`(库中 12 条笔记)实测:

| FTS 匹配串 | 命中 |
|-----------|:---:|
| `"OpenAi的API"* OR "Key尾部是1111的"*`(实际召回串) | **0** |
| `"openai"*` | 4 |
| `"key"*` | 8 |
| `"阳光"*`(“阳光的身份证号”开头) | 1 |
| `"身份证"*`(同一串中间) | **0** |
| `"身份"*` | **0** |

**两层病因:**

1. **应用层只按空格切词** → 中英混排被切成 `OpenAi的API`、`Key尾部是1111的` 这种 FTS 匹配不上的"大词组" → 命中 0。
2. **unicode61 把每段连续中文当作单个 token** → `阳光的身份证号` 是一个 token,只能从**开头**前缀匹配(`阳光`✓),中间的 `身份证` 永远搜不到。

**后果:** 命中 0 → 触发第④步兜底 → 把最近全库塞进 AI。现在能用**纯属笔记只有 12 条**(兜底覆盖全库、恰好含目标);**笔记一多(如 500 条),"最近 40 条"未必含目标 → 搜索直接失败**。这也是"召回结果里一堆无关笔记"的根因——它们是兜底进来的,不是匹配出来的。

### 2.4 【已实现】分词方案:trigram + 查询切词器

**目标达成**:中文可**子串**搜(`身份证` 命中 `阳光的身份证号`)、中英混排能正确拆词。选型对比:

| 方案 | 做法 | 结论 |
|------|------|------|
| **A. trigram 分词器 ✅ 采用** | 建表 `tokenize='trigram case_sensitive 0'`,索引所有 3 字滑窗;查询按空白/标点/中英边界切块后 OR | SQLite 3.43 原生;中英子串一步到位;须重建索引;最短 3 字 |
| B. 应用层 bigram 分段 | 索引/查询都把中文切二元组 | 自写分段器、索引膨胀,弃用 |
| C. 仅改查询层 | 不动索引 | 治不了中文子串,弃用 |

**已落地实现:**

1. **索引层(`connection.ts` migration 005)**:`DROP` 旧 `notes_fts` + 触发器 → 用 `tokenize='trigram case_sensitive 0'` 重建 → 重建同款同步触发器 → 从 `notes` + `note_tags` 全量重灌。**首次打开旧库自动迁移**(版本 <5 触发)。
2. **查询层(`index.service.ts`)**:
   - `tokenizeQuery(text)`:转小写 → 在**中英文边界**插空格 → 按"非字母数字中文"切分。
     例:`OpenAi的API Key尾部是1111的` → `["openai","的","api","key","尾部是","1111","的"]`。
   - `ftsMatch(text, op)`:丢弃 **< 3 字**的词(trigram 需 ≥3 字成 gram),其余加引号用 `op` 连接。
     `recallCandidates` 用 **OR**(宽召回),`searchNotes` 用 **AND**(精确)。
3. **短查询回退**:全部词 < 3 字(如 `AI`、单个汉字)→ `ftsMatch` 返回空 → 跳过 FTS、走"最近笔记"兜底 + AI,不报错。

**实测验证(scratch DB):**

| 查询 | 旧(unicode61) | 新(trigram) |
|------|:---:|:---:|
| `"身份证"`(中文中间子串) | 0 ❌ | **1 ✅** |
| `"openai" OR "api" OR "key"`(混排召回) | 0(切词失效) | **1 ✅** |
| `"OPENAI"`(大写) | — | **1 ✅**(case_sensitive 0) |
| `AI`(2 字) | — | 空 → 兜底(安全) |

---

## 3. 阶段二：AI 重排

`search()` 把召回候选交给 LLM 精排(`command.service.ts` → `AIService.complete`)。

### 3.1 请求结构(两条消息)

- **system** = `RERANK_SYSTEM_PROMPT`(`prompts.ts`):规则 + 只输出 JSON `{"interpretation":"…","ranked":[{"i":1,"score":0.0}]}`。
- **user** = `QUERY: <原话>\n\nCANDIDATES:\n[1] type | title | tags | 内容片段(160字)\n[2] …`。
- 参数:`response_format=json_object`,`temperature=0.1`,`max_tokens=2048`。

### 3.2 【关键设计】用序号而非 UUID

候选在 prompt 里编号 `[1][2]…`,AI **只回序号** `{"i":2,"score":0.8}`,本地再把序号映射回 `candidates[i-1]`。

- **为什么**:早期让 AI 回显 36 位 UUID → 费 token、易抄错,且实测出现**响应在 UUID 中间被截断**(`{"id":"7e9be49a-2ab0` 断掉)→ JSON 解析失败 → 静默 0 结果。序号方案把输出缩到约 1/5 且抗截断。

### 3.3 映射与过滤

`score ≥ RELEVANCE_THRESHOLD(0.3)` 保留 → 按 score 降序 → 序号映射回笔记 → 返回。`interpretation`(AI 对语义的理解)写入日志便于排查。

### 3.4 截断与 `finish_reason`

- provider 返回 `{content, finishReason}`;`AIService.complete` 记录 `finishReason`,为 `length` 时额外打 WARN(被 max_tokens 截断)。
- 解析失败(`safeJson` 返回 null)统一走 `logParseFailure()` 显式告警——**"0 结果"永远能区分是"真没匹配"还是"JSON 截断/非法"**。
- 教训:结构化任务要给足 `max_tokens`(尤其模型有内部推理时,推理 token 也吃预算)。

---

## 4. 其它命令

| 命令 | 原理 |
|------|------|
| **add** | `SMART_PARSE_SYSTEM_PROMPT` 解析原始输入 → `{type,title,category,tags,sensitive,cleanedContent}` → `createNote(status:'published')`。走 `complete()`(有日志)+ **失败回退 heuristicParse**。 |
| **delete** | 召回候选 → `LOCATE_SYSTEM_PROMPT` 定位匹配(返回序号+理由,不改动)→ 渲染层确认面板 → `confirm` 才 `removeNote`。 |
| **edit** | 召回 → 定位单个目标(序号)→ 读全文 → `EDIT_PROPOSE_SYSTEM_PROMPT` 生成 `{proposed, summary}` → 确认面板 diff → `confirm` 才 `modifyNote`。 |
| **intent** | 自然语言 `/` 先 `INTENT_SYSTEM_PROMPT` 判 `{intent, query}` 再路由。 |

---

## 5. Provider 抽象

`AIProvider`(`base.ts`):`parse(raw, signal)`、`complete(req): {content, finishReason}`、`testConnection()`。两实现:`AnthropicProvider`(SDK)、`OpenAICompatibleProvider`(fetch,覆盖 DeepSeek/Moonshot/Zhipu/自定义)。

- **`AIService.complete`**:取活跃 provider,**无 provider 直接抛 `NO_ACTIVE_PROVIDER`**(命令操作不静默降级);`AbortSignal.any([用户signal, timeout(30s)])` 合并取消与超时。
- provider 配置存 SQLite `settings` 表 `ai_providers`(含明文 apiKey);`thinking:'enabled'` 时 OpenAI 兼容体带 `thinking` 字段。

---

## 6. IPC 与取消模型

命令栏用 **invoke + 取消通道 + 二次确认**(非 note-create 的 fire-and-forget):

- `ai:command:run`(invoke)→ `AICommandResult`;主进程持 `Map<requestId, AbortController>`。
- `ai:command:cancel`(requestId)→ `abort()`,`run` 以 `AbortError` 拒绝,渲染层静默解锁(无副作用)。
- `ai:command:confirm` → 执行删除/编辑的应用段,广播 `event:note-deleted/updated`。
- `/add` 在 run 成功后广播 `event:note-created`。

渲染层状态机:`idle → processing(锁定/转圈/终止)→ search 结果 / add 刷新 / confirming(删改确认)/ error(重试)`。

---

## 7. 可观测性(日志)

- **本地时间**戳 `[YYYY-MM-DD HH:mm:ss.SSS]`(`logger.ts`,非 UTC);文件 `~/FlashNote/logs/flashnote-<本地日期>.log`,同时输出到 dev 终端。
- **关联 ID**:每条命令用 `req:<requestId>` 串起全链路;每次 AI 调用带 `traceId + label`(如 `search.rerank`)。
- **分层 scope**:`ai:cmd`(生命周期)、`ai:search/add/delete/edit/intent`(各步骤决策)、`ai:complete`(每次 AI 请求/响应 + `finishReason`)、`ai:command`(IPC 层耗时)。
- **脱敏**:`mask.ts` 的 `maskSecrets()` 对 API key 前缀 / 长 token / 银行卡 / 身份证做 redact,**只作用于日志副本,真实请求仍发完整内容**。
- 排查口诀:认准一个 `req` id 从头读到尾,看哪个 `ai:*` 环节开始不对;`ai:complete response` 的 `chars`/`finishReason`/`preview` 是判断截断的关键。

---

## 8. 调优常量与已知边界

集中在 `src/shared/constants.ts` 的 `AI_COMMAND`:

| 常量 | 值 | 含义 |
|------|---|------|
| `CANDIDATE_LIMIT` | 40 | 召回上限 |
| `RECALL_TOPUP_THRESHOLD` | 8 | 命中不足则用最近笔记补齐 |
| `SNIPPET_LENGTH` | 160 | 候选内容片段长度 |
| `RELEVANCE_THRESHOLD` | 0.3 | 搜索结果保留分数线 |
| `MAX_TOKENS.{PARSE,RERANK,LOCATE,EDIT,INTENT}` | 2048/2048/2048/2048/256 | 各操作输出上限 |
| `TIMEOUT_MS` | 30000 | AI 超时 |
| `AI_LOG_PREVIEW_LENGTH` | 4000 | 日志内容预览长度 |

**已知边界 / 路线图:**
- **FTS 分词** ✅ 已解决(§2.4,trigram + 查询切词器):中文子串可搜、中英混排正确拆词。遗留小限制:**< 3 字查询**(如 `AI`、单个汉字)走兜底而非精确匹配。
- **规模**:分词修好后,常规关键词已能真正命中而非依赖"最近笔记"兜底;笔记规模大时若召回仍不足,再评估 embedding。
- **FTS 快路径**(现已解锁):FTS 已能给出高置信答案(命中少且强)时可**跳过 AI 重排**,省掉整次 AI 延迟——分词已可靠,可安排实现。
- **性能**:单次 AI 调用占搜索总耗时 ~100%(deepseek-v4-flash 实测 2.4–6.8s,疑内部推理);优化靠"更快模型 / FTS 快路径 / 结果缓存",与 payload 无关。
- **embedding 向量召回**:根治语义召回(近义、无字面重叠)的长期方案。
- **隐私**:对密文(apikey/credential)做语义搜索时,明文会随每次搜索发往 provider;如需可选择对 sensitive 笔记只发 title+tags。
- **QuickCapture(Alt+Space)**:目前仅主窗口接入,后续复用 `aiCommand.*`。
