# UI 規格文件 — Direction C Phase 2

版本：v1.0（2026-04-23）
來源：`screens_c2.jsx`、`prototype_child2.jsx`、`prototype_parent2.jsx`、`prototype_child.jsx`、`prototype_parent.jsx`、`colors_and_type.css`

---

## 1. 設計 Token（Design Tokens）

### 1.1 顏色調色盤

Direction C 使用**深色宇宙主題**（深藍背景 + 金色重點），與 `colors_and_type.css` 定義的暖色淺色系不同。實作請以下方 C2 物件為準。

```typescript
// src/design/tokens.ts — 全站唯一調色盤，所有畫面（包含 sheet / 彈出畫面）統一使用
export const P = {
  bg:           '#1E2547',   // 主背景（深藍）
  surface:      '#2D3460',   // 卡片背景
  surfaceHi:    '#3A4278',   // 更亮的卡片 / 進度條底色
  surfaceCream: '#F7F2EA',   // 特殊用途：反白卡片（家長審核確認）
  primary:      '#FFD966',   // 主按鈕、active tab、星星（金黃）
  primaryDark:  '#D4AF37',   // pressed 狀態
  primaryGlow:  'rgba(255,217,102,0.35)',
  text:         '#F7F2EA',   // 主文字
  muted:        '#B8B6C8',   // 次要文字
  border:       'rgba(247,242,234,0.18)',
  accent:       '#F5A623',   // pending / warning
  accentHot:    '#FF6B47',   // reject / error
  green:        '#5EE0A8',   // approve / done
  star:         '#FFE066',   // 星星特效
} as const;
```

> **確認**：全站統一深藍（`#1E2547`），不分主畫面或彈出畫面。`prototype_shared.jsx` 的更深版本（`#0B0E1A`）是舊版汙染，已廢棄。

### 1.2 語意顏色對應

| 用途 | 顏色 | 值 |
|------|------|----|
| 任務完成 / 通過 | `C2.green` | `#5EE0A8` |
| 任務待審 / 等待中 | `C2.accent` | `#F5A623` |
| 任務被退回 / 錯誤 | `C2.accentHot` | `#FF6B47` |
| 星光 / 點數 | `C2.primary` | `#FFD966` |
| 每日任務分類點 | `C2.primary` | `#FFD966` |
| 每週任務分類點 | `C2.accent` | `#F5A623` |
| 其他任務分類點 | `C2.green` | `#5EE0A8` |

### 1.3 字型

```typescript
// React Native 中需要 expo-google-fonts 安裝以下字型
// @expo-google-fonts/nunito
// @expo-google-fonts/dm-sans

export const Fonts = {
  display: 'Nunito',    // 標題、按鈕、任務名稱（粗體）
  body:    'Nunito',    // 一般文字
  data:    'DM Sans',   // 數字、星星數量（tabular-nums）
};
```

### 1.4 文字樣式尺寸

| 語意 | fontFamily | fontSize | fontWeight | lineHeight |
|------|-----------|----------|------------|------------|
| 頁面大標題（h1） | Nunito | 28 | 800 | 1.1 |
| 頁面標題（h2） | Nunito | 26 | 800 | 1.2 |
| 區塊標題（h3） | Nunito | 22 | 800 | 1.25 |
| 任務名稱 | Nunito | 15 | 800 | — |
| 獎勵名稱 | Nunito | 14 | 800 | 1.3 |
| 數字大（星光總數） | DM Sans | 22 | 700 | — |
| 數字中（評分等） | DM Sans | 18 | 700 | — |
| 數字小 | DM Sans | 14–15 | 700 | — |
| 標籤（上方小字） | 系統 | 11 | 800 | — |（letterSpacing: 1.5）|
| 一般說明文字 | Nunito | 12–13 | 500–600 | 1.5 |
| 徽章 / caption | 系統 | 10–11 | 700–800 | 1.4 |
| 按鈕文字 | Nunito | 13–15 | 800 | — |

### 1.5 間距與圓角

```typescript
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  22,   // 主要頁面 padding 左右
  xl:  24,
  xxl: 32,
};

export const Radius = {
  sm:   9,
  md:   12,
  lg:   14,
  xl:   16,
  xxl:  18,
  card: 14,    // 一般卡片
  sheet: 20,   // Sheet 卡片
  pill: 9999,  // 膠囊形按鈕
};
```

### 1.6 陰影

| 用途 | 規格 |
|------|------|
| FAB 按鈕（+） | `shadowColor: '#000', shadowOffset: {width:0, height:12}, shadowOpacity: 0.35, shadowRadius: 12, elevation: 12` |
| CTA 按鈕（primary） | `shadowColor: '#FFD966', shadowOffset: {width:0, height:8}, shadowOpacity: 0.28, shadowRadius: 12` |

---

## 2. 共用元件規格

### 2.1 背景：Starfield 效果

所有畫面背景都有散落星點效果。

- 實作方式：絕對定位的小圓點，`pointerEvents: 'none'`，`position: 'absolute', inset: 0`
- 星點數量：各畫面不同（10–40 個），主畫面較多、sheet 較少
- 星點大小：1.5px（一般）或 3px（較大的）
- 星點顏色：一般為 `#F5F2E8`，特效星點為 `#FFE066`（帶 `boxShadow: '0 0 6px #FFE066'`）
- 星點透明度：0.3–0.9（隨機分布）
- Tasks Home 背景有額外的 radial-gradient：`radial-gradient(ellipse at top, #1A1E3D 0%, #1E2547 55%)`

### 2.2 Tab Bar

#### 孩子端（4 個 tab）

| index | ID | 圖示 | 標籤 |
|-------|-----|------|------|
| 0 | `tasks` | `✦` | 任務 |
| 1 | `rewards` | `♡` | 獎勵 |
| 2 | `notif` | `◉` | 通知（有未讀數字徽章） |
| 3 | `me` | `☽` | 我的 |

#### 家長端（5 個 tab）

| index | ID | 圖示 | 標籤 |
|-------|-----|------|------|
| 0 | `tasks` | `✦` | 任務 |
| 1 | `review` | `◐` | 審核（有待審數字徽章） |
| 2 | `rewards` | `♡` | 禮物 |
| 3 | `notif` | `◉` | 通知（有未讀數字徽章） |
| 4 | `settings` | `☰` | 設定 |

