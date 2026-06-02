# Plan C v2 — childId 點數重構（確定性單一錢包 + 歷史綁定）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **v2 變更（2026-05-29，codex consult 審查後）：** 加入 (1) **money 路由 server 端重解析 childId**（不信任 client 寫的欄位）；(2) **退款以原始 transaction 的 walletId 為帳本權威**；(3) 兩個 trigger 的 **idempotency**（確定性 transaction doc id）；(4) **金額欄位驗證**；(5) **歷史也綁 childId**（使用者決策：task/order/transaction 歷史一起搬）；(6) parent review.tsx 漏掉的錢包讀取；(7) 部署順序。`redeemInvite.ts` 舊重綁路徑**留給 Plan D**（使用者決策）。

**Goal:** 把「點數 + 歷史釘在 auth uid」改成「釘在永久 `childId`」。一個小孩在一個家庭只有一個確定性錢包 `pointWallets/{familyId}_{childId}`；任務/兌換/交易歷史也以 childId 歸戶。即使未來小孩換 uid（重註冊 / OAuth），只要 `childId` 不變，點數與歷史都不散。長期 bug「點數各頁不同步」的根因修復（見 [[points-identity-fragmentation]]）。

**Architecture（v2 核心兩條鐵律）：**

1. **Money 路由一律 server 端重解析 childId，不信任 client。** Cloud Function 處理金流時，`childId` 由 server 從權威來源重新解析，**不直接採用 client 寫進 doc 的 `childId` 欄位**：
   - 權威解析順序：`familyMemberships/{userId}_{familyId}.childId ?? userId`（membership 是 family-scoped 權威；user doc 為輔）。
   - doc 上 denormalized 的 `childId` 欄位**只給 client 端歷史歸戶查詢用**（低風險、使用者讀自己的資料），**不給 server 拿來搬錢**。
   - `grantPoints`：家長傳 `childUserId`，server 用 `membership.childId ?? childUserId` 解析錢包目標，不接受 client 直接指定任意 childId。
2. **退款與 idempotency 以 `pointTransactions` 為帳本權威。** 退款退回原始扣款 transaction 記錄的 `walletId`，不重算 childId；扣款/發點用確定性 transaction doc id 防重複。

**解析規則 `childId ?? uid` 的護欄（回應 codex「太安靜」）：** fallback 僅容許「`childId` 欄位不存在」（舊帳號）。若 `childId` 是空字串、非字串、或解析出的 membership 不屬於該 familyId → **拋錯，不靜默 fallback**。測試涵蓋 malformed/cross-family childId。

**Tech Stack:** firebase-functions v6 (v2 API)、firebase-admin v13、Firestore emulator、`firebase-functions-test`、jest（functions）、Expo 54 / expo-router 6、`@react-native-firebase` v24、jest-expo + RNTL v13。零新依賴。

**Branch:** `feat/real-user-accounts`

**範圍邊界：**
- 改點數金流身分解析（CF + client 寫入 + client 讀取）+ 任務/兌換/交易歷史歸戶，統一到 `{familyId}_{childId}`。
- **不做** `redeemInvite.ts` 舊邀請碼重綁路徑的 childId 化 → **Plan D**（它還用 `where userId==oldUid/newUid` 遷移錢包、不寫 childId，與本架構牴觸；Plan D 清匿名/舊機制時一併處理）。
- **不做** Plan D 的 dev 真帳號 seed 腳本 / 移除匿名 dev 捷徑。本計畫驗證用既有 Plan B email 邀請流程產生全新小孩。
- **不做** OAuth / 帳號連結（Phase 2）。

**部署順序（codex：避免錢包暫時不可見）：** 先部署 **CF 改寫**（含 `childId ?? uid` fallback，舊資料仍可運作）→ 再部署 **client 寫入帶 childId** → 最後 **client 讀取改 doc-id / childId 歷史查詢**。順序顛倒會讓舊 auto-id 錢包在 client 端短暫讀不到。

