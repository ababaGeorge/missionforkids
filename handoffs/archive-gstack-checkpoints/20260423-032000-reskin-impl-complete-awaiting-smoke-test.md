---
status: implementation-done
branch: ababaGeorge/office-hours
timestamp: 2026-04-23T03:20:00+08:00
files_modified:
  - app.json
  - package.json
  - package-lock.json
  - src/app/_layout.tsx
  - src/app/child/(tabs)/_layout.tsx
  - src/app/child/(tabs)/rewards.tsx
  - src/app/child/(tabs)/tasks.tsx
  - src/app/parent/(tabs)/_layout.tsx
  - src/app/parent/(tabs)/family.tsx
  - src/app/parent/(tabs)/review.tsx
  - src/app/parent/(tabs)/rewards.tsx
  - src/app/parent/(tabs)/tasks.tsx
files_added:
  - src/app/child/(tabs)/me.tsx
  - src/app/child/task/[id].tsx
  - src/app/child/reward/[id].tsx
  - src/app/child/order/[id].tsx
  - src/design/tokens.ts
  - src/design/fonts.ts
  - src/design/Text.tsx
  - src/design/Starfield.tsx
  - src/design/RoughStar.tsx
  - src/design/Empty.tsx
  - src/design/index.ts
files_deleted:
  - src/app/child/(tabs)/ai.tsx
  - src/app/child/(tabs)/points.tsx
---

## Working on: Mission for Kids UI 重刻完成 — 靜態編譯全部過，等模擬器 smoke test

### Summary

11 step 實作計畫跑完 10 步（Step 0-10），Step 11 因為無法從 shell 控制模擬器交給使用者實測。

**Step 0**：revert 掉 session 初 Direction A teal/cream 版（child/tasks.tsx + _layout.tsx）
**Step 1**：建 `src/design/` 設計系統 — tokens（P palette + spacing + radius + shadow）、fonts（Noto Serif TC 800 + Noto Sans TC + DM Sans + useAppFonts hook）、Text（Display/H1-H3/Body/Label/Muted/Data）、Starfield（原生 View absolute dots）、RoughStar（Text + 金色 + text-shadow 當 SVG workaround）、Empty。root `_layout.tsx` 接 useAppFonts loading gate。
**Step 2**：child/(tabs)/tasks.tsx 重刻 ChildTasksHome — Starfield、Header「嗨，{name}」+ 星光 pill、進度條、三段列表（要做的 / 等爸媽看 / 完成了）。card 點擊 → navigate 到 /child/task/[id]。
**Step 3+4 合併**：新建 `src/app/child/task/[id].tsx` state-machine — status=pending/rejected 顯示 Form（emoji + 拍照卡片 + 晚點做/完成任務）；status=submitted 顯示 Wait overlay（星光傳送中）；status=approved 顯示 Celebrate（🎉 + primary glow + +★）。使用 expo-image-picker 拍照 + 上傳 Firebase Storage + 寫 taskSubmissions + 更新 taskInstance.status = submitted。
**Step 5**：rewards.tsx 重刻 ChildRewards（星光餘額 + active order banner + 2-col grid + history）。新增 /child/reward/[id]（redeem confirm — before/after 星光 + 問爸媽按鈕 → 寫 rewardOrders pending）。新增 /child/order/[id]（路程圖 — 3 步時間線 + 我拿到了按鈕 → status=completed）。
**Step 6**：新建 /child/(tabs)/me.tsx — 頭像圈（首字）+ 3 張卡片（星光 / 連續天 / 完成率）+ 6 張 badge（mock 分 got/not got）+ 登出。
**Step 7**：child tab bar 重組：刪除 ai.tsx / points.tsx，新增 me.tsx。自訂 `PTabBar` 用 `tabBar` prop — tasks/rewards/me 三個 tab，深底 + 金黃 active + 乳白 muted + 小圖示。
**Step 8**：parent/(tabs)/tasks.tsx 重刻 ParentTasksManage — 「X 個在跑」header + 管理/歷程 segment + 任務卡 + FAB + 新增 Modal（範本 chips + 名稱 + 點數 + 頻率 + 截止 + 指派 + 審核模式）。parent/(tabs)/review.tsx 重刻 ParentReviewList — 「X 個等你看」+ 禮物申請 section（乳白底，對齊 prototype surfaceCream）+ 任務 section + 點擊展開 inline 照片/備註/通過或再試一次。
**Step 9**：parent/(tabs)/rewards.tsx 重刻 ParentRewardsTab — 「X 個可以換」+ 2-col grid + 兌換紀錄 + FAB + 新增禮物 Modal（emoji picker + stepper + 類型切換）。parent/(tabs)/family.tsx 重刻成 Settings 型（家庭名 + 家長 + 小孩 + 邀請碼 + 登出），保留全部 handlers（family create、add child、grant points、parent invite）。
**Step 10**：parent tab bar 同 child 用 PTabBar — tasks/review/rewards/family(設定)。

### Build Health

- TypeScript：`npx tsc --noEmit` 全乾淨（只剩 pre-existing `useAuth.ts` 條件判斷警告，非我產生）
- 新裝依賴：`@expo-google-fonts/noto-serif-tc`、`@expo-google-fonts/noto-sans-tc`、`@expo-google-fonts/dm-sans`、`expo-font`（JS-only，不需 EAS rebuild）
- app.json：`expo install` 自動加 `expo-font` 到 plugins 陣列，同時修了既有一行縮排 typo（`[` 沒對齊）
- Firebase 後端完全不動：6 個 Cloud Functions、Firestore rules、資料模型零改