**Tab Bar 樣式：**
- 底部 padding：上 8、左右 12、下 18（考慮 iOS safe area）
- 背景：`linear-gradient(to top, bg-color 60%, transparent)`
- 頂部邊框：`1px solid border-color`
- Active 圖示：`C2.primary` / `P.primary`（金黃）
- Active 標籤：`C2.text`（白）
- Inactive 圖示 + 標籤：`C2.muted`
- 圖示大小：fontSize 18
- 標籤大小：fontSize 10，fontWeight 800，letterSpacing 0.5
- 徽章：絕對定位圓形，background `P.accentHot`，fontSize 10，minWidth 16，height 16

### 2.3 卡片樣式

**一般任務/獎勵卡片：**
- background: `C2.surface`（`#2D3460`）或 `P.surface`（`#131727`）
- border: `1px solid C2.border`
- borderRadius: 14
- padding: 14

**特殊反白卡片（家長端禮物確認）：**
- background: `C2.surfaceCream`（`#F7F2EA`）
- color: `#1C1A14`
- borderRadius: 22
- padding: 22

**Sheet 中的輸入區塊卡片：**
- borderRadius: 20
- padding: 18

### 2.4 按鈕樣式

**Primary CTA（主要行動按鈕）：**
- background: `C2.primary`（`#FFD966`）
- color: `C2.bg`（深藍色文字）
- borderRadius: 9999（膠囊）
- padding: `14px`（上下）
- fontFamily: Nunito, fontWeight: 800, fontSize: 14–15
- 有金黃色陰影（見 1.6）

**Secondary（次要按鈕）：**
- background: transparent
- border: `1px solid C2.border`
- color: `C2.muted`
- borderRadius: 9999
- padding: `13px`

**Ghost / Destructive（拒絕/退回）：**
- background: transparent
- border: `1px solid C2.accentHot`
- color: `C2.accentHot`
- borderRadius: 9999

**Sub-tab 選擇器（Segmented Control）：**
- 外層容器：background `C2.surface`，padding 4，borderRadius 12，border `1px solid C2.border`
- 選中 tab：background `C2.primary`，color `C2.bg`，borderRadius 9，padding `9px 8px`
- 未選 tab：background transparent，color `C2.muted`

**FAB（浮動新增按鈕）：**
- 位置：`position: 'absolute', right: 18, bottom: 92`（tab bar 上方）
- 大小：width 56，height 56，borderRadius 9999
- background: `C2.primary`，color: `C2.bg`
- 符號：`+`，fontSize 26，fontWeight 800
- 有深色大陰影

### 2.5 Sheet（底部彈出層）頂部指示條

所有 sheet 畫面頂部有：
- 寬 44，高 5 的膠囊形條狀，background `rgba(247,242,234,0.25)`
- 右側有 ✕ 關閉按鈕：width 32，height 32，borderRadius 9999，background `rgba(247,242,234,0.08)`，border `1px solid P.border`

### 2.6 任務狀態圖示背景

| 狀態 | 背景色 | 圖示顏色 |
|------|--------|---------|
| todo | `rgba(255,217,102,0.12)` | `C2.primary` |
| pending（已提交等待） | `rgba(245,166,35,0.15)` | `C2.accent` |
| done（已通過） | `rgba(94,224,168,0.15)` | `C2.green` |
| rejected（被退回） | 左側有 4px `C2.accentHot` 色條 | — |

---

## 3. 孩子端畫面規格

### 3.1 Tasks Home（任務首頁）

**路由：** `src/app/child/(tabs)/tasks.tsx`

**版面結構**

頁面分為兩層：
1. 可滾動內容區（flex: 1，paddingBottom: 90 讓最後一個任務不被 tab bar 遮住）
2. 底部固定 Tab Bar

頂部區塊（padding 20 上 / 22 左右）：
- 第一行：左側日期/時段文字 + 右側星光餘額膠囊
- 第二行：大標題「嗨 [孩子名]，今天的任務」
- 第三行：進度卡片（圓形進度條 + 說明文字）

任務列表區：分為三個 Section（每日 / 每週 / 其他），每個 Section 有：
- 標題行（分類點、分類名稱、X/Y 完成數、提示文字）
- 任務卡片列表

**關鍵元素**

星光餘額膠囊：
- background: `C2.surface`，padding `6px 12px`，borderRadius 9999，border `1px solid C2.border`
- 星號圖示 color: `C2.star`（`#FFE066`）
- 數字：DM Sans，fontWeight 700，fontSize 14，color `C2.star`

大標題：
- fontFamily: Nunito，fontWeight 800，fontSize 28，lineHeight 1.1，letterSpacing -0.01em
- 孩子名字：color `C2.primary`

進度卡片：
- background: `C2.surface`，borderRadius 14，border `1px solid C2.border`，padding `10px 14px`
- 左側：SVG 圓形進度條（直徑 40，strokeWidth 4，進度色 `C2.primary`，底色 `C2.surfaceHi`）
- 中間：完成數字，DM Sans，fontWeight 700，fontSize 12
- 右側文字：fontSize 12，color `C2.muted`

Section 標題行：
- 分類點：width 6，height 6，borderRadius 9999
- 分類名稱：Nunito，fontWeight 800，fontSize 15，letterSpacing 1.2
- 完成數：DM Sans，fontSize 11，color `C2.muted`（格式：`X/Y`）
- 提示文字：fontSize 11，color `C2.muted`

任務卡片：
- layout：水平排列（圖示 + 文字 + 箭頭）
- padding: `12px 14px`，background `C2.surface`，border `1px solid C2.border`，borderRadius 16，marginBottom 8
- 已完成任務：opacity 0.55
- 圖示容器：width 38，height 38，borderRadius 10
- 任務名稱：Nunito，fontWeight 800，fontSize 15，已完成時有 textDecoration line-through
- 副文字：fontSize 11，fontWeight 600，marginTop 2
- 右側箭頭（未完成才顯示）：width 28，height 28，borderRadius 9999，background `C2.primary`，color `C2.bg`，字符「→」，fontSize 14，fontWeight 800

**任務卡片副文字顏色**
- todo：顯示「★ {pts} · {截止時間}」，color `C2.muted`
- pending：顯示「⏳ 星光傳送中」，color `C2.accent`
- done：顯示「✓ 拿到 ★{pts}」，color `C2.green`

**互動狀態**
- 點擊任務卡片（todo / pending 狀態）→ 開啟任務詳情 sheet
- 已完成（done）：不可點擊（opacity 0.55，無箭頭）

**頁面連動**
- 任務卡片（todo / rejected）→ 任務詳情（ChildTaskDetail）
- 任務卡片（pending）→ 等待中（ChildWait）
- Tab Bar → 其他 tab

---

### 3.2 Task Detail（任務詳情）

**路由：** `src/app/child/task/[taskId].tsx`（Sheet 形式，從任務首頁彈出）

