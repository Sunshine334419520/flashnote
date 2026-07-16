# 云同步 — 架构设计

## 状态

**设计中** — 基于产品设计文档（`cloud-sync-product.md`），MVP 实现 Notion 接入。

> **实现指南**：CLAUDE.md 的「Extension Patterns」章节记录了各层的标准扩展方式（StatusBar item、Settings section、IPC channel、Service adapter、DB migration）。本设计方案按这些模式组织，实现时对照 CLAUDE.md 操作即可。

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  Renderer (React)                                               │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │ StatusBar    │  │ SettingsView     │  │ MainView          │ │
│  │ CloudSyncItem│  │ CloudSyncSettings│  │ (事件监听)         │ │
│  └──────┬───────┘  └────────┬─────────┘  └───────────────────┘ │
│         │                   │                                   │
│         └──────────┬────────┘                                   │
│                    │ window.electronAPI.cloud.*                 │
├────────────────────┼────────────────────────────────────────────┤
│  Preload (IPC)     │                                            │
│                    │ ipcRenderer.invoke('cloud:*')              │
├────────────────────┼────────────────────────────────────────────┤
│  Main Process      │                                            │
│  ┌─────────────────┴──────────────────────────────────┐        │
│  │  cloud-sync.ipc.ts  ← IPC handlers                 │        │
│  └────────┬───────────────────────────────────────────┘        │
│           │                                                     │
│  ┌────────┴───────────────────────────────────────────┐        │
│  │  sync-engine.ts     ← 同步引擎（全量/增量/冲突）      │        │
│  └────────┬───────────────────────────────────────────┘        │
│           │                                                     │
│  ┌────────┴───────────────────────────────────────────┐        │
│  │  adapter.ts          ← CloudSyncAdapter 接口        │        │
│  │  notion.adapter.ts   ← Notion API 实现              │        │
│  └────────┬───────────────────────────────────────────┘        │
│           │                                                     │
│  ┌────────┴───────────────────────────────────────────┐        │
│  │  auth-server.ts      ← 本地 HTTP OAuth 回调服务器    │        │
│  └────────────────────────────────────────────────────┘        │
│                                                                 │
│  存储层:                                                        │
│  ┌──────────────────────┐  ┌─────────────────────────┐        │
│  │ SQLite                │  │ Notion API (HTTPS)       │        │
│  │ cloud_connections 表  │  │ api.notion.com           │        │
│  └──────────────────────┘  └─────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## 数据模型

### SQLite — `cloud_connections` 表

```sql
CREATE TABLE IF NOT EXISTS cloud_connections (
  id            TEXT PRIMARY KEY,            -- UUID
  service       TEXT NOT NULL,               -- 'notion' | 'feishu'
  access_token  TEXT NOT NULL,               -- OAuth access token
  workspace_id  TEXT,                        -- Notion workspace ID
  workspace_name TEXT,                       -- 可读名称
  account_name  TEXT,                        -- 用户显示名
  account_email TEXT,                        -- 用户邮箱
  database_id   TEXT,                        -- Notion 中我们的数据库 ID
  database_url  TEXT,                        -- 数据库在 Notion 中的 URL
  last_sync_at  TEXT,                        -- ISO 时间戳
  status        TEXT NOT NULL DEFAULT 'disconnected',  -- disconnected | connecting | connected | error
  error         TEXT,                        -- 最近错误信息
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

### 共享类型（`src/shared/types.ts` 新增）

```ts
export type CloudServiceType = 'notion' | 'feishu'

export interface CloudConnection {
  id: string
  service: CloudServiceType
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  workspaceName?: string
  accountEmail?: string
  databaseUrl?: string
  lastSyncAt?: string
  error?: string
  createdAt: string
}

export interface SyncProgress {
  phase: 'idle' | 'pushing' | 'pulling' | 'comparing'
  current: number
  total: number
}

