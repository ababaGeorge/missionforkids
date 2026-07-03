# Handoff: Parent 端對齊 + 4 功能 + 點數系統 cloud functions 全部署上線

## Session Metadata
- Created: 2026-05-18 17:43:24
- Project: /Users/ababa_george/conductor/workspaces/missionforkids/manado
- Branch: ababaGeorge/office-hours
- Session duration: 跨多天（2026-05-14 ~ 05-18），單次累計約 6 小時

### Recent Commits (for context)
  - eebb8ca chore(functions): Node runtime 20 → 22（2026-10-30 停用前升級）
  - 37108e3 feat(parent): 帳號管理 — 暱稱/頭像/移除成員（⑥）
  - 77ccbb9 feat(parent): 小孩扣點功能（⑤ deduct points）
  - cdce35e feat(parent): 任務編輯功能（② task edit）
  - cbd5761 feat(parent): 任務頻率截止日改 Plan C — 避開2月/大小月問題

## Handoff Chain

- **Continues from**: 2026-05-14 child 端 10 頁對齊（checkpoint: `~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260514-161600-child-10-pages-aligned-pushed.md`）
- **權威 pending 來源**: `~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260518-174056-parent-features-points-functions-deployed.md`（`/context-restore` 讀這個）
- **Supersedes**: 上一個 child 對齊 checkpoint

## Current State Summary

接續 child 端 10 頁 prototype 對齊。本輪把 parent 端 9 頁也對齊到 Night Sky prototype，修掉一連串 dev 登入/登出/資料殘留 bug，做了使用者要的 4 個功能（任務頻率選擇器 Plan C、任務編輯、小孩扣點、帳號管理暱稱/頭像/移除），最後把點數系統的 6 個 cloud functions 全部用 Node.js 22 部署到正式環境 — 這解決了「錢包點數永遠 0」的根因（之前 trigger functions 根本沒部署）。所有 commit 已 push origin/ababaGeorge/office-hours（HEAD = eebb8ca），工作樹乾淨。下一步是使用者在 simulator 重登跑完整點數 happy path 驗證。

## Codebase Understanding

### Architecture Overview