**版面結構**

全螢幕 sheet，分為三區：
1. 頂部：指示條 + ✕ 關閉按鈕
2. 可滾動主體：任務標題 + 退回說明（如有）+ 拍照區塊 + 備註輸入
3. 底部 action bar：「晚點做」次要按鈕 + 「完成任務」主要按鈕

**關鍵元素**

任務標題區：
- 圖示容器：width 64，height 64，borderRadius 16，background `rgba(P.primary, 0.18)`，fontSize 34
- 任務名稱：Nunito，fontWeight 800，fontSize 22
- 副文字：fontSize 13，color `P.muted`（「做完 +★ {pts}」）

退回說明卡片（state === 'rejected' 時顯示）：
- background: `rgba(P.accentHot, 0.18)`，border `1px solid rgba(P.accentHot, 0.33)`，borderRadius 14，padding 14
- 標題：fontSize 11，fontWeight 800，letterSpacing 1，color `P.accentHot`
- 內文：fontSize 14，lineHeight 1.5

拍照區塊：
- aspectRatio: 4/3，borderRadius 18，border `1.5px dashed P.border`
- 未拍照：background `P.surface`，中央顯示相機圖示（fontSize 48）+ 說明文字
- 已拍照：顯示模擬照片背景 + 右上角「點一下重拍」標籤（深色半透明膠囊）

備註輸入：
- background `P.surface`，borderRadius 14，padding 14
- 輸入框：background `P.bg`，borderRadius 10，border `1px dashed P.border`，fontSize 13，minHeight 44

底部 action bar：
- 「晚點做」：border `1px solid P.border`，color `P.muted`，borderRadius 9999，padding `13px 16px`
- 「完成任務」：有照片時用 primary 色（active），無照片時用 `P.surfaceHi`（disabled）

**互動狀態**
- 拍照按鈕：點擊切換「未拍 / 已拍」狀態
- 「完成任務」：未拍照時 disabled（`P.surfaceHi` 背景，`P.muted` 文字），拍照後才 active

**頁面連動**
- 點「完成任務」→ 提交後跳轉至等待畫面（ChildWait）
- ✕ / 「晚點做」→ 關閉 sheet，回任務首頁

---

### 3.3 ChildWait（等待家長審核）

**路由：** `src/app/child/task/[taskId]/wait.tsx`（Sheet 形式）

**版面結構**

全螢幕 sheet，三區結構：
1. 頂部：指示條 + ✕
2. 主體：置中的大圖示 + 標題 + 副文字 + 狀態卡片（提交中時顯示）
3. 底部按鈕

**狀態差異**

| state | 大圖示 | 標題 | 副文字 | 底部按鈕 |
|-------|--------|------|--------|---------|
| submitted | ✨（有金光 drop-shadow） | 「星光傳送中…」 | 「等爸媽看一眼就好 · {時間}」 | 「回到任務」 |
| approved | 🎉 | 「{任務名} 通過啦！」 | 「+★{pts}，好棒！」 | 「看獎勵」+「慶祝一下（primary）」 |
| rejected | 📮 | 「爸媽回信了」 | parentNote 內容 | 「先不做」+「再試一次（primary）」 |

submitted 狀態額外顯示任務狀態卡片：
- 水平排列：圖示（width 48）+ 任務名稱 + 提交時間 + 星光數
- 底部有 shimmer 動畫進度條（width 60%，`linear-gradient` + animation）

**頁面連動**
- approved → 「慶祝一下」→ 慶祝動畫（ChildCelebrate）
- approved → 「看獎勵」→ 關閉，回任務首頁
- rejected → 「再試一次」→ 重置任務狀態，關閉回任務首頁

---

### 3.4 ChildCelebrate（慶祝動畫）

**路由：** `src/app/child/task/[taskId]/celebrate.tsx`

**版面結構**

全螢幕覆蓋（不是 sheet，直接取代畫面），背景有放射漸層和光線射線效果。

- 背景：`radial-gradient(circle at 50% 38%, rgba(P.primary,0.26) 0%, P.bg 60%)`
- 14 條放射光線（絕對定位，從中央放射）
- 超大 🎉 emoji（fontSize 88，有金黃色 drop-shadow）
- 「做得好！」標題：Nunito，fontWeight 800，fontSize 32
- 任務名稱：fontSize 15，color `P.muted`
- 星光獲得膠囊：borderRadius 9999，background `rgba(P.primary, 0.22)`，border `1px solid P.border`

**頁面連動**
- 「看獎勵」→ 關閉，導向獎勵 tab
- 「下一個任務」→ 關閉，回任務首頁

---

### 3.5 Rewards Tab（獎勵商店）

**路由：** `src/app/child/(tabs)/rewards.tsx`

**版面結構**

Tab 頁面，分為兩個 sub-tab：
- **可兌換（Shop）**：2 欄 Grid 獎勵卡片
- **我換過的（History）**：單欄歷史清單

頂部區（padding `20px 22px 0`）：
- 標籤：fontSize 11，fontWeight 800，letterSpacing 1.5，color `C2.muted`
- 大標題：「你有 ★ {stars}」，星光數字 color `C2.primary`
- Sub-tab 切換器（Segmented Control）

**Shop sub-tab（可兌換）**

2 欄 Grid，gap 10，padding `18px 22px 0`

獎勵卡片：
- background: `C2.surface`，borderRadius 16，padding 14
- 不可兌換（餘額不足）：opacity 0.5
- 圖示容器：width 52，height 52，borderRadius 12，`linear-gradient(135deg, color, colorDD)`
- 名稱：Nunito，fontWeight 800，fontSize 13，marginTop 10，lineHeight 1.2
- 星光數：DM Sans，fontWeight 700，fontSize 15，可兌換時 color `C2.primary`，不可兌換時 `C2.muted`
- 差距提示（不可兌換時顯示）：fontSize 10，color `C2.muted`，「還差 X」

**History sub-tab（我換過的）**

列表卡片：
- display: flex，gap 12，padding `12px 14px`，background `C2.surface`，borderRadius 14，border `1px solid C2.border`，marginBottom 8
- 圖示：width 40，height 40，borderRadius 10，background `#FFF1DE`
- 名稱：Nunito，fontWeight 800，fontSize 14
- 副文字：fontSize 11，color `C2.muted`（格式：「{時間} · {狀態}」）
  - 已完成狀態 color: `C2.green`
  - 等待中狀態 color: `C2.accent`
- 右側消費星光：DM Sans，fontWeight 700，fontSize 14，color `C2.muted`（「− ★ {cost}」）