export interface SyncResult {
  pushed: number
  pulled: number
  skipped: number
  errors: string[]
}
```

### Notion 数据库列映射

| FlashNote 字段 | Notion 列名 | Notion 类型 | 方向 |
|---------------|------------|------------|------|
| `title` | 标题 | `title` | 双向 |
| `content` | 内容 | `rich_text` (long) | 双向 |
| `type` | 类型 | `select` | 双向 |
| `category` | 分类 | `select` | 双向 |
| `tags` | 标签 | `multi_select` | 双向 |
| `sensitive` | 敏感 | `checkbox` | 双向 |
| `status` | 状态 | `select` | 双向 |
| 所有内部字段 | `_meta` | `rich_text` (JSON) | 双向 |

## IPC 通道设计

### 新增通道（`src/shared/ipc-channels.ts`）

```ts
// Cloud Sync
CLOUD_CONNECT:     'cloud:connect',      // 发起 OAuth 连接
CLOUD_DISCONNECT:  'cloud:disconnect',   // 断开连接
CLOUD_GET_STATUS:  'cloud:get-status',   // 获取连接状态
CLOUD_SYNC:        'cloud:sync',         // 手动触发同步
CLOUD_PULL:        'cloud:pull',         // 全量拉取（换机恢复）

// Events (main → renderer push)
EVENT_CLOUD_STATUS_CHANGED: 'event:cloud-status-changed',
EVENT_CLOUD_SYNC_PROGRESS:  'event:cloud-sync-progress',
```

### IPC 调用流

```
渲染进程                          主进程
───────                          ──────

cloud:connect(service) ────────▶ OAuth 流程:
                                 1. 启动本地 HTTP 服务器 (随机端口)
                                 2. 打开浏览器 → Notion 授权
                                 3. 收到回调 code
                                 4. 用 code 换 access_token
                                 5. 获取用户信息
                                 6. 创建/查找 Notion 数据库
                                 7. 存储连接信息到 SQLite
                                 8. 全量上传本地笔记
                                 9. 关闭 HTTP 服务器
                                10. broadcast 状态变更
              ◀──────────────── 返回 CloudConnection

cloud:disconnect(id) ──────────▶ 1. 删除 SQLite 中连接
                                 2. broadcast 状态变更
              ◀──────────────── void

cloud:get-status() ────────────▶ 从 SQLite 读取连接状态
              ◀──────────────── CloudConnection | null

cloud:sync() ───────────────────▶ 增量同步
                                 1. 比较本地/云端
                                 2. 推送新/改的笔记
                                 3. 拉取云端的更新
                                 4. broadcast 进度事件
              ◀──────────────── SyncResult

cloud:pull() ───────────────────▶ 全量拉取
                                 1. 从 Notion 拉取所有行
                                 2. 解析 _meta 还原笔记
                                 3. 合并到本地 SQLite
              ◀──────────────── { imported: number }
```

## OAuth 认证流程

### Notion OAuth 配置

在 Notion Integration 设置中配置：
- **Redirect URI**: `http://localhost:{port}/callback`（端口动态分配，需注册多个或使用 loopback 模式）
- **Scopes**: 按需请求最小权限

> Notion 的 Public Integration OAuth 要求预先注册 redirect URI。对于动态端口，有两种方案：
> 1. 注册一个固定端口（如 `18923`），启动时如果被占用就换一个
> 2. 使用 Notion 的 `redirect_uri` 通配模式（如果支持）
>
> 具体方案在实现阶段确认 Notion API 的最新要求。

### 流程（`auth-server.ts`）

```
1. 用户点击「连接 Notion」
2. 主进程生成 state（防 CSRF），分配随机端口
3. 启动本地 HTTP 服务器
4. 构造 OAuth URL:
   https://api.notion.com/v1/oauth/authorize?
     client_id={CLIENT_ID}&
     redirect_uri=http://localhost:{port}/callback&
     response_type=code&
     state={state}&
     owner=user
5. shell.openExternal(url) → 系统浏览器打开授权页
6. 用户在浏览器中登录并授权
7. Notion 重定向到 http://localhost:{port}/callback?code=xxx&state=yyy
8. 本地服务器验证 state，拿到 code
9. POST /v1/oauth/token 用 code 换 access_token
10. 返回 success HTML 页面给浏览器
11. 存储 token + 用户信息到 SQLite
12. 创建/定位 Notion 数据库
13. 全量上传
14. 关闭服务器
15. broadcast EVENT_CLOUD_STATUS_CHANGED
```

