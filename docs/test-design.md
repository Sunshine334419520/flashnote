# 集成测试用例设计文档

## 核心原则

FlashNote 的 capture 命令接收**任意自然语言输入**，AI 负责解析并输出结构化结果。测试用例的设计目的是验证：无论用户怎么输入，AI 都能正确理解意图。

## capture 预期行为矩阵

### 规则 1：类型识别

| 用户输入 | 期望 type | 依据 |
|---------|----------|------|
| `sk-xxx 我的api key` | `apikey` | 以 `sk-` / `api-` / `token-` / `ghp_` 等开头 |
| `git clone https://...` | `command` | 以 `git` / `docker` / `npm` / `kubectl` 等 CLI 关键词开头 |
| `https://example.com 说明` | `bookmark` | 以 `https://` 或 `http://` 开头 |
| `6222021234567890 银行卡` | `credential` | 连续数字 + 银行卡/密码/身份证 等关键词 |
| `421087199608280052 身份证` | `credential` | 18 位数字 + 身份证关键词 |
| `今天天气真好` | `text` | 以上都不匹配，默认 |

### 规则 2：敏感标记

| type | sensitive | 原因 |
|------|-----------|------|
| `apikey` | `true` | API 密钥泄露风险 |
| `credential` | `true` | 银行卡、身份证等隐私信息 |
| `command` | `false` | 命令本身不敏感 |
| `bookmark` | `false` | URL 不敏感 |
| `text` | `false` | 普通文本不敏感 |

### 规则 3：分类

| 输入特征 | 期望 category |
|---------|--------------|
| API 密钥/Token | `API Keys & Credentials` |
| CLI 命令/代码 | `Code Snippets` |
| URL/链接 | `Bookmarks & Links` |
| 银行卡/密码/身份证 | `API Keys & Credentials` |
| 其他 | `Other` |

### 规则 4：降级策略

当 AI Provider 未配置或调用失败时，使用 heuristicParse（纯本地规则）兜底，确保笔记始终能保存。测试环境无 AI Provider，全部走 heuristicParse。

---

## 当前 20 个集成测试用例

### 一、capture 类型检测（7 个）

```
1. 输入: "sk-a6110badef0540d180d8670619393b49 我的deepseek api key"
   断言: type=apikey, category=API Keys, sensitive=true, 有 Saved 输出

2. 输入: "git clone https://github.com/example/repo.git"
   断言: type=command, category=Code Snippets

3. 输入: "https://claude.ai/code 这是claude code官网"
   断言: type=bookmark, category=Bookmarks & Links

4. 输入: "6222021234567890 我的招商银行卡"
   断言: type=credential, sensitive=true

5. 输入: "421087199608280052 身份证号码"
   断言: type=credential, sensitive=true

6. 输入: "今天天气真好，适合出去走走"
   断言: type=text

7. 输入: "18245643422 这是字节供应商的联系电话"
   断言: 有 Saved 输出（不指定具体 type，验证中英混合正常处理）
```

### 二、list 列表（3 个）

```
8. list（无参数）
   断言: 输出包含 "note(s)" 和至少一条笔记

9. list --category "API Keys & Credentials"
   断言: 只显示该分类的笔记

10. list --type apikey
    断言: 只显示 apikey 类型（🔑 图标）
```

### 三、show 详情（2 个）

```
11. show <短ID（8位）>
    断言: 能通过前 8 位 ID 找到笔记，显示完整内容

12. show deadbeef
    断言: 显示 "Note not found"
```

### 四、search 搜索（3 个）

```
13. search "deepseek"
    断言: 搜索结果包含 "deepseek"（内容匹配）

14. search "供应商"
    断言: 搜索结果包含 "供应商"（中文内容匹配）

15. search "nonexistentxyz123"
    断言: 输出 "0 result"（无匹配）
```

### 五、edge cases 边界（5 个）

```
16. "test-user_admin_123-example"  → 横线和下划线正常处理
17. "hello, world. this is a test." → 逗号和句号正常处理
18. "Redis配置：maxmemory 2gb"      → 中英混合正常处理
19. "参考文档 https://example.com/docs 中文说明" → URL+中文正常处理
20. respect limit                   → list --limit 2 最多返回 2 条
```

---

## 当前 24 个集成测试用例（包含新增）

### 六、内容搜索（2 个）— NEW

```
21. capture "sk-helloworld123456 这是hello测试密钥" → search "hello"
    断言: 搜索结果包含 "sk-helloworld"（搜索标题能找到实际密钥内容）

22. search "helloworld"
    断言: 搜索结果包含 "sk-helloworld"（搜索内容关键词也能找到）
```

### 七、追加逻辑（2 个）— NEW

```
23. capture "sk-secondkey987654 又一个密钥" → search "sk-secondkey"
    断言: 两个不同密钥都能被独立搜索到

24. list --type apikey
    断言: 所有 API key 类型笔记都被列出（至少 3 条）
```

---

## 覆盖范围 vs 未覆盖

| 维度 | 已覆盖 | 未覆盖（后续补） |
|------|--------|-----------------|
| 类型检测 | apikey, command, bookmark, credential, text 全 5 种 | — |
| 敏感标记 | apikey=true, credential=true, 其他=false | — |
| 语言 | 中文、英文、中英混合 | 纯数字、emoji |
| 降级策略 | heuristicParse（无 AI 环境） | AI Provider 配置下的真实调用 |
| 错误处理 | 不存在的 ID | 空输入、超长输入(>8000)、损坏的 DB |
| list 过滤 | category, type, limit | sortBy, sortOrder |
| search | 英文关键词、中文关键词、无结果 | 多词搜索、特殊字符搜索 |
| show | 短 ID、不存在 ID | 损坏的 .md 文件 |
