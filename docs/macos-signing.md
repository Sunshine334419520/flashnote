# macOS 代码签名与公证

## 为什么需要

不签名的 macOS 应用，用户打开时会看到：

> "FlashNote" 无法打开，因为无法验证开发者。

用户只能右键 → 打开绕过，体验差且不信任。

签名 + 公证后，用户双击即可打开，无任何警告。

## 前提条件

- Apple Developer 账号（$99/年）
- 在 [developer.apple.com](https://developer.apple.com) 生成 Developer ID Application 证书
- Xcode 已登录 Apple ID

## 本地构建（签名本机可用）

```bash
# 1. 确认证书存在
security find-identity -v -p basic | grep "Developer ID Application"

# 2. 设置环境变量
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-Specific Password
export APPLE_TEAM_ID="YOURTEAMID"

# 3. 构建（electron-builder 自动签名 + 公证）
pnpm build && pnpm package
```

App-Specific Password 在 [appleid.apple.com](https://appleid.apple.com) → 登录与安全 → App 专用密码 生成。

## GitHub Actions 构建

将证书和密码存入 GitHub Secrets：

| Secret | 值 |
|--------|-----|
| `APPLE_CERTIFICATE_BASE64` | 证书 `.p12` 文件的 base64 编码 |
| `APPLE_CERTIFICATE_PASSWORD` | 证书导出时设的密码 |
| `APPLE_ID` | Apple ID 邮箱 |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-Specific Password |
| `APPLE_TEAM_ID` | Team ID |

Workflow 中在构建前导入证书：

```yaml
- name: Import Apple certificate
  env:
    CERT_BASE64: ${{ secrets.APPLE_CERTIFICATE_BASE64 }}
    CERT_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
  run: |
    echo "$CERT_BASE64" | base64 -d > certificate.p12
    security create-keychain -p "" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "" build.keychain
    security import certificate.p12 -k build.keychain -P "$CERT_PASSWORD" -T /usr/bin/codesign
    security set-key-partition-list -S apple-tool:,apple: -s -k "" build.keychain
```

## 配置文件

`electron-builder.yml` 中取消注释即可：

```yaml
mac:
  identity: "Developer ID Application: Your Name (TEAMID)"
  hardenedRuntime: true
  notarize:
    teamId: "TEAMID"
```

## 参考

- [electron-builder macOS 代码签名文档](https://www.electron.build/code-signing)
- [electron-builder 公证文档](https://www.electron.build/configuration/mac#mac-notarize)
