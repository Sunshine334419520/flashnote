# 打包方案

## 工具链

- `electron-vite build` — 编译 TS/React 到 `out/`
- `electron-builder package` — 打包为安装包
- `@electron/rebuild` — 为重编译 `better-sqlite3` native 模块

需创建 `electron-builder.yml` 配置文件。

## 平台配置

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

| 方式 | 产物 | 构建机器要求 |
|------|------|------------|
| **Universal Binary** ✅ | 单个 `.dmg`，内含 arm64 + x64 | Apple Silicon Mac（Rosetta 2 交叉编译 x64） |
| 分开构建 | `-arm64.dmg` + `-x64.dmg` 两个文件 | 各自机器或 CI |

推荐 Universal Binary：一个 dmg 覆盖所有 Mac 用户。

## 构建流程

```
pnpm build      # electron-vite 编译
pnpm rebuild    # 重编 better-sqlite3（当前平台）
pnpm package    # electron-builder 打包
# 产物在 dist/ 目录
```

## 三平台构建

| 平台 | 构建方式 | 产物 |
|------|---------|------|
| macOS (universal) | 本地 Mac 或 CI | `FlashNote-0.1.0.dmg` |
| Windows | GitHub Actions `windows-latest` | `FlashNote-0.1.0.exe` |
| Linux | GitHub Actions `ubuntu-latest` | `FlashNote-0.1.0.AppImage` |

建议用 GitHub Actions，push tag 后三平台并行构建。

## 注意事项

- `better-sqlite3` 是 native 模块，每平台/架构需分别编译
- macOS universal 需编译 arm64 + x64 两份
- macOS 分发给用户需 Apple Developer 证书签名，否则提示"无法验证开发者"
- 图标：macOS `.icns`、Windows `.ico`、Linux `.png`

## 待定

- [ ] 创建 `electron-builder.yml`
- [ ] 本地验证 macOS dmg 构建
- [ ] GitHub Actions 多平台构建流水线
- [ ] 代码签名配置
- [ ] 自动更新方案
