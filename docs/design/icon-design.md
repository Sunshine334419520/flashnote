# FlashNote 图标设计

## 设计要求

- **概念**：闪电（闪）+ 笔记（记）→ 快速记录、AI 驱动
- **主色**：琥珀/暖橙 `#F59E0B` (HSL 38 92% 50%)
- **使用场景**：托盘图标 (16×16)、应用图标 (512×512)、搜索栏图标 (16×16)
- **风格**：现代、简洁、识别度高，小尺寸下也能辨认

---

## 方案 A：闪电笔记

一个圆角方块（代表卡片/笔记），中心一道闪电标记。

```
┌─────────┐
│    ⚡    │
└─────────┘
```

**AI 提示词 (中文)：**
```
一个现代简约的 app 图标，主体是一个圆角方形卡片（圆角半径适中），
暖橙色 (#F59E0B) 到深橙色渐变背景。卡片中央是一道白色闪电符号，
线条流畅锐利。扁平设计，微妙的投影，适合 macOS 风格。
白色背景透明，1024x1024px。
```

**AI 提示词 (English)：**
```
A modern minimalist app icon: a rounded square card shape with 
warm orange (#F59E0B) to deep orange gradient background. 
A single white lightning bolt symbol in the center, clean and sharp. 
Flat design, subtle shadow, macOS-style aesthetic. 
Transparent background, 1024x1024px, app icon style.
```

---

## 方案 B：闪电 + 笔尖

一支钢笔，笔尖处迸发闪电，象征 AI 驱动的书写。

**AI 提示词 (中文)：**
```
极简主义 app 图标：一支白色钢笔/羽毛笔向右倾斜，笔尖处有一道
暖橙色的闪电火花。深色圆形背景，科技感。线条干净，无多余细节。
背景透明，1024x1024px。
```

**AI 提示词 (English)：**
```
Minimalist app icon: a white quill/pen tilted to the right, 
with a warm orange lightning spark at the nib. 
Dark circular background, tech-forward feel. 
Clean lines, no unnecessary detail. 
Transparent background, 1024x1024px.
```

---

## 方案 C：字形 "F" + 闪电

字母 "F"（FlashNote）中融入闪电元素。

**AI 提示词 (中文)：**
```
现代极简字母图标：一个大写的 "F" 字母，顶部横线被一道橙色闪电
符号替代。字体采用圆角无衬线体，线条粗壮。背景为纯白色/透明。
整体简洁有力，一眼能认出是笔记应用。适合 16x16 到 512x512 各种尺寸。
1024x1024px，背景透明。
```

**AI 提示词 (English)：**
```
Modern minimalist letterform icon: a bold uppercase "F", 
with the top horizontal stroke replaced by an orange lightning bolt. 
Rounded sans-serif, thick stroke weight. Pure white/transparent background. 
Simple, strong, recognizable at any size from 16x16 to 512x512. 
1024x1024px, transparent background.
```

---

## 方案 D：闪电卡片堆叠

两张卡片微微错位堆叠，最上面一张中央是闪电。

**AI 提示词 (中文)：**
```
简约 app 图标：两张白色圆角卡片微微错位堆叠，最上层卡片中央
是暖橙色的闪电符号。浅灰色背景，轻投影，清爽现代风格。
1024x1024px，背景可留浅灰。
```

**AI 提示词 (English)：**
```
Minimal app icon: two white rounded cards slightly offset and stacked, 
a warm orange lightning bolt centered on the top card. 
Light gray background, soft shadow, clean modern style. 
1024x1024px, light gray background acceptable.
```

---

## 推荐

**方案 A（闪电笔记）** — 最简洁、最小尺寸下识别度最高。托盘 16×16 时闪电形状仍然可辨，搜索栏内替换 🔍 图标也不突兀。

---

## 生成参数

- **尺寸**：1024 × 1024 px
- **格式**：PNG（透明背景）
- **风格参考**：macOS Big Sur 图标风格，圆角方形，轻微深度感
- **缩放到 16px 时**：闪电/核心元素应仍可辨认
