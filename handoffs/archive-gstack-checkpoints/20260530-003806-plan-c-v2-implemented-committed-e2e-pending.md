---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-30T00:38:06+0800
files_modified:
  - functions/src/lib/resolveChildWallet.ts (new)
  - functions/src/lib/points.ts (new)
  - functions/src/grantPoints.ts
  - functions/src/onTaskInstanceApproved.ts
  - functions/src/onRewardOrderCreated.ts
  - functions/src/onRewardOrderCancelledOrRejected.ts
  - functions/src/lib/__tests__/resolveChildWallet.test.ts (new)
  - functions/src/__tests__/grantPoints.test.ts (new)
  - functions/src/__tests__/onTaskInstanceApproved.test.ts (new)
  - functions/src/__tests__/onRewardOrder.test.ts (new)
  - src/types/models.ts
  - src/lib/childId.ts (new)
  - src/lib/__tests__/childId.test.ts (new)
  - src/app/parent/(tabs)/tasks.tsx
  - src/app/parent/(tabs)/review.tsx
  - src/app/child/(tabs)/me.tsx
  - src/app/child/(tabs)/tasks.tsx
  - src/app/child/(tabs)/rewards.tsx
  - src/app/child/(tabs)/notif.tsx
  - src/app/child/reward/[id].tsx
  - src/app/child/task/[id].tsx
  - firestore.indexes.json
---

## Working on: Plan C v2 程式碼實作完成 + 已 commit（3 段），剩真機 E2E（需先部署）

### Summary

Plan C v2（childId 點數重構）**程式碼 Section 1-4 全部實作完成、測試全綠、已分 3 段 commit**（未 push）。
HEAD `0d06d7d`。剩 **Section 5 真機 E2E**（要先部署 4 個改過的 CF + index 到正式 Firebase，再用全新邀請小孩跑完整金流驗證）。使用者決策：本 session 先 commit 存檔，E2E 下次再跑。

### Decisions Made

- **核心架構**：點數釘永久 childId，金流一律進 `pointWallets/{familyId}_{childId}`。解析規則 `childId = membership.childId ?? uid`（fallback 只容許舊帳號沒 childId 欄位；空字串/非字串/跨家庭拋錯）。
- **codex 必修全做**：(1) money 路由 server 端用 `resolveAuthoritativeChildId` 重解析、不信任 client 寫的 childId；(2) 退款退回原始扣款 transaction 的 walletId（不重算）；(3) 確定性 transaction doc id 防重放（`task_completion_{id}` / `reward_order_{id}` / `reward_refund_{id}`）；(4) 金額 finite 整數驗證；(5) parent review.tsx 錢包讀取也改 childId。
- **使用者決策：歷史一起搬** → taskInstances/rewardOrders 寫入帶 childId；child me/tasks/rewards/notif 的歷史查詢改 `where childId`。
- **redeemInvite.ts 留給 Plan D**（仍 userId-based、未改，刻意）。
- **client helper `src/lib/childId.ts`**：`walletDocId`（只組不拆）、`childIdFor(user, uid)`（有 user 的頁用）、`resolveMyChildId(uid)`（只有 uid 的頁，async 讀 users doc — task/[id].tsx、notif.tsx 用）。
- **錢包讀取改確定性 doc-id `.doc(walletDocId).onSnapshot`**（取代 where userId query，省 index、單 doc listener）。RNFB v24 用 `doc.exists()` 是 method（沿用 useAuth.ts 慣例）。

### Remaining Work

按優先序：

1. **部署到正式 Firebase**（Section 5 前置，money code，**對外動作需使用者確認**）：
   - `cd functions && npm run deploy`（或 `firebase deploy --only functions`）部署 4 個改過的 CF
   - `firebase deploy --only firestore:indexes` 部署新增的 `taskInstances childId+status` index
   - **部署順序**：CF 先（含 fallback、不破壞舊資料）→ client 已含 childId 寫入（已在 build 內）
2. **Section 5 真機 E2E**（iOS 模擬器 + Maestro 座標方案，見 [[maestro-newarch-no-hierarchy]]）：
   - 用 Plan B 邀請流程註冊全新測試小孩（`ababaplanet@gmail.com`，測完用 Identity Toolkit Admin REST 刪）
   - 家長給點 30 → MCP 查 `{familyId}_{childId}`=30、無第二錢包
   - 任務發點（核准）→ 同錢包累加、重複觸發不 double
   - 兌換扣點 → 取消退款回原錢包
   - 截圖小孩 me/tasks/rewards + 家長 review 餘額一致；歷史依 childId 正確
3. **Plan D**：dev 真帳號 seed + 移除匿名捷徑 + redeemInvite.ts childId 化。
4. Resend 自有寄件網域驗證（上線需要）。

### Notes

- **git**：本 session 3 個 commit（`a587ed8` functions、`3a2a62e` client、`0d06d7d` plan doc），HEAD `0d06d7d`，**未 push**（push 走使用者 `! git push`，見 [[repo-branch-structure]]）。`.maestro/` 與舊 handoffs 刻意未 commit。
- **測試現況**：functions 44/44 綠（`cd functions && npm test`）、RN 13/13 綠（`npm test`）、tsc 雙乾淨。emulator 不強制 index，真機才需部署 index。
- **舊資料**：dev-family-001 舊 auto-id 散錢包在新 doc-id 讀取下讀不到（spec 決定不遷移）。現登入 dev QQ(`EPXQAVro`) 沒 childId 欄位 → fallback 用 uid，但它的 30 點在 auto-id 錢包 `tH0q6…`，新讀取讀不到 → 會顯示 0。所以 E2E 必須用**全新邀請小孩**驗證，不要用舊 dev QQ。
- **Plan C v2 權威文件**：`docs/superpowers/plans/2026-05-26-real-user-accounts-plan-c.md`。
- **codex consult session**：`.context/codex-session-id` = `019e72b1-7198-7261-9163-80ead6cdc39f`。
- 相關記憶：[[points-identity-fragmentation]]、[[maestro-newarch-no-hierarchy]]、[[repo-branch-structure]]。