**相容性約束：**
- 錢包 doc 一律含 `childId` + `userId` + `familyId` + `balance` + `updatedAt`（保留 `userId` 維持與 `acceptFamilyInvite` 既有錢包相容）。
- 確定性 doc id 一律 `${familyId}_${childId}`，**程式從不反向解析此字串**（codex：分隔符歧義；只組不拆）。
- 每個 transaction **所有 read（含 idempotency read）必須在任何 write 之前**。

---

## 檔案結構

| 檔案 | 責任 | 動作 |
|---|---|---|
| `functions/src/lib/resolveChildWallet.ts` | server 共用：解析權威 childId + 定位確定性錢包 ref + 讀現值 | Create |
| `functions/src/lib/__tests__/resolveChildWallet.test.ts` | 上者測試（含 malformed / cross-family） | Create |
| `functions/src/grantPoints.ts` | server 解析 childId（驗證屬該家庭）→ 寫 `{familyId}_{childId}` + 金額驗證 | Modify |
| `functions/src/onTaskInstanceApproved.ts` | server 重解析 childId → 同錢包；tx 內重讀 instance idempotency；確定性 tx id | Modify |
| `functions/src/onRewardOrderCreated.ts` | server 重解析 childId → 扣點；確定性 tx id 防重複扣 | Modify |
| `functions/src/onRewardOrderCancelledOrRejected.ts` | 退款退回**原始扣款 transaction 的 walletId**；確定性 refund tx id | Modify |
| `functions/src/__tests__/*.test.ts` | 4 個 CF 測試：含「不寫 auto-id 錢包」斷言、malformed childId、idempotency 重放 | Create/Modify |
| `src/lib/childId.ts` | client 共用：`resolveMyChildId(uid)`（membership 權威）+ `walletDocId()` | Create |
| `src/lib/__tests__/childId.test.ts` | 上者測試 | Create |
| `src/app/parent/(tabs)/tasks.tsx` | 建 taskInstance 帶 `childId`（從 membership 解析） | Modify |
| `src/app/child/reward/[id].tsx` | 建 rewardOrder 帶 `childId` | Modify |
| `src/app/parent/(tabs)/review.tsx` | 家長審核頁錢包讀取改 childId（codex 漏網路徑 ~line 553） | Modify |
| `src/app/child/(tabs)/tasks.tsx` | 餘額讀取 + 任務歷史查詢改 childId | Modify |
| `src/app/child/(tabs)/me.tsx` | 餘額 + 歷史改 childId | Modify |
| `src/app/child/(tabs)/rewards.tsx` | 餘額 + 訂單歷史改 childId | Modify |
| `src/app/child/task/[id].tsx` | 餘額讀取改 childId | Modify |
| `src/app/child/order/[id].tsx` | 訂單詳情若按 uid 查 → 改 childId | Modify if needed |
| `src/types/models.ts` | `TaskInstance` / `RewardOrder` / `PointTransaction` 加 `childId?` | Modify |
| `firestore.rules` | 維持 `pointWallets` read `isSignedIn()`（doc-id 讀已可行，不收緊）；確認 childId 查詢的 index 需求 | Modify if needed |
| `firestore.indexes.json` | 若歷史查詢從 `userId` 改 `childId` 需新 composite index，補上 | Modify if needed |

---

## Section 1：server 共用 helper

### Task 1.1：`resolveChildWallet` + 權威 childId 解析（TDD）

**Files:** Create `functions/src/lib/resolveChildWallet.ts` + test

- [ ] **Step 1（紅）：** 測試涵蓋：
  - membership 有 `childId` → 用它定位 `{familyId}_{childId}`；
  - membership 無 `childId`（舊帳號）→ fallback 用 `userId`；
  - `childId` 是空字串 / 非字串 → **拋錯**（不靜默）；
  - membership 的 familyId 與傳入不符 / membership 不存在 → **拋錯**；
  - 錢包不存在 → `{ref, exists:false, balance:0}`；存在 → 回現值。