### Token 安全

- Access token 明文存储在本地 SQLite（和 AI API key 一致）
- 不存储 refresh token（Notion OAuth 目前不发 refresh token）
- Token 仅通过 HTTPS 传输
- 断开连接时从 SQLite 中彻底删除

## Adapter 接口

```ts
// src/main/services/cloud/adapter.ts

export interface CloudSyncAdapter {
  readonly service: CloudServiceType

  /** 获取授权 URL（OAuth 流程第一步） */
  getAuthUrl(state: string, redirectUri: string): string

  /** 用授权码换 access token */
  exchangeCode(code: string, redirectUri: string): Promise<AuthResult>

  /** 获取当前用户信息 */
  getUserInfo(accessToken: string): Promise<UserInfo>

  /** 确保数据库存在，不存在则创建。返回 database_id */
  ensureDatabase(accessToken: string): Promise<DatabaseInfo>

  /** 查询所有笔记行 */
  listNotes(accessToken: string, databaseId: string, since?: string): Promise<RemoteNote[]>

  /** 创建一条笔记行 */
  createNote(accessToken: string, databaseId: string, note: NoteForSync): Promise<string>

  /** 更新一条笔记行 */
  updateNote(accessToken: string, pageId: string, note: NoteForSync): Promise<void>

  /** 删除（归档）一条笔记行 */
  deleteNote(accessToken: string, pageId: string): Promise<void>
}

export interface AuthResult {
  accessToken: string
  workspaceId: string
  workspaceName: string
  accountName?: string
  accountEmail?: string
}

export interface UserInfo {
  name: string
  email?: string
  avatarUrl?: string
}

export interface DatabaseInfo {
  id: string
  url: string
}

export interface RemoteNote {
  pageId: string          // Notion page ID
  flashnoteId: string     // 从 _meta JSON 中解析
  title: string
  content: string
  type: string
  category: string
  tags: string[]
  sensitive: boolean
  status: string
  meta: NoteMeta           // 完整的 _meta 对象
  lastEditedAt: string     // Notion 的 last_edited_time
}

export interface NoteMeta {
  v: number               // 同步协议版本
  id: string              // FlashNote UUID
  ca: string              // 创建时间
  ua: string              // 最后修改时间
  ic: boolean             // 是否已 AI 分类
  me: boolean             // 是否手动编辑
  sh: string              // 来源
  td: Record<string, unknown>  // 类型特有数据
}

export interface NoteForSync {
  title: string
  content: string
  type: string
  category: string
  tags: string[]
  sensitive: boolean
  status: string
  meta: string            // JSON.stringify(NoteMeta)
}
```

## 同步引擎

### `sync-engine.ts`

```ts
export class SyncEngine {
  constructor(
    private adapter: CloudSyncAdapter,
    private connection: CloudConnection
  ) {}

  /** 全量同步：双向比较，增量推送/拉取 */
  async syncAll(): Promise<SyncResult>

  /** 仅推送单条笔记（自动同步的增量上传） */
  async pushNote(noteId: string): Promise<void>

  /** 仅删除单条笔记 */
  async deleteRemoteNote(noteId: string): Promise<void>

  /** 全量拉取（换机恢复） */
  async pullAll(): Promise<{ imported: number }>
}
```

### 同步算法

