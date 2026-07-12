<p align="center">
  <img src="assets/icons/v2/icon_dock_256x256.png" alt="FlashNote 闪记" width="80" height="80">
</p>

<h1 align="center">FlashNote 闪记</h1>

<p align="center">
  <strong>AI 原生的智能笔记工具。随手记录，AI 自动分类、打标签、结构化整理。</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="版本"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="协议"></a>
  <a href="README.md">English</a>
</p>

<!-- TODO: 替换为实际截图 -->
<p align="center">
  <img src="docs/screenshots/hero.png" alt="FlashNote 快捷窗口" width="680">
</p>

---

## 为什么选择闪记

| | 传统笔记 | 闪记 |
|---|:---:|:---:|
| **记录** | 打开 App → 新建 → 输入 → 手动分类 | `Alt+Space` → 输入 → 完成 |
| **整理** | 手动建文件夹、打标签 | AI 自动分类、自动标签 |
| **查找** | 翻文件夹、回忆路径 | 输入关键词即搜即得 |
| **数据** | 锁在云端 | Markdown + SQLite 纯本地 |

### 三个设计原则

- **卡片墙而非文件列表** — 每条笔记都是一张类型化卡片（API Key / 书签 / 命令 / 凭据 / 文本），一键直达核心操作。
- **AI 驱动** — 自然语言输入自动解析为结构化笔记，语义搜索理解你的意思而非只匹配字面。
- **数据归你所有** — 所有内容纯本地存储，无需账号、不上传服务器。

---

## 核心功能

### Alt+Space 快捷窗口

任何界面下按 `Alt+Space`，弹出一个类 Spotlight 的输入窗口：

```
"sk-abc123 我的 OpenAI key"  → ✨ AI 自动创建 API Key 卡片
"docker compose 启动命令"     → 🔍 即时搜索 → Enter 一键复制
"https://react.dev"          → 🌐 自动识别为书签
```

不需要 `/` 前缀，不需要切换模式。输入内容，按 Enter，AI 自动判断意图。

### 五种卡片类型，一键操作

| 类型 | 图标 | 主操作 | 举例 |
|------|:---:|------|------|
| **API Key** | `🔑` | 一键复制 | OpenAI、DeepSeek 密钥 |
| **命令** | `💻` | 一键复制 | docker、git、shell 片段 |
| **凭据** | `🛡` | 一键复制 | 各类登录凭证 |
| **书签** | `🌐` | 打开链接 | 技术文档、常用网址 |
| **文本** | `📝` | 查看全文 | 会议记录、灵感想法 |

> 敏感数据支持一键显示/隐藏。

<!-- TODO: 替换为实际截图 -->
![卡片墙](docs/screenshots/card-wall.png)

### AI 命令栏

主窗口内使用 `/` 命令精确控制：

| 命令 | 功能 |
|------|------|
| `/search docker 相关命令` | AI 语义搜索 |
| `/add sk-xxx 这是我的密钥` | AI 解析并创建笔记 |
| `/delete 昨天那条 docker 命令` | AI 定位笔记 → 确认删除 |
| `/edit openai key 改成生产环境` | AI 找到笔记 → 预览修改 → 确认更新 |

<!-- TODO: 替换为实际截图 -->
![AI 命令](docs/screenshots/ai-command.png)

### 多服务商 AI 支持

配置你自己的 AI 服务，支持主流服务商：

- **Anthropic** — Claude Haiku, Sonnet, Opus
- **OpenAI** — GPT-4o, GPT-4o-mini
- **DeepSeek** — deepseek-chat, deepseek-reasoner
- **Moonshot / 智谱 / 自定义** — 任意 OpenAI 兼容接口

<!-- TODO: 替换为实际截图 -->
![设置](docs/screenshots/settings.png)

### AI 操作记录

每次 AI 操作都有记录。点击状态栏的 `✦ AI` 查看操作历史，失败的操作可一键重试。

<!-- TODO: 替换为实际截图 -->
![状态栏](docs/screenshots/status-bar.png)

---

## 快速开始

### 下载安装

前往 [Releases](https://github.com/Sunshine334419520/flashnote/releases) 下载最新版本：

- **macOS** — `FlashNote-0.x.x.dmg`（支持 Apple Silicon 和 Intel）
- **Windows** — `FlashNote-0.x.x.exe`
- **Linux** — `FlashNote-0.x.x.AppImage`

> macOS 提示：应用尚未签名，首次打开请右键 → 打开 即可绕过 Gatekeeper。

### 开发

```bash
# 环境要求：Node ≥22, pnpm ≥10
git clone https://github.com/Sunshine334419520/flashnote.git
cd flashnote
pnpm install
pnpm dev          # 启动开发环境（Electron + 热更新）
pnpm test         # 运行 56 个测试
pnpm typecheck    # TypeScript 类型检查
```

环境初始化：克隆后在项目中使用 `/bootstrap-env` 命令一键配置开发环境。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 42 |
| 前端 | React 19 + Tailwind CSS v4 + Zustand |
| 构建 | electron-vite (Vite) |
| 存储 | better-sqlite3 (WAL, FTS5 · trigram) + Markdown 文件 |
| AI | Anthropic SDK + OpenAI 兼容 fetch |
| 国际化 | React Context (zh-CN / en) |

---

## 协议

MIT © FlashNote