底部總計：fontSize 11，color `C2.muted`，textAlign center

**互動狀態**
- 點擊可兌換獎勵卡片 → 兌換確認 sheet（ChildRedeemConfirm）
- 不可兌換：不可點擊（opacity 0.5，cursor default）

**頁面連動**
- 可兌換卡片 → 兌換確認（ChildRedeemConfirm sheet）
- 已有進行中的訂單時，顯示訂單 Banner → 點擊 → 訂單進度（ChildOrder）

---

### 3.6 ChildRedeemConfirm（兌換確認 Sheet）

**路由：** `src/app/child/reward/[rewardId]/confirm.tsx`

**版面結構**

全螢幕 sheet（P 調色盤），三區：
1. 頂部：指示條 + ✕
2. 主體：置中顯示獎勵大圖示、名稱、花費、「前後星光對比卡片」+ 說明文字
3. 底部雙按鈕：「再想想」+ 「問爸媽（primary）」

**關鍵元素**

獎勵大圖示：
- width 100，height 100，borderRadius 22，`linear-gradient(135deg, color, colorAA)`
- 有色光 boxShadow（`0 16px 40px ${color}44`）
- fontSize 52

名稱：Nunito，fontWeight 800，fontSize 26，marginTop 16

花費顯示：DM Sans，fontWeight 700，fontSize 26，color `P.primary`（前面有星光圖示）

前後對比卡片：
- background `P.surface`，borderRadius 14，padding 14
- 左側「現在 ★X」↔ 右側「之後 ★Y」（中間有箭頭）

說明文字：fontSize 12，color `P.muted`（「爸媽要先說好才算完成」）

底部按鈕：
- 「再想想」：flex 1，border `1px solid P.border`，color `P.muted`
- 「問爸媽」：flex 1.5，background `P.primary`，color `P.bg`，金黃陰影

---

### 3.7 ChildOrder（獎勵訂單進度）

**路由：** `src/app/child/order/[orderId].tsx`

**版面結構**

全螢幕 sheet（P 調色盤），三區：
1. 頂部：指示條 + ✕ + 「下滑關閉」提示文字
2. 主體：獎勵圖示 + 名稱 + 狀態文字 + 三步驟進度條（declined 時顯示爸媽留言卡片）
3. 底部按鈕

**三步驟進度**

步驟：「你提出」→「爸媽答應」→「你拿到了」

每個步驟：
- 圖示圓點：width 28，height 28，borderRadius 9999
  - 已完成：background `P.primary`，color `P.bg`，顯示 ✓
  - 當前步驟：有 glow ring（`0 0 0 6px P.primaryGlow`）
  - 未到達：background `P.surface`，border `2px solid P.border`，顯示數字
- 連接線（步驟間）：width 2，background 已完成時 `P.primary`，未到達時 `P.border`
- 步驟名稱：Nunito，fontWeight 800，fontSize 14，已完成 color `P.text`，未到達 `P.muted`
- 時間戳：fontSize 11，color `P.muted`

**declined 狀態留言卡片**：
- background `rgba(P.accent, 0.18)`，border `1px solid rgba(P.accent, 0.33)`，borderRadius 14
- 標題「爸媽說」：fontSize 11，fontWeight 800，color `P.accent`
- 內文：fontSize 14，lineHeight 1.5

**底部按鈕**
- confirmed 狀態：「✓ 我拿到了！」（primary button）
- requested / delivered / declined 狀態：「好」（primary button）

**頁面連動**
- 點「我拿到了！」→ 標記訂單 delivered，返回
- ✕ / 「好」→ 關閉 sheet

---

### 3.8 Notifications（通知頁）

**路由：** `src/app/child/(tabs)/notif.tsx`

**版面結構**

Tab 頁面，頂部標題區 + 通知列表。

頂部（padding `20px 22px 12px`）：
- 標籤：fontSize 11，fontWeight 800，letterSpacing 1.5，color `C2.muted`
- 大標題：「今天的消息」
- 右側：「全部標示已讀」文字按鈕（fontSize 12，color `C2.muted`）

**通知類型與圖示**

| kind | 圖示 | 圖示顏色 |
|------|------|---------|
| approved（通過） | ✓ | `C2.green` |
| new（新任務） | ✦ | `C2.primary` |
| reward（兌換進度） | ★ | `C2.accent` |
| redeem（兌換確認） | 🎁 | `C2.primary` |
| streak（連續）| 🔥 | `C2.accentHot` |
| redo（重試）| ↻ | `C2.accent` |

**通知卡片**

未讀通知：
- background `C2.surface`，border `1px solid C2.border`，borderRadius 14，padding `14px`，marginBottom 6
- 右上角藍點：width 8，height 8，borderRadius 9999，background `C2.primary`

已讀通知：
- background transparent，border `1px solid transparent`

圖示圓圈：width 36，height 36，borderRadius 9999，背景色為對應種類色加 22（22% opacity）

通知文字：Nunito，fontWeight 700，fontSize 14，lineHeight 1.3
時間戳：fontSize 11，color `C2.muted`，marginTop 3
星光數字（approved 類型）：color `C2.primary`，marginLeft 8，fontWeight 700

---

### 3.9 Me（我的頁面）

**路由：** `src/app/child/(tabs)/me.tsx`

**版面結構**

Tab 頁面，從上到下：
1. 置中頭像區（大頭像、名稱、年齡說明）
2. 統計數字 row（3 個並排卡片）
3. 本週進度條形圖
4. 徽章 Grid（3 欄）
5. 設定列表

**頭像區**（padding `24px 22px 0`，textAlign center）：
- 頭像圓：width 96，height 96，borderRadius 9999，`linear-gradient(135deg, kidColor, #F5A623)`
  - border: `3px solid C2.primary`
  - 中央顯示名字首字：Nunito，fontWeight 800，fontSize 40，color white
- 名稱：Nunito，fontWeight 800，fontSize 24，marginTop 12
- 副文字：fontSize 12，color `C2.muted`（「{age} 歲 · 加入 3 個月」）

**統計 row（3 格）**

每格：flex 1，padding 14，borderRadius 14，background `C2.surface`，border `1px solid C2.border`，textAlign center

| 格子 | 大數字字型 | 大數字色 | 標籤 |
|------|-----------|---------|------|
| 總星光 | DM Sans，22，700 | `C2.primary` | 總星光 |
| 連續天數 | DM Sans，22，700 | `C2.accent` | 連續天數（🔥 前綴）|
| 徽章數量 | DM Sans，22，700 | `C2.green` | 徽章 |

標籤：fontSize 10，color `C2.muted`，marginTop 2，letterSpacing 1

