---
status: ready-to-start
branch: ababaGeorge/office-hours
timestamp: 2026-04-23T01:45:30+08:00
files_modified:
  - HANDOFF.md
  - firestore.rules
  - functions/src/index.ts
  - src/app/auth/sign-in.tsx
  - src/app/child/(tabs)/_layout.tsx
  - src/app/child/(tabs)/points.tsx
  - src/app/child/(tabs)/rewards.tsx
  - src/app/child/(tabs)/tasks.tsx
  - src/app/parent/(tabs)/_layout.tsx
  - src/app/parent/(tabs)/family.tsx
  - src/app/parent/(tabs)/review.tsx
  - src/app/parent/(tabs)/rewards.tsx
  - src/app/parent/(tabs)/tasks.tsx
  - src/i18n/en.json
  - src/i18n/zh-TW.json
  - src/lib/inviteCode.ts
  - tsconfig.json
---

## Working on: Mission for Kids UI 重刻對齊 Claude Design prototype — 實作交接給下個 session

### Summary

前置全部搞定。使用者已答覆 Q1/Q2/Q3，但選擇「不在這個 session 開工，交接給下一個重啟 session」— 為了載入 11 個新 plugin（firebase、typescript-lsp、context7 等）能幫上忙。下個 session 開始就直接跑 11 步驟實作，目標 ~7 小時內做完 child + parent 核心迴圈。

### Decisions Made（使用者答覆，下個 session 直接照這個做）

**Q1 — Child 的 `ai.tsx` tab：**
- **刪除。** 理由：這其實是小孩拍照提交功能，該改成走 per-task 提交流程（點進個別任務中提交）。
- 意思：
  - 移除 `src/app/child/(tabs)/ai.tsx` tab route 註冊
  - 保留檔案內容當參考（移到其他位置或直接刪，下個 session 判斷）
  - 拍照 UI 內建在 Child Task Detail（對應 `prototype_child.jsx` 的 `ChildTaskDetail`）
- Child tabs 最終結構：**tasks / rewards / me**（對齊 prototype）

**Q2 — Display 字體：**
- **照設計稿。** 用 Noto Serif TC（800 weight）作為 display 字體
- Body：Noto Sans TC
- Data（數字）：DM Sans + `fontVariant: ['tabular-nums']`
- 裝法：`npx expo install @expo-google-fonts/noto-serif-tc @expo-google-fonts/noto-sans-tc @expo-google-fonts/dm-sans expo-font`
- 所有套件都是 JS-only，不需要 EAS rebuild
- 在 root `_layout.tsx` 用 `useFonts` 掛載，載入中 return null（Expo 標準 pattern）

**Q3 — `react-native-svg`：**
- **今晚不裝。** 用 Unicode ★ + 金色 + text shadow 當 `PRoughStar` workaround
- `PStarfield` 用 `<View>` + absolute 位置小圓點（不需要 SVG）
- Pip owl mascot：暫時用 🦉 emoji 佔位
- Phase 2 再裝 `react-native-svg` + 跑 EAS rebuild（15-20 分鐘）+ 使用者手動裝新 dev client + 換 PRoughStar 真 SVG + Pip owl 真 SVG

**設計來源定版（已釐清，下個 session 直接照這個參考，別走錯）：**
- **就是 `prototype.html` + `prototype_*.jsx` 系列**：
  - `~/Desktop/missionforkids project/missionforkids/core_loop/prototype_shared.jsx`（P palette + PStarfield + PRoughStar + PEmpty + PTabBar）
  - `~/Desktop/missionforkids project/missionforkids/core_loop/prototype_child.jsx`（ChildTasksHome / ChildTaskDetail / ChildWait / ChildCelebrate）
  - `~/Desktop/missionforkids project/missionforkids/core_loop/prototype_child2.jsx`（ChildRewards / ChildRedeemConfirm / ChildOrder / ChildNotifs / ChildMe）
  - `~/Desktop/missionforkids project/missionforkids/core_loop/prototype_parent.jsx`（parent 螢幕）
  - `~/Desktop/missionforkids project/missionforkids/core_loop/prototype_parent2.jsx`（parent 螢幕）
  - `~/Desktop/missionforkids project/missionforkids/core_loop/prototype_store.js`（MFKStore 虛擬資料 + actions，參考資料結構用；真的要接 Firestore）
  - `~/Desktop/missionforkids project/missionforkids/core_loop/ios-frame.jsx`（iOS 26 Liquid Glass pills 參考）
- **不是** `screens_a.jsx`（那是三方向比較板 Direction A，已廢）
- 線上版（使用者同事在試玩的）：https://missionforkids.vercel.app/prototype.html