- [ ] **Step 2（綠）：** 兩個 export：
  - `resolveAuthoritativeChildId(tx_or_db, familyId, userId): Promise<string>` — 讀 `familyMemberships/{userId}_{familyId}`，回 `data.childId ?? userId`；缺 membership / familyId 不符 / childId malformed → throw。
  - `resolveChildWallet(tx, db, familyId, childId): {ref, exists, balance}` — `ref = pointWallets/{familyId}_{childId}`、`tx.get(ref)`、回現值。**只組 doc id，不拆。**
- [ ] **Step 3：** helper 不寫入。**所有 `tx.get` 在 caller 的任何 `tx.write` 之前呼叫。**

**驗收：** test 綠，含 malformed/cross-family 拋錯案例。

---

## Section 2：Cloud Functions 改用 childId（server 端重解析 + idempotency + 金額驗證）

> 共通：每個 CF 開頭加金額驗證 helper — `assertValidPoints(n)`：`Number.isInteger(n) && Number.isFinite(n)`，發點/扣點各自的正負規則。malformed → throw（callable）或 log+skip（trigger）。

### Task 2.1：`grantPoints` 改寫（TDD）

- [ ] **Step 1（紅）：** 測試 —
  - 家長給 30 → `{familyId}_{childId}` balance=30，pointTransaction.walletId = 確定性 id；
  - `childId != childUserId`（模擬換過 uid）→ 點數進 childId 錢包；
  - **client 傳的 childUserId 不屬該家庭 → permission-denied**（不寫任何錢包）；
  - amount 非整數 / NaN / 0 → invalid-argument；
  - 連續兩次給點 → 各記一筆（家長給點本質非冪等，允許）。
- [ ] **Step 2（綠）：** 權限驗證不變（呼叫者 parent、child 同家庭，membership doc 仍以 uid 為鍵）。錢包目標 = `resolveAuthoritativeChildId(db, familyId, childUserId)` → `resolveChildWallet`。保留 balance clamp ≥ 0 與 delta 邏輯。加 `assertValidPoints`。

### Task 2.2：`onTaskInstanceApproved` 改寫（TDD）

- [ ] **Step 1（紅）：** 測試 —
  - approved instance → 點數進 `{familyId}_{server解析childId}`；
  - **trigger 重放（同 instance 再觸發一次）→ 不 double-award**（tx 內重讀 `pointsAwarded`）；
  - task.points malformed → log + skip（不炸 wallet）。
- [ ] **Step 2（綠）：** `const childId = await resolveAuthoritativeChildId(db, familyId, after.userId)`。**transaction 內**：先 `tx.get(instanceRef)` 重讀確認 `pointsAwarded == null`（idempotency read 在 write 前）→ 再 `resolveChildWallet` → 發點 → 寫**確定性** pointTransaction doc id `task_completion_{instanceId}`（`tx.get` 該 doc，存在則跳過）→ `tx.update(instance, {pointsAwarded})`。

### Task 2.3：`onRewardOrderCreated` 扣點改寫（TDD）

- [ ] **Step 1（紅）：** 測試 — order → 從 `{familyId}_{server解析childId}` 扣點；餘額不足 reject；**重放不 double-deduct**；pointCostSnapshot malformed → reject + log。
- [ ] **Step 2（綠）：** `childId = resolveAuthoritativeChildId(db, familyId, order.userId)` → `resolveChildWallet`。確定性扣款 tx id `reward_order_{orderId}`，tx 內先 `tx.get` 該 tx doc，已存在 → 跳過扣款（idempotent）。

### Task 2.4：`onRewardOrderCancelledOrRejected` 退款改寫（TDD，codex 必修）

- [ ] **Step 1（紅）：** 測試 —
  - 取消/拒絕已扣款訂單 → 退回**原始扣款 transaction 記錄的 `walletId`**（即使該訂單的 childId 之後變了，退款仍回原錢包）；
  - 重放退款 → 不 double-refund；
  - 找不到原始扣款 tx（從沒扣過）→ 不退、log。