**本週進度**（padding `20px 22px 0`）：
- 外卡片：borderRadius 16，background `C2.surface`，padding 16，border `1px solid C2.border`
- 標籤：fontSize 11，fontWeight 800，letterSpacing 1.5，color `C2.muted`
- 7 條柱：高度 = value × 8（最高 40px），width 100%，borderRadius 4
  - 過去天數：background `C2.primary`
  - 未來天數：background `C2.surfaceHi`
- 下方星期標籤：fontSize 10，color `C2.muted`

**徽章 Grid（3 × 2）**

每個徽章格子：padding 12，borderRadius 14，textAlign center

- 已獲得（got: true）：background `C2.surface`，border `1px solid C2.border`，opacity 1
- 未獲得（got: false）：background transparent，border `1px dashed C2.border`，opacity 0.5

圖示：fontSize 28，lineHeight 1
名稱：Nunito，fontWeight 700，fontSize 11，marginTop 6

**設定列表**（marginTop 16）：
- 外卡片：padding `2px 14px`，background `C2.surface`，borderRadius 14，border `1px solid C2.border`
- 每行：display flex，justifyContent space-between，padding `14px 0`，fontSize 13
  - 標籤：fontWeight 700
  - 值：color `C2.muted`
- 行間有分隔線（最後一行無）

列表項目：
1. 語言 → 值顯示「中文 / English」
2. 家長協助 → 值顯示「→」
3. 登出 → 值顯示「→」

---

## 4. 家長端畫面規格

### 4.1 Tasks Manage（任務管理）

**路由：** `src/app/parent/(tabs)/tasks.tsx`

**版面結構**

Tab 頁面，頂部標題 + sub-tab 切換器，切換「管理」和「歷程」兩個子畫面。

頂部（padding `20px 22px 4px`）：
- 標籤：fontSize 11，fontWeight 800，letterSpacing 1.5，color `C2.muted`
- 大標題：管理時顯示「X 個任務在跑」，歷程時顯示「過去 7 天」
- Sub-tab 切換器（Segmented Control，設計見 2.4）

**管理（Manage）子畫面**

篩選膠囊列（scrollable horizontal）：
- 「全部 · X」：active 時 background `C2.primary`，color `C2.bg`
- 其他篩選（小美 / 小凱 / 暫停）：border `1px solid C2.border`，color `C2.muted`
- padding `6px 12px`，borderRadius 9999，fontSize 11，fontWeight 700–800

任務卡片（padding 14，background `C2.surface`，borderRadius 14，marginBottom 8）：
- 已暫停任務：opacity 0.6
- 圖示：width 40，height 40，borderRadius 10，background `rgba(C2.primary, 0.18)`，border `1px solid C2.border`
- 任務名稱：Nunito，fontWeight 800，fontSize 15（overflow ellipsis）
- 星光數：DM Sans，fontWeight 700，fontSize 13，color `C2.primary`
- 副文字：fontSize 11，color `C2.muted`（「{孩子名} · {頻率}」，暫停時追加 color `C2.accent` 的「已暫停」）
- 進度條：height 4，borderRadius 9999，background `C2.surfaceHi`
  - 進度填充：background 正常時 `C2.green`，暫停時 `C2.muted`
- 完成率文字：fontSize 11，color `C2.muted`，DM Sans，fontWeight 700
- 右側「⋯」：fontSize 16，color `C2.muted`

FAB「+」按鈕（見 2.4）

**歷程（History）子畫面**

頂部 3 格統計卡片（並排）：
- 「完成」：fontSize 22，DM Sans 700，color `C2.green`
- 「星光」：fontSize 22，DM Sans 700，color `C2.primary`
- 「需重做」：fontSize 22，DM Sans 700，color `C2.accentHot`

歷史記錄（按日期分組）：
- 日期標題：padding `4px 22px`，fontSize 11，fontWeight 800，letterSpacing 1.5，color `C2.muted`
- 每條記錄：margin `0 22px 6px`，padding `12px 14px`，background `C2.surface`，borderRadius 14
  - 狀態圓圈（width 34，height 34）：
    - 通過（ok: true）：background `rgba(C2.green, 0.15)`，color `C2.green`，顯示「✓」
    - 退回（ok: false）：background `rgba(C2.accentHot, 0.15)`，color `C2.accentHot`，顯示「✗」
    - 待審（ok: null）：background `rgba(C2.accent, 0.15)`，color `C2.accent`，顯示「?」
  - 任務名稱：Nunito，fontWeight 800，fontSize 14
  - 副文字：fontSize 11，color `C2.muted`（「{孩子名} · {時間}」）
  - 星光數：DM Sans，fontWeight 700，fontSize 15，通過時 color `C2.primary`，否則 `C2.muted`

---

### 4.2 Review List（審核清單）

**路由：** `src/app/parent/(tabs)/review.tsx`

**版面結構**

Tab 頁面，分為兩個區段：
1. 禮物申請（orders，待確認的兌換）
2. 任務（submitted 狀態的任務）

頂部：
- 標籤：「審核」
- 大標題：全部審完時顯示「都審完了 🎉」，有待審時顯示「X 個等你看」

**禮物申請卡片**（反白背景）：
- background: `C2.surfaceCream`（`#F7F2EA`），color `#1C1A14`，borderRadius 14，padding 14
- 圖示：width 48，height 48，borderRadius 12，`linear-gradient(135deg, color, colorAA)`
- 「{孩子名} 想換」：fontSize 11，fontWeight 800，color `#8A8275`
- 禮物名稱：Nunito，fontWeight 800，fontSize 15，marginTop 2
- 星光費用：DM Sans，fontWeight 700，fontSize 13（「−★ {cost}」）
- 右側「›」：fontSize 18，color `#8A8275`

**任務卡片**（深色背景）：
- background `C2.surface`，border `1px solid C2.border`，borderRadius 14，padding 14
- 照片縮圖：width 64，height 64，borderRadius 12，`linear-gradient(135deg, #C0AC80, #8A7A54)`（模擬）
  - 右下角有任務 emoji（fontSize 22，opacity 0.6）
- 任務名稱：Nunito，fontWeight 800，fontSize 15
- 星光數：DM Sans，fontWeight 700，fontSize 13，color `C2.primary`
- 副文字：孩子名（有顏色點）+ 提交時間（fontSize 11，color `C2.muted`）
- 孩子備註（如有）：fontSize 12，color `C2.muted`，fontStyle italic，加引號

**空狀態**：
- emoji：🌙
- 標題：「休息一下」
- 說明：「小孩做完任務之後，會跑到這裡等你看。」