**設計 tokens（從 `prototype_shared.jsx` 的 P palette 搬）：**
```ts
// src/design/tokens.ts 該長的樣子
export const P = {
  bg: '#0B0E1A',           // 深夜藍
  text: '#F7F2EA',         // 乳白
  muted: '#8A8D9F',
  surface: '#131727',
  surfaceHi: '#1A1F33',
  surfaceCream: '#F4E9D8',
  border: 'rgba(247,242,234,0.10)',
  primary: '#FFD966',      // 金黃
  primaryDark: '#B8892E',
  primaryGlow: 'rgba(255,217,102,0.35)',
  accent: '#F5A623',
  accentHot: '#FF6B47',
  green: '#5EE0A8',
  purple: '#8B7ED8',
  blue: '#6FA9E8',
};
```

**路線確認（handoff 早就寫過，再次確認）：**
- 路線 A：保留 manado iOS app 架構 + Firebase 後端，只改 `src/app/**` + `src/components/**`
- 不另起新 RN 專案
- 不動 backend（6 個 Cloud Functions / Firestore rules / Storage rules / 資料模型）

**結報 / session 流程改動（今晚已改全域 rule）：**
- `~/.claude/rules/session-start.md`：`/context-restore` 當 pending 權威；dated handoff 降級為歷史快照，引用前必須驗證現場
- `~/.claude/rules/handoff.md`：`/context-save` 是結報中樞，data.json / handoff 從它派生
- 下個 session 一開始會**自動跑 `/context-restore`**（因為 rule），**撈到這份 checkpoint**

### Remaining Work（下個 session 的 11 步驟，照順序跑）

**Step 0（5 min）— Revert 錯方向改動：**
- `git checkout src/app/child/(tabs)/tasks.tsx` — revert 掉今晚做錯的 Direction A 版
- `git checkout src/app/child/(tabs)/_layout.tsx` — revert 掉 tab 主色改 teal 的版
- **保留** `src/i18n/en.json` + `zh-TW.json` 新增的 keys（today / noTasksToday / haveFun / nextMission / otherMissions / earned）— 之後會用到

**Step 1（40 min）— 設計系統基底：**
建立 `src/design/` 資料夾，新增這些檔：
- `tokens.ts` — P palette（見上方）+ spacing scale（從 `colors_and_type.css` 的 --space-* 搬）+ radius + shadow
- `fonts.ts` — 用 `expo-font` + `@expo-google-fonts/noto-serif-tc` + `/noto-sans-tc` + `/dm-sans`，export `useAppFonts` hook
- `Text.tsx` — Typography primitives：`<Display>`, `<Body>`, `<Label>`, `<Data>`, `<Muted>`。每個都內建正確字體 + 顏色 + 大小
- `Starfield.tsx` — `<View>` + absolute 小圓點，props `count` 預設 22
- `RoughStar.tsx` — workaround：`<Text>` with 金色 + text shadow + 800 weight + size prop（Phase 2 換真 SVG）
- `Empty.tsx` — 空狀態元件，props: emoji / title / body（對齊 `prototype_shared.jsx` 的 `PEmpty`）

root layout（`src/app/_layout.tsx`）接 `useAppFonts`，載入中 return null 或 Splash。

**Step 2（60 min）— Child Tasks Home：**
改寫 `src/app/child/(tabs)/tasks.tsx` 對齊 `prototype_child.jsx` 的 `ChildTasksHome`：
- Starfield 背景
- Header「今天的任務」+「嗨，{孩子名}」+ 右上角金黃星星 pill
- 進度條「今天完成 X/Y」+ `pct%`（primary → accent 漸層）
- 三段列表：要做的 / 等爸媽看 / 完成了
- 每張 Card 點擊 → navigate 到 Task Detail
- Firestore realtime 串接 `taskInstances` collection

**Step 3（45 min）— Child Task Detail + 拍照：**
新建 `src/app/child/task/[id].tsx` 對齊 `prototype_child.jsx` 的 `ChildTaskDetail`：
- Header（sheet-style，✕ 關閉）
- 任務 icon + 名稱 + 點數
- 若狀態 rejected，顯示「爸媽說要再試一次」+ parentNote
- 拍照卡片：虛線框 + 📷 emoji + 「拍一張照給爸媽看」
- 底部「晚點做」/「完成任務」按鈕
- 提交：打 Cloud Function 或直接寫 `taskSubmissions` collection（看現有 tasks.tsx 的 handleSubmit 保留邏輯）

**Step 4（30 min）— Child Wait + Celebration：**
- 提交後 overlay 顯示 `ChildWait`（星光傳送中…）
- 偵測 instance status → approved 時切 `ChildCelebrate`（🎉 + 全螢幕 primary glow + +★）

**Step 5（60 min）— Child Rewards + Redeem + Order：**
對齊 `prototype_child2.jsx`：
- 改寫 `src/app/child/(tabs)/rewards.tsx` → ChildRewards
- 新建 `src/app/child/reward/[id].tsx` 或 modal → ChildRedeemConfirm
- 新建 `src/app/child/order/[id].tsx` → ChildOrder
- 串 `rewardOrders` collection + `onRewardOrderCreated` Cloud Function

**Step 6（30 min）— Child Me（替換 points.tsx）：**
對齊 `prototype_child2.jsx` 的 `ChildMe`：
- 頭像圈 + 名字 + 年齡
- 三張卡片：星光 / 連續天 / 完成率
- 徽章 grid 6 張（先 mock：連續 7 天 / 讀書家 / 創作家 / 100 顆星 / 夜貓子 / 月冠軍）