```
syncAll():
  localNotes  ← storage.listAll()
  remoteNotes ← adapter.listNotes(databaseId)

  localMap   ← Map(localNotes,  key: id)
  remoteMap  ← Map(remoteNotes, key: flashnoteId)

  toPush   ← []
  toPull   ← []
  toUpdate ← []  // 需要判断方向

  for each local in localNotes:
    remote ← remoteMap[local.id]
    if remote == null:
      toPush.push(local)
    else if local.updatedAt > remote.meta.ua:
      toPush.push(local)           // 本地更新 → 推送
    else if remote.meta.ua > local.updatedAt:
      toPull.push(remote)          // 云端更新 → 拉取
    // equal → 跳过

  for each remote in remoteNotes:
    if remote.flashnoteId not in localMap:
      toPull.push(remote)          // 云端新增 → 拉取

  // 处理已删除的笔记：本地有记录但 Notion 中已不存在
  // → 不做任何事（可能是用户在 Notion 中删了，保留本地版本）
  // → 如果本地已删除但 Notion 还有 → 本地下次 pushNote 时不会找到，手动同步时会在 toPush 中

  result ← { pushed: 0, pulled: 0, skipped: 0, errors: [] }

  for each note in toPush:
    try:
      if remoteMap has note.id:
        adapter.updateNote(remoteMap[note.id].pageId, toNotionFormat(note))
      else:
        adapter.createNote(databaseId, toNotionFormat(note))
      result.pushed++
    catch e: result.errors.push(e.message)

  for each remote in toPull:
    try:
      localNote ← remoteToLocal(remote)
      storage.upsertNote(localNote)
      result.pulled++
    catch e: result.errors.push(e.message)

  result.skipped ← localNotes.length - result.pushed
  update last_sync_at in cloud_connections

  return result
```

### 自动同步触发

在 `notes.ipc.ts` 的 create/update/delete handler 中，操作成功后：

```ts
// 伪代码
async function handleCreateNote(args) {
  const note = await storage.createNote(args)
  broadcast(EVENT_NOTE_CREATED, note)

  // 如果云同步已连接 → 延迟推送
  scheduleCloudPush(note.id, 'create')
}

async function handleUpdateNote(args) {
  const note = await storage.updateNote(args)
  broadcast(EVENT_NOTE_UPDATED, note)

  scheduleCloudPush(note.id, 'update')
}

async function handleDeleteNote(id) {
  await storage.deleteNote(id)
  broadcast(EVENT_NOTE_DELETED, id)

  scheduleCloudPush(id, 'delete')
}
```

**防抖策略**：`scheduleCloudPush` 收集 3 秒内的操作，合并后批量推送。

```ts
const pushQueue = new Map<string, 'create' | 'update' | 'delete'>()
let pushTimer: NodeJS.Timeout | null = null

function scheduleCloudPush(noteId: string, action: string) {
  // 合并同一笔记的连续操作
  const existing = pushQueue.get(noteId)
  if (existing === 'create' && action === 'delete') {
    pushQueue.delete(noteId)  // 创建后立即删除 → 不需要同步
    return
  }
  pushQueue.set(noteId, action as any)

  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => flushPushQueue(), 3000)
}
```

## 前端组件

### 新增文件

```
src/renderer/
  components/statusbar/panels/
    CloudSyncPanel.tsx          ← 底部栏弹出面板
  components/settings/
    CloudSyncSettings.tsx        ← Settings 中的云同步设置
  stores/
    cloudSyncStore.ts            ← Zustand store
```

### `cloudSyncStore.ts`

```ts
interface CloudSyncState {
  connection: CloudConnection | null
  syncProgress: SyncProgress | null
  isLoading: boolean

  fetchStatus: () => Promise<void>
  connect: (service: CloudServiceType) => Promise<void>
  disconnect: () => Promise<void>
  sync: () => Promise<void>
  pull: () => Promise<void>
}
```

- `connection` 通过 IPC `cloud:get-status` 初始化
- 监听 `event:cloud-status-changed` 实时更新
- 监听 `event:cloud-sync-progress` 更新进度条

### `CloudSyncPanel.tsx`

底部栏面板，高度 ~200px。根据连接状态显示不同内容（参考产品设计文档）。

### `CloudSyncSettings.tsx`

设置页 section，格式对齐 `AIProviderSettings`：
- 标题行 + 说明文字
- 服务卡片（当前只有 Notion 可用，飞书灰显）
- 已连接：显示详情 + 操作按钮
- 未连接：显示「连接 Notion」按钮

## 主进程新增文件