**頁面連動**
- 禮物申請卡片 → 家長兌換確認（ParentRedeemConfirm sheet）
- 任務卡片 → 審核 sheet（ParentReviewSheet）

---

### 4.3 Parent Review Sheet（家長審核 sheet）

**路由：** sheet，從審核清單彈出

**版面結構**

全螢幕 sheet（P 調色盤），三區：
1. 頂部指示條 + ✕
2. 主體：任務標題 + 照片 + 孩子備註 + 家長回覆輸入
3. 底部雙按鈕：「↺ 再試一次（destructive）」+ 「通過 +★{pts}（primary）」

**關鍵元素**

標題區：
- 孩子頭像：width 32，height 32，borderRadius 9999，background 孩子顏色
- 「{孩子名} 提交」：fontSize 12，color `P.muted`
- 任務名稱：Nunito，fontWeight 800，fontSize 22

照片區：
- aspectRatio 4/3，borderRadius 16，`linear-gradient(135deg, #C0AC80, #8A7A54)`（模擬）
- 左下角有時間戳膠囊（深色半透明背景）
- 右上角有任務 emoji（fontSize 46，opacity 0.6）

孩子備註卡片：
- background `P.surface`，borderRadius 12，padding `10px 14px`，border `1px solid P.border`
- 「{孩子名} 說：」前綴：fontSize 11，fontWeight 700，color `P.muted`
- 備註內容加引號：fontSize 13，lineHeight 1.5

家長回覆輸入（選填）：
- 外卡片：background `P.surface`，borderRadius 14，padding 14
- 輸入框：background `P.bg`，borderRadius 10，border `1px dashed P.border`
- 快速回覆膠囊（預設選項）：background `rgba(P.primary, 0.18)`，color `P.primary`，borderRadius 9999，fontSize 11

底部按鈕：
- 「↺ 再試一次」：border `1px solid P.accentHot`，color `P.accentHot`，flex 1
- 「通過」：background `P.primary`，color `P.bg`，flex 1.5，金黃陰影

---

### 4.4 Parent Redeem Confirm（家長兌換確認 sheet）

**路由：** sheet，從審核清單彈出

**版面結構**

全螢幕 sheet（P 調色盤，radial-gradient 背景），三區：
1. 頂部指示條 + ✕
2. 主體：孩子名稱標題 + 反白卡片（獎勵詳情 + 星光對比）+ 留言輸入
3. 底部雙按鈕：「晚點再說」+ 「好，答應她（primary）」

**關鍵元素**

標題：「{孩子名} 想要換…」，Nunito，fontWeight 800，fontSize 26

反白卡片（surfaceCream）：
- background `C2.surfaceCream`，color `#1C1A14`，borderRadius 22，padding 22
- 獎勵圖示：width 96，height 96，borderRadius 22，fontSize 52
- 獎勵名稱：Nunito，fontWeight 800，fontSize 24
- 費用：DM Sans，fontWeight 700，fontSize 28（「− ★ X」）
- 星光前後對比：淺色背景小卡片（`rgba(28,26,20,0.06)`），兩欄對比顯示

留言輸入區（必填提示為「晚點再說 · 必填」）：
- 快速回覆選項：`rgba(P.accent, 0.18)` 背景，color `P.accent`

底部按鈕：
- 「晚點再說」：flex 1，border `1px solid P.border`，color `P.text`
- 「好，答應她」：flex 2，background `P.primary`，color `P.bg`

---

### 4.5 Parent Rewards Tab（獎勵管理）

**路由：** `src/app/parent/(tabs)/rewards.tsx`

**版面結構**

Tab 頁面，sub-tab 切換：「禮物目錄（Catalog）」和「兌換紀錄（Redeem log）」。

頂部：
- 標籤：「獎勵」
- 大標題：「管理與紀錄」
- Sub-tab 切換器

**禮物目錄（Catalog）**

單欄列表（padding `14px 22px 0`）：
- 每個獎勵卡片：display flex，padding 14，marginBottom 8，background `C2.surface`，borderRadius 14
- 圖示：width 48，height 48，borderRadius 10，`linear-gradient(135deg, color, colorDD)`，fontSize 24
- 名稱：Nunito，fontWeight 800，fontSize 14
- 限制說明：fontSize 11，color `C2.muted`（「每週最多 1 次」）
- 右側：星光數（DM Sans，14，primary）+ 「編輯 →」（fontSize 10，color `C2.muted`）

「+ 新增禮物」按鈕：
- 虛線邊框卡片：border `1px dashed C2.border`，borderRadius 14，padding 14，textAlign center
- color `C2.muted`，fontSize 12，fontWeight 700

FAB「+」按鈕（同任務管理，見 2.4）

**兌換紀錄（Redeem log）**

列表卡片：display flex，padding 14，marginBottom 8，background `C2.surface`，borderRadius 14
- 圖示：width 44，height 44，borderRadius 10，background `#FFF1DE`
- 名稱：Nunito，fontWeight 800，fontSize 13
- 副文字：「{孩子名} · {時間} · {狀態}」，fontSize 11，color `C2.muted`
  - pending 狀態 color: `C2.accent`
  - done 狀態 color: `C2.green`
  - declined 狀態 color: `C2.accentHot`
- 消費星光：DM Sans，fontSize 13，color `C2.muted`（「− ★ X」）

本月統計：marginTop 14，textAlign center，fontSize 11，color `C2.muted`

**頁面連動**
- 「編輯 →」/ 「+ 新增禮物」/ FAB → 新增/編輯獎勵 sheet（C_ParentRewardEdit）

---

### 4.6 Parent Reward Edit（新增/編輯獎勵 Sheet）

**路由：** sheet，從獎勵管理彈出

**版面結構**

全螢幕 sheet（C2 調色盤），四區：
1. 頂部指示條
2. 頂部 action bar：「取消」+ 標題 + 「儲存（primary 膠囊）」
3. 可滾動表單區
4. （無底部按鈕，使用頂部 action bar）

**表單區塊（從上到下）**

大圖示 + 名稱卡片（borderRadius 20，padding 18）：
- 圖示預覽：width 72，height 72，borderRadius 18，`linear-gradient(135deg,#FFCFA3,#F5A623)`，fontSize 36
- 名稱輸入：Nunito，fontWeight 800，fontSize 20，下方有 `2px solid C2.primary` 底線

Emoji 選擇器卡片（borderRadius 16，padding `14px`）：
- 標籤：fontSize 10，fontWeight 800，color `C2.muted`，letterSpacing 1
- Emoji 格子：width 40，height 40，borderRadius 10
  - 選中：background `rgba(C2.primary, 0.33)`，border `2px solid C2.primary`
  - 未選：background `C2.bg`，border `1px solid C2.border`