### Decisions Made

- **Wait + Celebrate 收進 Task Detail state-machine**：prototype 分 3 個獨立 component（Detail/Wait/Celebrate），我做成同一個 `/child/task/[id]` 路由依 `instance.status` 切 sub-view — navigation 簡單 + realtime 偵測狀態切換更直覺。
- **Emoji 自動推斷**：Task / RewardItem 資料模型沒有 emoji 欄位，我寫了 `emojiFor(title)` 跟 `rewardEmoji(title)` 做字串關鍵字 → emoji 映射當 fallback。使用者新增禮物可以在 Modal 選 emoji（已寫入 Firestore extra field `emoji`，但 TS 型別沒宣告，用 optional chain 讀）。
- **parentNote 存 optional field**：rejected 狀態顯示的「爸媽說要再試一次」訊息寫 `instance.parentNote`（非型別欄位）。Firestore 允許 extra fields，client 用 optional chain 讀。可以後續加到 TaskInstance type。
- **Tab bar 完全自訂**：用 `tabBar={(props) => <PTabBar {...props} />}` 取代預設 Material tab bar，才能 match prototype 的 ✦ ♡ ☽ 圖示 + 深底 + 金黃 active。
- **保留舊 CelebrationOverlay**：child/(tabs)/tasks.tsx 仍 import CelebrationOverlay 當 approved 偵測的 fallback 動畫（跟 /child/task/[id] Celebrate 畫面互不影響，看 user flow 哪個先觸發）。
- **family.tsx 保留全部業務邏輯**：建家庭 / 加小孩 / 邀請碼 / 邀請家長 / 直接給點 Cloud Function call — 全部保留，只換外層 styling。

### Remaining Work

**Step 11（需使用者手動）— 模擬器 smoke test：**

1. 啟動 Metro：`npx expo start` 在 manado workspace（port 8081 可能還在跑之前的 process，若卡住 `lsof -ti:8081 | xargs kill`）
2. 在 iPhone 17 Pro 模擬器（UDID B4436202-581F-4922-8D3A-B2CAA91273DE）開 app
3. 分別以 parent / child 身分各跑一次 golden path：
   - Parent 登入 → tasks → 按 FAB → 新增任務「刷牙」10 點指派給孩子
   - 切 Child 身分 → tasks → 看到「刷牙」card → 點進 Detail → 拍照（模擬器選 Photo Library）→ 完成任務 → 看到 Wait overlay
   - 切 Parent → review → 看到 submission → 點展開 → 通過
   - 切 Child → Detail 應自動切 Celebrate 畫面 → 按「下一個任務」回 tasks
   - Child → rewards → 點禮物 → confirm → 問爸媽 → 跳 order 路程圖（等爸媽答應）
   - 切 Parent → rewards → 點「已交付」（前提：review 還沒實作 reward 的 approve，所以得先從 review 同意）
   - Child → order 畫面按「我拿到了」→ status=completed
4. 遇到 runtime error（字體沒載、layout 破、Firestore 權限）記下來回報

**已知需要驗證的風險**：
- `@react-navigation/bottom-tabs` 的 `BottomTabBarProps` import 路徑 — TS 編譯過但 runtime 可能要 react-navigation 已裝（Expo Tabs 已內建，理論上 OK）
- 字體載入要 ~200-500ms 首次冷啟動會看到 P.bg 深藍空白畫面 — 正常
- RewardItem type 沒 `emoji` field，既有資料讀不到 → fallback 到 `rewardEmoji(title)`
- TaskInstance type 沒 `submittedAt` / `parentNote` — 讀取用 optional chain、寫入 parent 審核時會寫進去

### Notes

**若要進入 Phase 2（真 SVG）：**
- `npx expo install react-native-svg`（native module）
- 跑 EAS Build 重建（15-20 min）+ 使用者手動裝新 dev client
- 把 `src/design/RoughStar.tsx` 從 Text 星星換成真 SVG `<path>`（copy prototype_shared.jsx 的 d）
- Pip owl mascot 從 🦉 emoji 換成真 SVG

**可能遺漏的 UX**：
- prototype 有 iOS-style PStatusBar（假的 9:41 + 信號 + 電池）— 我沒做，用真的 SafeAreaView + 系統 status bar
- prototype 有 notifs tab — 我沒做（checkpoint 沒要求）
- Pip owl 未出現任何地方 — 要到 Phase 2 裝 SVG 才放
- Celebration 沒有 confetti 射線動畫（prototype 有 14 道金色輻射線）— 我用靜態 Starfield count=70 + primaryGlow 替代
- 字體 fallback：NotoSerifTC 沒載好時 text 會 render 系統字，不會 crash

### Follow-ups（smoke test 過後）

- 加 `TaskInstance.parentNote?: string` 跟 `submittedAt?: Timestamp` 到 types/models.ts
- 加 `RewardItem.emoji?: string` 到 types/models.ts
- Celebration 加 confetti 射線動畫（用 Animated API，14 條 transform rotate）
- PStatusBar 假狀態列（nice-to-have，很多 prototype 用戶覺得好玩）
- 檢查 Metro bundle size 有沒有因為 3 套 Google Fonts 暴增（預估 ~200KB）