**Step 7（30 min）— Child tab bar 重組：**
改寫 `src/app/child/(tabs)/_layout.tsx`：
- 移除 `ai.tsx` + `points.tsx` route（`points.tsx` 檔案可刪，功能進 me）
- 新增 `me.tsx`（Step 6 產出的）
- tab 結構：tasks / rewards / me
- tab bar 樣式照 `prototype_shared.jsx` 的 `PTabBar`（深底 + 金黃 active + 乳白 muted）

**Step 8（60 min）— Parent Tasks Manage + Review：**
讀 `prototype_parent.jsx` 對齊，改寫：
- `src/app/parent/(tabs)/tasks.tsx`
- `src/app/parent/(tabs)/review.tsx`

**Step 9（45 min）— Parent Rewards + Settings + Family：**
讀 `prototype_parent2.jsx` 對齊，改寫：
- `src/app/parent/(tabs)/rewards.tsx`
- `src/app/parent/(tabs)/family.tsx`（或併進 Settings）
- 新建 Settings 如果 prototype 有

**Step 10（30 min）— Parent tab bar 重組：**
改寫 `src/app/parent/(tabs)/_layout.tsx`：
- tab 結構對齊 prototype（tasks / review / rewards / settings，可能加 notifs）
- tab bar 樣式同 child 用 PTabBar

**Step 11（30 min）— 全流程 smoke test：**
模擬器跑一遍：
1. Parent 派任務 → 切 Child
2. Child 看 tasks home 有新任務 → 點進去 detail
3. Child 拍照提交（模擬器就按 simulate 即可）
4. 切 Parent → review 看到 submission → 核准
5. 切 Child → 看到 Celebration overlay
6. Child 去 rewards 兌換
7. Parent 核准兌換
8. Child 標記已收到

任何 bug 修掉。

### Notes

**OpenAI API key（已搞定，不要再動）：**
- 使用者在 2026-04-22 17:16 已把 OPENAI_API_KEY 從 version 1 換到 version 2
- `analyzePhoto` function 已綁 version 2 重新部署
- 今晚使用者因為我誤判又多生了一把 key — 可以去 OpenAI console delete 那把新的
- `handoffs/2026-04-17-xxx.md` 裡「OpenAI API key 仍需更換」是**過期條目**，別再當真

**Firebase / EAS 狀態：**
- `firebase login`：`ababaplanet@gmail.com` ✓
- active project：`mission-for-kids` ✓
- 6 個 Cloud Functions 在線且健康
- Firestore 區域：asia-east1、Functions 區域：us-central1
- EAS：project ID `569558f4-09ae-440f-b5d6-e6592d94b972`
- iPhone 17 Pro 模擬器 UDID：`B4436202-581F-4922-8D3A-B2CAA91273DE`
- Metro 可能還跑在 port 8081（pid 58298），若卡住可 kill 重啟

**新裝 11 個 plugin（使用者重開 Claude Code 後載入）：**
- 🔥 firebase / typescript-lsp / context7（開工最有用）
- 其他：notion / coderabbit / playwright / sentry / claude-md-management / vercel / skill-creator / tdd

**Build 配置（鎖定，千萬不要動）：**
- RNFB v24 + Firebase iOS SDK 12.10.0
- `useFrameworks: "static"` + `forceStaticLinking`
- EAS image Xcode 16.3
- 本機不要 build（Xcode 26 跟 gRPC CocoaPods 不相容 → 只能 EAS 雲端）

**核心原則（firestore.rules 也規範）：**
- 所有點數操作走 Cloud Functions，client 端**不碰** `pointWallets` / `pointTransactions`

**已嘗試過不管用的：**
- 今晚做過 Direction A 版（米色+teal）tasks.tsx — 錯方向，Step 0 要 revert
- `osascript` 控模擬器 iOS 對話框 — macOS System Events 被 deny（error 1002）

**下個 session 開始時的提醒：**
- 先跑 `/context-restore` 撈這份 checkpoint（新 rule 會自動做）
- 確認使用者還在待機 or 已睡 → 決定要不要中途問問題
- 使用者說「我要去睡了」隱含意思：遇到兩難不要等，照 decisions 裡的判斷直接推進
- 照 11 步驟順序跑，每個 step 完成後看情況寫簡短 `[PROGRESS]` 一行
- Step 11 做完前先跑 `/context-save` 存進度，避免中間 crash 失去狀態
- 全跑完再跑最後一次 `/context-save` + 更新 data.json 結報

**跨 session 對齊文件：**
- `~/.claude/rules/session-start.md`（今晚已改）
- `~/.claude/rules/handoff.md`（今晚已改）
- `~/.claude/CLAUDE.md`（全域 profile，沒動）
- `manado/CLAUDE.md`（專案層級，沒動）
- `manado/.claude/rules/expo-rn-firebase.md`（專案層級，沒動）