- [ ] **Step 2（綠）：** 不重算 childId。查 `pointTransactions where sourceType=='reward_order' and sourceId==orderId` 取 `walletId` → 對該 wallet ref `increment(+cost)`。確定性退款 tx id `reward_refund_{orderId}` 防重放。

**Section 2 驗收：** `cd functions && npm test`（含「四個 CF 都不寫 auto-id 錢包」「idempotency 重放」「malformed/cross-family」）全綠；`npm run build` 乾淨。

---

## Section 3：Client 寫入帶 childId（供歷史歸戶；server 仍會重解析金流）

### Task 3.1：家長建 taskInstance 帶 childId

**Files:** `src/app/parent/(tabs)/tasks.tsx`（line 652、696）、`src/types/models.ts`

- [ ] `TaskInstance` 加 `childId?: string`。
- [ ] `children` state（line 143-162）一併存 `membership.childId ?? membership.userId`。
- [ ] 兩處 `taskInstances.add` 加 `childId`（從 children map 取；fallback assignee userId）。

### Task 3.2：小孩建 rewardOrder 帶 childId

**Files:** `src/app/child/reward/[id].tsx`（line 100）、`src/types/models.ts`

- [ ] `RewardOrder` 加 `childId?: string`；`PointTransaction` 加 `childId?: string`（歷史歸戶）。
- [ ] 用 `resolveMyChildId(uid)` 解析後 `rewardOrders.add({..., childId})`。

---

## Section 4：Client 讀取 — 餘額 + 歷史都改 childId

### Task 4.1：`resolveMyChildId` helper（TDD）

**Files:** Create `src/lib/childId.ts` + test

- [ ] **Step 1（紅）：** `users/{uid}.childId` 有 → 回它；無 → 回 uid。`walletDocId(familyId, childId)` → `${familyId}_${childId}`。**權威優先序（codex）：以 membership 的 `childId` 為準**；本 helper 走 user doc，若未來 user/membership 分歧，membership 勝（在解析點註明，目前兩者由 acceptFamilyInvite 同步寫入故一致）。
- [ ] **Step 2（綠）：** 實作 + session 快取。

### Task 4.2：餘額讀取改 doc-id（4 頁）

**Files:** `child/(tabs)/tasks.tsx`、`me.tsx`、`rewards.tsx`、`task/[id].tsx`

- [ ] 錢包訂閱從 `where('userId','==',uid)` 改 `doc(walletDocId(familyId, childId)).onSnapshot`。錢包不存在防呆 balance=0。

### Task 4.3：歷史查詢改 childId（使用者決策：歷史一起搬）

- [ ] 小孩端任務歷史 / 訂單歷史 / 交易紀錄查詢，從 `where('userId','==',uid)` 改 `where('childId','==',myChildId)`。涉及：`child/(tabs)/tasks.tsx`、`rewards.tsx`、`me.tsx`、`child/order/[id].tsx`（逐一確認 query）。
- [ ] taskInstances / rewardOrders / pointTransactions 既有舊資料無 childId → 過渡期歷史可能缺；本計畫不遷移舊資料（spec 決策），新資料一律帶 childId。
- [ ] 補對應 `firestore.indexes.json` composite index（`childId + familyId` 等）。

### Task 4.4：家長審核頁錢包讀取（codex 漏網）

**Files:** `src/app/parent/(tabs)/review.tsx`（~line 553）

- [ ] `doc(${familyId}_${order.userId})` 改用 `order.childId ?? order.userId` 組 doc id，否則 childId != userId 時餘額顯示錯。

**Section 3+4 驗收：** `npm test`（RN）全綠；`npx tsc --noEmit` 乾淨。

---

## Section 5：資料策略 + 端到端驗證

> spec 決策（line 27/77/122）：現有測試資料**直接清、不遷移**。驗證走「新邀請小孩 → 真 childId → 確定性錢包 + childId 歷史」。

