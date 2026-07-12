# 底部状态栏设计

## 概述

底部状态栏（Status Bar）是主窗口底部的常驻区域，类似 VS Code 底部栏。左侧排列多个 **icon 按钮**，每个 icon 对应一个功能面板。点击 icon 后从底部向上弹出固定高度的面板，显示详细信息。

当前首要任务是 **AI 操作记录面板**，后续会扩展更多 icon（如 AI Token 使用量等）。

## 架构

```
TaskBar (容器)
  ├── StatusIcon (AI 记录)
  │     └── 点击 → AIOperationPanel（弹出式）
  ├── StatusIcon (Token 用量) ← 预留
  │     └── 点击 → TokenUsagePanel（弹出式）
  └── StatusIcon (...) ← 后续扩展
```

### 弹出式面板

面板覆盖在主内容区上方，不改变页面布局，固定高度 ~300px，内部可滚动。

```
┌──────────────────────────────────────────────┐
│  主内容区（卡片墙）                            │
│                                              │
├──────────────────────────────────────────────┤ ← 面板覆盖
│  AI 操作记录                           ✕     │
│  ───────────────────────────────────────     │
│  ✓  /search "docker compose"        30s前    │
│  ✗  /add    "sk-abcd1234"           1m前  🔄 │
│  ✓  /search "openai key"            3m前     │
│  ...                                         │
│  （最多 60 条，可滚动）                       │
└──────────────────────────────────────────────┘
  Status Bar  [✦ AI]  [⚡ Token]  ...
```

## 数据模型

### AI 操作记录

```
interface AIOperationRecord {
  id: string
  type: 'search' | 'add' | 'delete' | 'edit'
  raw: string          // 原始输入
  status: 'success' | 'failed'
  error?: string       // 失败原因
  duration: number     // 耗时 ms
  createdAt: string    // ISO timestamp
}
```

- 最多保留 **60 条**
- 超出时自动删除最旧的
- 存储方式：SQLite（主进程）或 localStorage（渲染进程）— 待定
- 失败记录支持重试（重新执行原始 input）

### 面板通用接口

```ts
interface StatusBarPanel {
  id: string
  icon: ReactElement     // 状态栏中显示的 icon
  label: string           // tooltip 文字
  badge?: number          // 红色角标（如失败数量）
  panel: ReactElement     // 弹出面板内容
}
```

## AI 操作记录面板

### 状态栏 icon

| 状态 | icon | 描述 |
|------|------|------|
| 就绪 | `✦` (Sparkle) 灰色 | 无活动 |
| 处理中 | `⟳` (Loader) 旋转 | 有正在执行的 AI 操作 |
| 全部成功 | `✓` (Check) 绿色 | 最近操作全部成功 |
| 有失败 | `✗` (X) 红色 + badge | 有失败记录 |

### 面板内容

- **标题栏**：`AI 操作记录` + 关闭按钮
- **列表**：每条一行，包含状态图标、操作类型、原始输入（截断）、耗时、失败时显示重试按钮
- **空态**：暂无 AI 操作记录
- **高度**：300px，最大不超过屏幕 40%

### 记录时机

所有通过 AI 命令执行的操作为记录：
- QuickCapture（Alt+Space）的搜索和创建
- 主窗口命令栏的 `/search`、`/add`、`/delete`、`/edit`
- 后台 AI 分类（`heuristicParse` 之后的异步 refine）

## 扩展规划

| icon | 功能 | 优先级 |
|------|------|--------|
| ✦ AI 记录 | 本次实现 | P0 |
| ⚡ Token 用量 | 显示当前 session 的 token 消耗，点击查看详细 | P1 |
| 🔑 Provider 状态 | 显示当前活跃 AI 服务商，点击切换 | P2 |
| 📊 笔记统计 | 总笔记数、各类型分布 | P3 |

## 待定

- [ ] 记录存储方式：SQLite vs localStorage
- [ ] 是否需要支持清空记录
- [ ] 面板是否需要支持拖拽调整高度