```
src/main/
  services/cloud/
    auth-server.ts              ← 本地 HTTP OAuth 回调服务器
    adapter.ts                  ← CloudSyncAdapter 接口 + 类型
    notion.adapter.ts           ← Notion API 封装
    sync-engine.ts              ← 同步引擎（算法 + 防抖）
  ipc/
    cloud-sync.ipc.ts           ← IPC 处理器
```

### `auth-server.ts`

```ts
export class OAuthServer {
  private server: http.Server | null = null
  private port: number = 0

  /**
   * 启动本地 HTTP 服务器，返回 { port, url }
   */
  async start(): Promise<{ port: number }>

  /**
   * 等待 OAuth 回调，返回 { code, state }
   */
  waitForCallback(timeoutMs?: number): Promise<{ code: string; state: string }>

  /**
   * 发送成功响应页面给浏览器
   */
  sendSuccessPage(): void

  /**
   * 关闭服务器
   */
  stop(): Promise<void>
}
```

实现细节：
- 使用 Node.js 内置 `http` 模块（无依赖）
- 随机端口：`server.listen(0)` 让 OS 分配
- 超时：默认 5 分钟，超时后自动关闭
- 只处理一个回调请求

### `notion.adapter.ts`

实现 `CloudSyncAdapter` 接口，封装 Notion API 调用：
- HTTP 请求使用 `fetch`（Node 18+ 内置）
- 所有请求带 `Authorization: Bearer {token}`
- 必须带 `Notion-Version: 2022-06-28` header
- 错误处理：401 → token 失效，更新连接状态

主要 API 端点：
```
POST   /v1/oauth/token             换 token
GET    /v1/users/me                用户信息
POST   /v1/search                  搜索数据库
POST   /v1/databases               创建数据库
POST   /v1/databases/{id}/query    查询行
POST   /v1/pages                   创建行
PATCH  /v1/pages/{id}              更新行
PATCH  /v1/blocks/{id}             归档行（删除）
```

## Schema 迁移

在 `database/schema.ts` 中新增迁移：

```ts
{
  version: 6,
  sql: `
    CREATE TABLE IF NOT EXISTS cloud_connections (
      id            TEXT PRIMARY KEY,
      service       TEXT NOT NULL,
      access_token  TEXT NOT NULL,
      workspace_id  TEXT,
      workspace_name TEXT,
      account_name  TEXT,
      account_email TEXT,
      database_id   TEXT,
      database_url  TEXT,
      last_sync_at  TEXT,
      status        TEXT NOT NULL DEFAULT 'disconnected',
      error         TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );
  `
}
```

## 实现顺序

| 步骤 | 内容 | 依赖 |
|------|------|------|
| 1 | 类型定义 (`types.ts`, `ipc-channels.ts`) | - |
| 2 | Schema 迁移 (cloud_connections 表) | 1 |
| 3 | `auth-server.ts` (OAuth 回调) | 1 |
| 4 | `adapter.ts` + `notion.adapter.ts` | 1 |
| 5 | `sync-engine.ts` | 2, 4 |
| 6 | `cloud-sync.ipc.ts` | 3, 5 |
| 7 | Preload 暴露 `window.electronAPI.cloud.*` | 6 |
| 8 | `cloudSyncStore.ts` | 7 |
| 9 | `CloudSyncPanel.tsx` (底部栏) | 8 |
| 10 | `CloudSyncSettings.tsx` (设置页) | 8 |
| 11 | `MainView.tsx` 集成 StatusBarItem | 9 |
| 12 | `SettingsView.tsx` 集成 CloudSyncSettings | 10 |
| 13 | `notes.ipc.ts` 集成自动同步 | 5, 6 |
| 14 | 定时轮询 (每 5 分钟) | 5, 6 |

## 待确认（实现前）

- [ ] Notion OAuth 需要注册 Public Integration，获取 Client ID / Secret
- [ ] Notion 的 redirect URI 是否支持 localhost 动态端口？如果不支持，需要固定端口或使用其他方案
- [ ] 数据库创建后的初始属性（列定义）需要和 Notion API 对齐
- [ ] 定时轮询间隔：5 分钟是否合理？Notion API 有 rate limit