### Task 5.1：舊不相容錢包（housekeeping，可選）

- [ ] dev-family-001 舊 auto-id 散錢包在新 doc-id 讀取下讀不到，屬孤兒，**保留不影響**。不做任何遷移/搬點。

### Task 5.2：端到端驗證（fresh invited child）

- [ ] 用 Plan B 邀請流程註冊全新測試小孩（`ababaplanet@gmail.com`，測完用 Identity Toolkit Admin REST 刪）。確認 acceptFamilyInvite 建 `{familyId}_{newChildId}` balance=0。
- [ ] 家長給點 30 → firebase MCP 查 `{familyId}_{childId}`=30，**沒有第二個錢包**。
- [ ] 指派任務 → 提交 → 核准 → 點數進**同一錢包**（累加）；確認**重複觸發不 double-award**。
- [ ] 兌換 → 同錢包扣；取消 → **退回原扣款錢包**；確認重放不 double。
- [ ] 截圖小孩 me/tasks/rewards 三頁 + 家長 review 頁，餘額**完全一致**。
- [ ] 歷史驗證：小孩 tasks/rewards 歷史清單依 childId 顯示正確。

### Task 5.3：整合驗證

- [ ] `cd functions && npm test && npm run build`、根目錄 `npm test && npx tsc --noEmit` 全綠。
- [ ] commit 分段（helper / 4 CF / client-write / client-read+history / verify）。

---

## Self-review / 風險（v2）

1. **client-written childId 信任**（codex 最重要）：已用「money 路由 server 端重解析（membership 權威）、doc 上 childId 只給歷史讀」分離解決。CF 不依賴 client 寫的 childId 搬錢。
2. **退款帳本權威**：退款查原始扣款 transaction 的 walletId，不重算 childId（codex 必修）。
3. **idempotency**：3 個 trigger（task 發點 / 兌換扣點 / 退款）都用確定性 transaction doc id + tx 內重讀，防重放 double。grantPoints 為 callable、家長給點本質非冪等，不加。
4. **fallback 護欄**：`childId ?? uid` 只容許「欄位不存在」；空字串/非字串/跨家庭一律拋錯（不靜默）。
5. **金額驗證**：amount / points / pointCostSnapshot 走 finite 整數檢查，擋 NaN / 負值。
6. **歷史可見性**：使用者決策「歷史一起搬」→ task/order/transaction 查詢改 childId；舊無 childId 資料不遷移（過渡期舊歷史可能缺，符合 spec 全清決策）。
7. **redeemInvite 牴觸**：已知它仍 userId-based、不寫 childId → 明確 defer Plan D，不在本計畫修。
8. **部署順序**：CF 先 → client 寫 → client 讀，避免舊錢包暫時不可見。
9. **rules**：維持 `pointWallets` read `isSignedIn()`（doc-id 讀已可行）；不收緊（收緊需 get() 算 childId，成本高、且要處理家長讀取）。
10. **確定性 doc id 只組不拆**：避免分隔符歧義。
11. **測試 harness**：v2 Firestore trigger 的 emulator 測試非 trivial；沿用既有 `functions/src/__tests__/setup.ts` 模式，若 trigger 測試卡住，退而用 `firebase-functions-test` 的 wrap() 直接呼叫 handler。

---

## 完成定義（DoD）

- 給點 / 任務發點 / 兌換扣點 / 退款 **全部進同一個 `{familyId}_{childId}` 錢包**；退款回原扣款錢包。
- 小孩 me/tasks/rewards/task 詳情 + 家長 review 各頁餘額**一致**。
- 任務/兌換歷史依 childId 正確歸戶。
- **四個 CF 都不寫 auto-id 錢包**（測試斷言）；trigger 重放不 double。
- money 路由不信任 client childId；malformed/cross-family childId 被拒。
- functions + RN 測試雙綠、tsc 乾淨；E2E（fresh invited child）截圖佐證。