- 拍照格子（虛線）：border `1.5px dashed C2.border`，相機圖示
- 新增格子（虛線）：border `1.5px dashed C2.border`，「+」圖示（color `C2.primary`）
- 說明文字：fontSize 11，color `C2.muted`，lineHeight 1.5

星光定價 stepper 卡片（borderRadius 16，padding `14px 16px`）：
- 標籤：fontSize 10，fontWeight 800，color `C2.muted`
- Stepper：「−」按鈕（圓形，background `C2.bg`，color `C2.muted`）+ 數字 + 「+」按鈕（background `C2.primary`）
- 每個孩子餘額預覽（每人一行）：
  - 頭像圓（width 22，height 22，borderRadius 9999，孩子顏色）
  - 孩子名：Nunito，fontWeight 700，fontSize 12
  - 「★{現有} → ★{之後}」：可兌換時 color `C2.primary`，不足時 color `C2.accentHot`
  - 不足時顯示「LOW」標籤（fontSize 9，color `C2.accentHot`）

誰可以換（borderRadius 16，padding `14px 16px`）：
- 標籤：fontSize 10，fontWeight 800，color `C2.muted`
- 每個孩子選擇格：flex，padding `10px 12px`，borderRadius 12
  - 選中：background `rgba(C2.primary, 0.22)`，border `2px solid C2.primary`，右側有 ✓
  - 未選：background `C2.bg`，border `1px solid C2.border`

限制設定（borderRadius 16，padding `4px 16px`）：
- 「每週最多 X 次」→ 值 + 「›」
- 「兌換需我同意」→ 切換開關（Toggle，ON 時 background `C2.primary`，白色圓鈕）
- 「有效期限」→ 值 + 「›」

給孩子的留言（borderRadius 16，padding `14px 16px`）：
- 虛線邊框文字區：background `C2.bg`，borderRadius 10，border `1px dashed C2.border`，fontSize 13

---

### 4.7 Parent Settings（家庭設定）

**路由：** `src/app/parent/(tabs)/settings.tsx`

**版面結構**

Tab 頁面，兩個區段：
1. 小孩（孩子卡片列表）
2. 一般（設定選項列表）

頂部：
- 標籤：「設定」
- 大標題：「家庭與權限」

**孩子卡片**（padding 14，background `C2.surface`，borderRadius 14，marginBottom 8）：
- 大頭像：width 44，height 44，borderRadius 9999，孩子顏色背景，首字白色（Nunito，800，18）
- 名稱：Nunito，fontWeight 800，fontSize 15
- 副文字：「{age} 歲 · ★ {stars}」，fontSize 11，color `C2.muted`
- 右側「›」：fontSize 18，color `C2.muted`

**一般設定列表**（單欄，每項 padding `14px 16px`，background `C2.surface`，borderRadius 14，marginBottom 6）：

| 選項 | 預設值 |
|------|--------|
| 語言 | 中文 |
| 通知 | 開啟 |
| 審核方式 | 手動 |
| 螢幕時間 | 未設定 |
| 登出 | — |

---

### 4.8 Parent Notifications（家長通知）

**路由：** `src/app/parent/(tabs)/notif.tsx`（如有需要）

**版面結構**

Tab 頁面，與孩子端通知頁類似。

頂部：
- 有未讀：顯示「X 個新的」，右側「全部標已讀」按鈕
- 全已讀：顯示「都看過了」

**通知卡片**（同孩子端，見 3.8）

通知類型圖示：
- submission（任務提交）：📸，background `rgba(P.accent, 0.22)`
- redeem（兌換申請）：🎁，background `rgba(P.primary, 0.22)`

**空狀態**：
- emoji：✉️
- 標題：「沒有通知」
- 說明：「小孩做完任務或申請兌換會在這裡。」

---

## 5. 頁面連動地圖

### 5.1 孩子端完整導航

```
App 啟動 → 登入 → 孩子端

[任務 Tab] C_TasksHome
  ├── 點任務卡（todo / rejected 狀態）
  │     └── → ChildTaskDetail（Sheet）
  │           ├── 拍照 → 切換照片預覽狀態（不跳頁）
  │           ├── 點「完成任務」（需有照片）
  │           │     └── → ChildWait（Sheet，替換 TaskDetail）
  │           │           ├── 仍在 submitted → 顯示等待中，點「回到任務」→ 關閉回任務首頁
  │           │           ├── 變成 approved → 點「慶祝一下」→ ChildCelebrate（Sheet）
  │           │           │                                    ├── 「看獎勵」→ 關閉，切換到 rewards tab
  │           │           │                                    └── 「下一個任務」→ 關閉回任務首頁
  │           │           ├── 變成 approved → 點「看獎勵」→ 關閉，切換到 rewards tab
  │           │           └── 變成 rejected → 點「再試一次」→ 重置，關閉
  │           └── 點「晚點做」→ 關閉
  ├── 點任務卡（pending/submitted 狀態）
  │     └── → ChildWait（Sheet，同上）
  └── Tab Bar → [其他 tab]

[獎勵 Tab] C_ChildRewardsTab
  ├── Sub-tab「可兌換」
  │     ├── 點可兌換獎勵卡片 → ChildRedeemConfirm（Sheet）
  │     │     ├── 點「問爸媽」→ 送出申請，進入等待
  │     │     └── 點「再想想」→ 關閉
  │     └── 點進行中訂單 Banner → ChildOrder（Sheet）
  │           ├── state=requested → 顯示等待中（無按鈕可操作）
  │           ├── state=confirmed → 點「我拿到了！」→ 標記 delivered
  │           └── state=declined → 點「好」→ 關閉
  ├── Sub-tab「我換過的」
  │     └── 顯示歷史記錄（不可點擊操作）
  └── Tab Bar → [其他 tab]

[通知 Tab] C_ChildNotif
  ├── 點「全部標示已讀」→ 清除未讀狀態（不跳頁）
  ├── 點通知項目 → 標記已讀（可依 kind 跳轉到相關畫面，待確認）
  └── Tab Bar → [其他 tab]

[我的 Tab] C_ChildMe
  ├── 點「家長協助」→ 跳轉到協助說明（待確認路由）
  ├── 點「語言」→ 切換語言（不跳頁或開 picker，待確認）
  ├── 點「登出」→ 登出，回 auth 頁面
  └── Tab Bar → [其他 tab]
```

### 5.2 家長端完整導航

