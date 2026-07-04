# CommandInput 架构设计

## 目标

一个 `CommandInput` 组件，主窗口和 Alt+Space 共用。不重复造轮子。

## 架构图

```
┌─ MainView ──────────────────────────┐  ┌─ QuickCapture ───────────────────┐
│                                     │  │                                 │
│  <CommandInput                      │  │  <CommandInput                  │
│    mode="local"                     │  │    mode="ai"                    │
│    notes={notes}                    │  │    notes={notes}                │
│    onCommit={handleMainCommand} />  │  │    onCommit={handleQuickCmd} /> │
│                                     │  │                                 │
│  <CardWall />  ← 过滤后的卡片墙      │  │  <CompactResults />  ← 紧凑列表  │
│                                     │  │                                 │
└─────────────────────────────────────┘  └─────────────────────────────────┘

           共享同一个 CommandInput 组件
```

## CommandInput 职责

只做**输入和意图表达**，不执行业务逻辑。

```tsx
interface CommandInputProps {
  mode: 'local' | 'ai'      // 默认模式
  notes: Note[]              // 用于 @ 建议
  onCommit: (cmd: AICommand) => void
}

interface AICommand {
  type: 'search' | 'add' | 'delete' | 'edit'
  raw: string                // 用户输入的原始文本
  explicit: boolean          // true = /命令, false = AI 推断
}
```

**内部状态：**
- 输入文本
- 当前模式（local / ai）
- `/` 下拉：显示/隐藏、高亮索引、过滤
- `@` 下拉：显示/隐藏、高亮索引、过滤

**行为矩阵：**

| 触发 | mode=local (主窗口) | mode=ai (Alt+Space) |
|------|-------------------|--------------------|
| 普通输入 | `onChange` 实时过滤 | 等待 Enter，识别意图 |
| `/` | 切换到 AI 模式，弹出命令下拉 | 弹出命令下拉 |
| `@` | 弹出分类下拉 | 弹出分类下拉 |
| Enter (AI 模式) | 组装 `explicit:true` → `onCommit` | 组装 `explicit:true` → `onCommit` |
| Enter (无 /, AI 模式) | 组装 `explicit:false` → `onCommit` | 组装 `explicit:false` → `onCommit` |

## 两个窗口的区别

```
MainView                         QuickCapture
onCommit →                       onCommit →
  search: 过滤卡片墙                search: 展示紧凑结果列表
  add: 走 capture 创建              add: 静默创建 + 关闭窗口
  delete: 卡片确认 + 删除            delete: 窗口内确认 + 删除
  edit: 卡片进入编辑模式             edit: 窗口内编辑
```

业务逻辑不同，但 CommandInput 不关心——它只管把 `AICommand` 抛出去。

## 文件结构

```
src/renderer/components/command/
  CommandInput.tsx    ← 新文件，合并 SearchBar 功能 + / 支持
  CommandDropdown.tsx ← / 命令下拉（可选，内联也可以）

src/renderer/components/search/
  SearchBar.tsx       ← 删除或改成 re-export CommandInput

src/renderer/routes/
  MainView.tsx        ← 使用 <CommandInput mode="local" />
  QuickCapture.tsx    ← 使用 <CommandInput mode="ai" />
```

## 实现顺序

1. 创建 `CommandInput` — 把 SearchBar 的逻辑搬过去，加上 `/` 命令下拉
2. MainView 改用 `CommandInput mode="local"`
3. QuickCapture 改用 `CommandInput mode="ai"`（先只做输入，结果列表后续实施）
4. 删除旧的 SearchBar
