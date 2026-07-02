---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-04-23T00:47:00+08:00
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

## Working on: Mission for Kids UI 重刻對齊 Claude Design prototype（Phase 1 起點）

### Summary

在 `manado` workspace 重刻 iOS app 的 React Native UI 對齊 Claude Design 的定版 prototype。後端、Firebase、Cloud Functions 全部保留不動，只改 `src/app/**` 跟 `src/components/**`。今晚還沒真正開工（還在設計系統對齊前置），因為發現一開始參考錯檔案。

### Decisions Made

**設計來源（今晚釐清）：**
- **定版是 `prototype.html` + `prototype_*.jsx` 系列**（`prototype_shared.jsx` + `prototype_child.jsx` + `prototype_child2.jsx` + `prototype_parent.jsx` + `prototype_parent2.jsx` + `prototype_store.js` + `ios-frame.jsx`）
- **不是** `index.html` + `screens_a.jsx`（那只是三方向比較板，Direction A/B/C 的 A 版）
- 檔案位置：`~/Desktop/missionforkids project/missionforkids/core_loop/`
- 線上版：https://missionforkids.vercel.app/prototype.html

**設計 tokens（`prototype_shared.jsx` 裡的 P palette）：**
- bg: `#0B0E1A`（深夜藍）
- surface: `#131727`
- primary: `#FFD966`（金黃）+ `primaryGlow: rgba(255,217,102,0.35)`
- accent: `#F5A623`、`accentHot: #FF6B47`
- text: `#F7F2EA`、muted: `#8A8D9F`
- Display 字體：**Noto Serif TC**（襯線，800 weight）— 不是 Nunito
- 星星：**PRoughStar** 自訂 SVG（手繪感）— 不是 Unicode ★
- 背景 **PStarfield** 星空漸層
- iOS 26 Liquid Glass pills（從 `ios-frame.jsx`）

**路線 A 路徑確認：** 保留 manado iOS app 架構 + Firebase 後端，只改前端 UI。不另起新 RN 專案。

**全域 rule 修改（今晚完成）：**
- `~/.claude/rules/session-start.md`：改用 `/context-restore` 當 pending 權威來源，dated handoffs 降級為歷史快照
- `~/.claude/rules/handoff.md`：結 session 時先跑 `/context-save`，再寫 dated handoff
- 理由：這次 OpenAI key 事件暴露「handoff 靜態快照會騙下一次 session」的根本問題

### Remaining Work

**阻塞中，等使用者決定（3 個 Q）：**
1. **Q1：Child 的 `ai.tsx` tab 刪除 or 保留？** — prototype 沒這 tab，我建議暫時隱藏
2. **Q2：Display 字體 Noto Serif TC or Nunito？** — 我建議照 prototype 用 Serif TC
3. **Q3：今晚先不裝 `react-native-svg`，用 Unicode ★ workaround OK 嗎？** — 裝的話要 EAS rebuild 15-20 分鐘

**開工前動作（使用者做）：**
1. 退出 Claude Code 重開（載入 11 個新 plugin：firebase、typescript-lsp、context7 等）
2. 回 Q1 / Q2 / Q3（或直接「全部照建議」）
3. 說「開工」

**開工後 11 步驟（~7 小時）：**
1. Revert 今天做壞的 `tasks.tsx` + `_layout.tsx`（i18n keys 保留）
2. 設計系統基底：`src/design/` 底下建 tokens.ts / fonts.ts / Text.tsx / Starfield.tsx / RoughStar.tsx / Empty.tsx，root layout 接 `useFonts`
3. Child TasksHome 改寫（接 Firestore realtime）
4. Child TaskDetail 新路由（拍照 + 提交）
5. Child Wait + Celebration
6. Child Rewards + Redeem + Order
7. Child Me 替換 points.tsx
8. Child tab bar 重組（tasks / rewards / me）
9. Parent TasksManage + Review
10. Parent Rewards + Settings + Family
11. Parent tab bar 重組 + 全流程 smoke test

**Phase 2（明天白天）：**
- 裝 `react-native-svg` → EAS rebuild → 換 PRoughStar 真 SVG + Pip owl mascot
- AI 自動初審（需要確認新 OpenAI key 的使用情況）
- 通知 tab（要先設計 notifications collection 資料模型）

### Notes

**OpenAI API key 早已搞定（2026-04-22 17:16）：**
- OPENAI_API_KEY version 2 已在 Firebase Secret Manager
- `analyzePhoto` function 已重新部署綁 version 2
- `handoffs/2026-04-17` 的 pending「OpenAI API key 仍需更換」是**過期條目**
- 使用者今晚又生了一把新 key 是多餘的（我誤判叫他 set），可以去 OpenAI console delete

**Firebase / EAS 狀態：**
- `firebase login`：`ababaplanet@gmail.com` ✓
- active project：`mission-for-kids` ✓
- 6 個 Cloud Functions 在線：analyzePhoto / autoCompleteDeliveredOrders / grantPoints / onRewardOrderCancelledOrRejected / onRewardOrderCreated / onTaskInstanceApproved
- Firestore 區域：asia-east1、Functions 區域：us-central1
- EAS：project ID `569558f4-09ae-440f-b5d6-e6592d94b972`、iPhone 17 Pro 模擬器 UDID `B4436202-581F-4922-8D3A-B2CAA91273DE`

**已裝但還沒載入的 plugin（需重開 Claude Code）：**
- 🔥 firebase / typescript-lsp / context7（開工後會用到）
- 其他：notion / coderabbit / playwright / sentry / claude-md-management / vercel / skill-creator / tdd

**Build 配置（鎖定，不要動）：**
- RNFB v24 + Firebase iOS SDK 12.10.0
- `useFrameworks: "static"` + `forceStaticLinking`
- EAS image Xcode 16.3
- 本機不要 build（Xcode 26 跟 gRPC CocoaPods 不相容）

**核心原則：**
- 所有點數操作走 Cloud Functions，client 端不碰 pointWallets / pointTransactions
- pointWallets 禁止 client 寫入（Firestore rules 已規範）

**嘗試過不管用的：**
- 今晚改寫 tasks.tsx 用 Direction A 色盤（米色 + teal）— 風格錯，明天開工要 revert
- 用 `osascript` 控模擬器 iOS 對話框的「打開」— macOS System Events 權限被 deny（error 1002）

**Phase 2 才裝 svg 的原因：**
- `react-native-svg` 是 native 模組，新增後 dev client 要透過 EAS 重建
- 15-20 分鐘雲端 build + 使用者手動裝新 dev client
- 今晚 7 小時預算塞不進去，放白天搞