- Expo / React Native app，expo-router 檔案式路由，`src/app/parent/(tabs)/` 與 `src/app/child/(tabs)/`
- Firebase：Firestore（資料）+ Cloud Functions（點數異動唯一寫入者）+ Auth（匿名/Apple/Google）
- 點數系統核心原則：`firestore.rules` 的 `pointWallets` 設 `update/delete: false` → 只有 Cloud Functions（admin SDK）能改餘額，client 永遠不能直接寫。所有點數異動必須走 function。
- Design tokens 在 `src/design/tokens.ts`（P 物件深色宇宙主題）、`src/design/Text.tsx`（variant 字型系統）

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/app/parent/(tabs)/tasks.tsx` | 任務管理 + CreateTaskModal（含①頻率Plan C、②編輯） | 高 — 4 功能中 2 個在這 |
| `src/app/parent/(tabs)/family.tsx` | 設定頁（成員/邀請碼/grant）+ ⑤扣點 + ⑥帳號管理 | 高 |
| `src/app/parent/(tabs)/review.tsx` | 審核 + 兌換確認全螢幕 sheet（P4/P5） | 中 |
| `src/app/auth/sign-in.tsx` | dev 登入 + orphan cleanup（孤兒判斷） | 高 — cleanup 邏輯易踩雷 |
| `src/lib/inviteCode.ts` | 邀請碼產生/兌換（child redeem 補 membership） | 中 |
| `functions/src/grantPoints.ts` | 家長 grant/deduct（已改允許負數+clamp） | 高 |
| `functions/src/onRewardOrderCreated.ts` | 兌換申請先扣（餘額不足 reject） | 中 |
| `src/types/models.ts` | FamilyMembership 加 nickname/avatarEmoji | 中 |
| `firestore.rules` | pointWallets update:false 是點數安全核心 | 高 — 改點數邏輯前必讀 |

### Key Patterns Discovered

- Firestore membership doc ID 一律 `${uid}_${familyId}`（rules `isFamilyMember` 靠這查）。順序錯 = permission-denied。
- 所有 `.onSnapshot` callback 開頭必須 `if (!snap) return;`（登出時 listener cancel 傳 null）。
- 列表項目 family-scoped 顯示名用 `nameOf(m) = membership.nickname || user.displayName`，頭像 `avatarOf(m) = membership.avatarEmoji`。
- CRUD 一律包 try/catch + Alert（否則 firestore 錯誤靜默 → UI 看起來「按鈕壞了」）。
- 並排按鈕用 `flex:1` 樣式；直式單一按鈕要用無 flex 的獨立樣式（否則撐歪 clip 文字）。

## Work Completed

### Tasks Finished

- [x] Parent 端 9 頁 prototype 對齊（P1/P3/P6/P7/P8/P9 + P4/P5 全螢幕 sheet）
- [x] ① 任務頻率截止日 Plan C（每天無/每週選週幾/每月1·5·10·15·20·25·月底/單次1-365自由填）
- [x] ② 任務編輯（點任務卡開編輯，預填 + instance 對帳）
- [x] ⑤ 小孩扣點（grant modal 給/扣切換 + function 允許負數 + balance clamp）
- [x] ⑥ 帳號管理（暱稱/頭像 emoji/移除成員，含權限規則）
- [x] 修 dev sign-in 第二次 permission-denied、stale membership/orphan 資料累積、登出卡死、登出紅屏、邀請碼按鈕沒字、invite redeem 缺 membership、兌換前後 label 雙扣
- [x] 6 個 cloud functions 全部用 Node.js 22 部署到 prod

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| parent/(tabs)/tasks.tsx | Plan C 頻率 + 任務編輯 | ①② 功能 |
| parent/(tabs)/family.tsx | 扣點 + 帳號管理 modal + 邀請碼按鈕修 | ⑤⑥ + bug |
| parent/(tabs)/review.tsx | inline-expand → 全螢幕 sheet + try/catch | P4/P5 對齊 |
| auth/sign-in.tsx | 孤兒判斷 cleanup + 登出 navigate | bug 修 |
| lib/inviteCode.ts | child redeem 補 authUid membership | bug 修 |
| functions/src/grantPoints.ts | 允許負數 + balance clamp 不低於0 | ⑤ |
| functions/package.json | engines.node 20→22 | Node 停用前升級 |
| types/models.ts | FamilyMembership +nickname/avatarEmoji | ⑥ |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| 雙指派維持獨立計算 | 獨立 vs 協作型 | 家務 app 各做各的較合理，使用者確認 |
| 頻率用 Plan C 純按鈕 | 原生日曆元件 vs 純按鈕 | 不裝依賴、月底自動處理閏年大小月，零邊界 bug |
| firebase-functions 不升大版本 | 升 v7 vs 留 6.6.0 | 6.x v2 API 正確且運作中，升 v7 有 breaking change |
| 餘額不足自動擋兌換 | 自動擋 vs 讓家長決定 | 使用者確認要系統自動擋 |
| 同意後不可反悔 | 加取消鍵 vs 不加 | 使用者：這是責任，不加 |

## Pending Work

### Immediate Next Steps

1. **使用者重登 simulator 跑完整點數 happy path**：孩子做任務 → 家長審核通過 → 確認 wallet 點數真的累加（functions 已部署，這次應該不再是 0）→ 孩子兌換 → 點數扣除 → 家長婉拒 → 點數退回。同時測 4 新功能 + 邀請碼「完成」按鈕有字。
2. **暱稱跨畫面統一**（中等改動）：暱稱目前只在設定頁生效，任務/審核/通知頁仍顯示真實 displayName（那些查 users 不查 membership）。
3. **GCP Artifact 清理政策**：使用者自行跑 `firebase functions:artifacts:setpolicy --location us-central1 --days 3 --force`（Claude auto-mode 會擋，需使用者親自）。

### Blockers/Open Questions

- [ ] cliclick 對 iOS simulator 點擊不穩定 → parent 端 UI 自動化驗證做不了，需使用者手動操作 simulator
- [ ] dev 環境測點數累加需先有孩子完成任務（dev seed 寫 balance:0）

### Deferred Items

- 小孩間點數互轉：使用者明確說未來做、現在不做
- gstack 工具升級 1.11→1.40：為不打斷結報延後

## Context for Resuming Agent

### Important Context

**點數系統現在是 live 的。** 之前所有「wallet 永遠 0」的測試結果都是因為 trigger functions 沒部署，不是 code bug。現在 6 個 functions 全部署在 prod（Node 22），任務通過會真的加點、兌換會扣點、婉拒會退點。下個 session 第一件事是讓使用者重登 simulator 實測這條 happy path 確認上線正常。

**dev sign-in 的 orphan cleanup 很容易誤解。** 它用「擁有者不在當前 active 成員清單 = 孤兒」判斷來清 tasks/rewards/instances/orders，不是靠「本次新標記 removed 的 uid 清單」（那個第二次登入後是空的）。改 sign-in.tsx 的 cleanup 邏輯前先讀懂這段。

### Assumptions Made

- Firebase 專案 mission-for-kids 已登入且 functions 部署權限正常（已驗證部署成功）
- simulator 上 Roy/Queenie 是真實邀請流程加入的孩子（cleanup 不會誤刪有 active membership 的成員）

### Potential Gotchas

- `gstack-slug` 在 cwd 不是 mfk workspace 時會解析錯（會變 glab）。寫 mfk checkpoint 要硬指定 `~/.gstack/projects/ababaGeorge-missionforkids/`。
- `firebase deploy` 末尾的 cleanup-policy `Error` 不是部署失敗，functions 已成功。
- 登出一定要 `router.replace('/auth/sign-in')`，只 signOut() 會卡「還沒有家庭」。

### Environment State

### Tools/Services Used

- Firebase CLI（已登入，project mission-for-kids，functions 全部署 Node22）
- iOS Simulator iPhone 17 Pro iOS 26.4（cliclick 點擊不穩，需手動）
- Metro bundler（port 8081，背景）

### Active Processes

- Metro 可能仍在背景跑（port 8081）。下個 session 若 hot-reload 沒反應，重啟 `npx expo start --dev-client`。

### Environment Variables

- 無需手動設定的 env var（Firebase config 在 google-services.json / GoogleService-Info.plist）

## Related Resources

- 權威 pending checkpoint: `~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260518-174056-parent-features-points-functions-deployed.md`
- UI 規格: `docs/ui-spec-c2.md`
- 點數系統決策: `docs/任務獎勵App_決策文件.md`、`docs/資料模型_v1.md`
- origin: https://github.com/ababaGeorge/missionforkids.git（branch ababaGeorge/office-hours, HEAD eebb8ca）

---

**Security Reminder**: 無 secret 寫入本文件（env var 只列名稱、無 token/key）。
