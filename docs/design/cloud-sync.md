# 云笔记同步 — 通过用户自有云账号实现多端数据同步

## 状态

**草稿** — 可行性已确认，待详细设计。

## 动机

- 数据目前纯本地存储，换机即丢失
- 不想自建服务端（运维成本、隐私风险）
- 用户已有云笔记/云盘账号，复用比新注册好

## 核心思路

FlashNote **不托管任何服务端**。用户在客户端绑定自己的第三方云账号（Notion / 飞书 / GitHub 等），FlashNote 按统一规范将笔记写入其中：

```
绑定 → 全量上传（首次）→ 增量同步（日常）→ 换机时全量拉取恢复
```

因为数据按规范写入，用户也可以在云笔记中直接查看/搜索笔记内容。

## 候选服务

### Tier 1 — 高优先级

| 服务 | 优势 | 笔记模型 |
|------|------|---------|
| **Notion** | API 完善，OAuth 标准，国际化用户量大 | Database — 每条 note 是一条 record |
| **飞书多维表格** | API 完善，OAuth 标准，国内用户覆盖广 | Bitable — 同 database 模型 |

Notion + 飞书一个国外一个国内，覆盖主要用户群。且两者 API 模型相似（都是"数据库"），适配层可以抽象。

### Tier 2 — 可考虑

| 服务 | 优势 | 方式 |
|------|------|------|
| **GitHub** | 私有 repo 存 markdown，天然版本控制 | 文件存储 |
| **Google Drive** | 用户量大，AppData 目录 | 文件存储 |
| **语雀** | 国内可用 | API（个人版有限） |

### 不适合

- 有道云笔记：无公开 API
- 印象笔记：API 老旧
- 腾讯文档：个人版 API 开放度低

## 数据映射（以 Notion/飞书为例）

| FlashNote 字段 | 云笔记列类型 |
|---------------|------------|
| `title` | 标题 / 文本 |
| `content` | 文本（长文本） |
| `type` | 单选（apikey / credential / command / bookmark / text） |
| `category` | 文本 |
| `tags` | 多选 |
| `updatedAt` | 最后修改时间 |
| `sensitive` | 复选框 |

## 同步策略

1. **首次绑定**：全量上传本地笔记 → 云端
2. **日常同步**：比较 `updatedAt`，增量上传/下载
3. **换机恢复**：绑定同一账号 → 全量拉取 → 合并到本地
4. **冲突**：以 `updatedAt` 为准，本地优先（用户可手动解决）

## 适配器抽象

```ts
interface CloudSyncAdapter {
  name: string                // 'notion' | 'feishu' | 'github'
  auth(): Promise<void>       // OAuth 流程
  sync(notes: Note[]): Promise<SyncResult>
  pull(): Promise<Note[]>     // 从云端拉取
  disconnect(): Promise<void>
}
```

每个服务实现同一个接口，同步引擎不关心具体是哪个云。

## 待讨论

- [ ] 第一个 MVP 选 Notion 还是飞书？
- [ ] 敏感笔记（API key）是否同步？加密后再同步？
- [ ] 附件/图片怎么处理？
- [ ] 协作者场景：多人绑定同一个云笔记空间 = 共享？
