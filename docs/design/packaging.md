# 打包与发布方案

## 工具链

- `electron-vite build` — 编译 TS/React 到 `out/`
- `electron-builder package` — 打包为安装包
- `@electron/rebuild` — 重编译 `better-sqlite3` native 模块

## 平台配置 (`electron-builder.yml`)

```yaml
appId: com.flashnote.app
productName: FlashNote

mac:
  target: dmg
  arch: [arm64, x64]    # universal binary
  icon: assets/icons/icon.icns

win:
  target: nsis
  arch: [x64]
  icon: assets/icons/icon.ico

linux:
  target: AppImage
  arch: [x64]
  icon: assets/icons/icon.png
```

## macOS Apple Silicon + Intel

| 方式 | 产物 | 说明 |
|------|------|------|
| **Universal Binary** | 单个 `.dmg`，内含 arm64 + x64 | Apple Silicon Mac 本地构建，electron-builder 通过 Rosetta 2 交叉编译 x64 native 模块 |
| 分开构建 | `-arm64.dmg` + `-x64.dmg` | 两个独立安装包 |

推荐 Universal Binary — 用户无感知，和 VS Code、Discord 一样。

## 本地构建流程

```
pnpm build      # electron-vite 编译 TS/React/CSS
pnpm rebuild    # 重编 better-sqlite3（当前平台/架构）
pnpm package    # electron-builder 打包 → dist/
```

---

## GitHub Actions：三平台自动构建 + 发布

### 概述

GitHub Actions 是 GitHub 提供的免费 CI/CD 服务（公开仓库无限使用）。三台虚拟机并行构建，产物自动上传到 GitHub Release。

| Runner | 架构 | 用于 | 免费额度 |
|--------|------|------|:---:|
| `macos-latest` | Apple Silicon (M系列) | macOS universal dmg | 无限 |
| `windows-latest` | x64 | Windows exe | 无限 |
| `ubuntu-latest` | x64 | Linux AppImage | 无限 |

### 触发流程

```
开发者推送 tag → GitHub Actions 自动触发
   │
   │  git tag v0.1.0 && git push --tags
   │
   ▼
┌─────────────────────────────────────────────────────┐
│  GitHub Actions (三台虚拟机并行)                      │
│                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐       │
│  │ macos    │   │ windows  │   │ ubuntu   │       │
│  │ 拉代码    │   │ 拉代码    │   │ 拉代码    │       │
│  │ pnpm i   │   │ pnpm i   │   │ pnpm i   │       │
│  │ rebuild  │   │ rebuild  │   │ rebuild  │       │
│  │ build    │   │ build    │   │ build    │       │
│  │ package  │   │ package  │   │ package  │       │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘       │
│       │              │              │              │
│       ▼              ▼              ▼              │
│  .dmg (universal)  .exe (x64)   .AppImage (x64)   │
│       │              │              │              │
│       └──────────────┼──────────────┘              │
│                      ▼                              │
│           上传到 GitHub Release                      │
│    https://github.com/.../releases/tag/v0.1.0       │
└─────────────────────────────────────────────────────┘
```

用户访问 GitHub Release 页面，下载对应平台的文件。

### Workflow 文件结构

`.github/workflows/release.yml`：

```yaml
name: Release

on:
  push:
    tags: ['v*']          # v0.1.0 这种 tag 触发

jobs:
  macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm rebuild     # 重编 better-sqlite3 (arm64 + Rosetta x64)
      - run: pnpm build
      - run: pnpm package
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*.dmg

  windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm rebuild
      - run: pnpm build
      - run: pnpm package
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*.exe

  linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm rebuild
      - run: pnpm build
      - run: pnpm package
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/*.AppImage
```

### 发布操作

```bash
# 开发者只需两步：
pnpm version patch              # 自动 bump 版本号 + git tag（如 0.1.0 → 0.1.1）
git push --follow-tags          # 推送代码和 tag，触发 GitHub Actions
# 等几分钟后 GitHub Release 上就有三个平台的包了
```

---

## 扩展：上传到自己服务器（后续）

GitHub Actions 构建完后可以做任何事，替换或追加到发布流程中：

```
构建完成
  ├─→ softprops/action-gh-release  → GitHub Release（默认，免费）
  ├─→ scp dist/* → 自己的服务器      （追加）
  └─→ curl POST → 自建 API          （追加）
```

服务器密钥存在 GitHub Settings → Secrets 中，不会泄露。

---

## 版本管理

### 工具

使用 `pnpm version`（npm 内置），无需额外工具。

### 版本号规范（SemVer）

```
主版本.次版本.修订号
   MAJOR.MINOR.PATCH

PATCH (0.0.x) — 修 bug，不改功能
MINOR (0.x.0) — 新功能，向后兼容
MAJOR (x.0.0) — 不兼容的大改动，1.0 之前随意
```

0.x 阶段侧重快速迭代，`MINOR` 用于新功能，`PATCH` 用于修复。

### 发版操作

```bash
# 修 bug
pnpm version patch    # 0.1.0 → 0.1.1，自动创建 git tag v0.1.1

# 新功能
pnpm version minor    # 0.1.0 → 0.2.0

# 正式版
pnpm version major    # 0.1.0 → 1.0.0

# 推送 tag，触发 GitHub Actions 构建
git push --follow-tags
```

### 版本显示

状态栏右侧常驻显示 `v0.1.0`，自动跟随 `package.json` 的 version 字段。

---

## 注意事项

- `better-sqlite3` 是 native 模块，每平台/架构需独立编译
- macOS universal 需 Rosetta 2 交叉编译 x64 版 native 模块
- **代码签名**：macOS 分发需要 Apple Developer 证书（$99/年），否则用户打开提示"无法验证开发者"。可先用 `brew install --cask` 自签名或让用户右键打开绕过
- 图标：macOS `.icns`、Windows `.ico`、Linux `.png`

## 待办

- [ ] 创建 `electron-builder.yml`
- [ ] 本地验证 `pnpm package` 打出 macOS dmg
- [ ] 创建 `.github/workflows/release.yml`
- [ ] 测试 tag push 自动构建流程
- [ ] 代码签名（Apple Developer 证书）
- [ ] 自动更新（electron-updater）