```
App 啟動 → 登入 → 家長端

[任務 Tab] C_ParentTasksManage
  ├── Sub-tab「管理」
  │     ├── 任務卡片「暫停/繼續」按鈕 → 切換暫停狀態（不跳頁）
  │     ├── 任務卡片「編輯」按鈕 → 待確認（應開啟任務編輯 sheet）
  │     └── FAB「+」→ 新增任務（C_KeyboardDemo / 新增任務 sheet）
  ├── Sub-tab「歷程」
  │     └── 顯示歷史紀錄（不可點擊操作）
  └── Tab Bar → [其他 tab]

[審核 Tab] ParentReviewList
  ├── 禮物申請卡片 → ParentRedeemConfirm（Sheet）
  │     ├── 點「好，答應她」→ 確認兌換，更新訂單狀態
  │     └── 點「晚點再說」→ 拒絕，更新訂單狀態（留言必填）
  ├── 任務卡片 → ParentReviewSheet（Sheet）
  │     ├── 點「通過」→ 任務 approved，孩子獲得星光
  │     └── 點「再試一次」→ 任務 rejected，回傳留言給孩子
  └── Tab Bar → [其他 tab]

[禮物 Tab] C_ParentRewardsTab
  ├── Sub-tab「禮物目錄」
  │     ├── 「編輯 →」→ C_ParentRewardEdit（Sheet）
  │     └── 「+ 新增禮物」→ C_ParentRewardEdit（Sheet，新增模式）
  ├── Sub-tab「兌換紀錄」
  │     └── 顯示紀錄（不可點擊）
  ├── FAB「+」→ C_ParentRewardEdit（Sheet，新增模式）
  └── Tab Bar → [其他 tab]

[通知 Tab] ParentNotifs
  ├── 點「全部標已讀」→ 清除未讀（不跳頁）
  ├── 點通知項目 → 標記已讀（可依 kind 跳轉，待確認）
  └── Tab Bar → [其他 tab]

[設定 Tab] ParentSettings
  ├── 點孩子卡片 → 孩子詳情/編輯（待確認路由）
  ├── 點「語言」→ 切換語言（待確認）
  ├── 點「通知」→ 通知設定（待確認）
  ├── 點「審核方式」→ 審核模式選擇（待確認）
  ├── 點「螢幕時間」→ 螢幕時間設定（待確認）
  └── 點「登出」→ 登出，回 auth 頁面
```

---

## 6. 待釐清項目

### 6.1 設計稿本身的疑問

1. **調色盤版本衝突**：`colors_and_type.css` 定義的是暖色淺色系（米黃背景），但 `screens_c2.jsx` 的 C2 物件和 `prototype_shared.jsx` 的 P 物件都是深色宇宙主題。實作以深色主題為準，但以後如果要支援「淺色主題」，css 的定義是否作為 light mode 備用？請確認。

2. **家長端 Tab 數量不一致**：`prototype_shared.jsx` 的 `PTabBar` 定義家長端有 5 個 tab（任務、審核、禮物、通知、設定），但 `screens_c2.jsx` 的 `TabBar` 目前只有 4 個可見畫面被定義（任務、獎勵、—、設定）。確認家長端應為 5 個 tab。

3. **C2 vs P 調色盤的使用邊界**：Tab 頁面用 C2（`#1E2547` 背景），Sheet 用 P（`#0B0E1A` 背景）。但部分 sheet（如 `ChildRedeemConfirm`）在程式碼中明確使用 `P.bg`，而 `C_ParentRewardEdit` 使用 `C2.bg`。是否統一？請確認。

4. **孩子端有沒有「審核」功能**：設計稿中家長端有獨立的 Review tab，孩子端完全沒有。但孩子看到 `pending` 狀態時只能在 ChildWait 等待，無法主動操作。這符合預期嗎？

### 6.2 Web → React Native 技術轉換問題

5. **Starfield 效果**：設計稿用 `position: absolute` 固定星點位置。React Native 中需改用 `StyleSheet` 的 `position: 'absolute'`，但 `overflow: 'hidden'` 在 iOS 有限制，可能需要用 `Animated.View` 或 `react-native-reanimated` 實現。確認是否需要動態星點動畫（閃爍）？

6. **Shimmer 動畫**（ChildWait 進度條）：設計稿用 CSS `@keyframes pShimmer` 做掃過動畫。RN 需改用 `Animated.loop` 或 `react-native-reanimated`，工作量不小。是否要實現？

7. **TextInput 與 KeyboardAvoidingView**：家長審核 sheet 和獎勵編輯 sheet 有輸入框，需要搭配 `KeyboardAvoidingView`。設計稿有專門的「Keyboard Accessory Demo」（`C_KeyboardDemo`）展示 accessory bar 效果。RN 中這個 accessory bar 需要用 `InputAccessoryView`（iOS only）或其他方案實現。是否要在 MVP 實現 accessory bar？

8. **Progress Bar 漸層**（ChildTasksHome）：使用 `linear-gradient(to right, P.primary, P.accent)` 漸層。RN 原生不支援 View 背景漸層，需用 `expo-linear-gradient`。已確認要用嗎？

9. **radial-gradient 背景**（C_TasksHome 的頂部 ellipse 漸層、ChildCelebrate 的圓形漸層）：RN 沒有原生 radial-gradient，需要模擬或忽略。建議用固定深色背景取代。是否接受這個取捨？

10. **圖示來源**（TasksHome 的 `GeomIcon`）：設計稿引用 `window.GeomIcon`（自訂幾何圖示元件）。這個元件沒有在提供的設計稿中定義。實作時要用什麼替代？建議改用 emoji 或 `@expo/vector-icons`。

### 6.3 功能邊界不清楚

11. **孩子端通知的點擊行為**：設計稿有 `onOpen` 回調但沒定義跳轉目標。不同 `kind` 的通知點擊後要跳去哪個畫面？

12. **家長端設定頁的各選項**：「語言」「通知」「審核方式」「螢幕時間」的具體操作流程沒有在設計稿中定義。這些是 MVP 範圍嗎？

13. **孩子端 Me 頁「家長協助」點擊**：目標路由未定義。是開啟一個說明頁面，還是切換到家長端，還是其他？

14. **任務頻率設定**（每日 / 每週 / 週一三五）：新增任務的頻率選擇 UI 在設計稿 `C_KeyboardDemo` 只有文字顯示，沒有定義選擇器的 UI 樣式。需要確認。

15. **連續天數（streak）計算**：Me 頁顯示 streak，但計算邏輯不在設計稿中。由 Cloud Function 計算並存在 Firestore？確認。
