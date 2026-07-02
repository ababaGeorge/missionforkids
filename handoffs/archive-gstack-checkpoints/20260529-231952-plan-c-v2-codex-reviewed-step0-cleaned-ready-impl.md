---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-29T23:19:52+0800
files_modified:
  - docs/superpowers/plans/2026-05-26-real-user-accounts-plan-c.md (新增，未追蹤)
  - .context/codex-session-id (新增，codex consult session)
  - (Firestore 資料變更：8 筆 familyMemberships 改 removed — 非 git 檔案)
---

## Working on: Plan C v2 定案（codex 審過）+ Step 0 清髒資料完成，待實作 childId 點數重構

### Summary

本 session 做了三件事：(1) **Plan C Step 0 清 dev-family-001 髒資料**已完成；(2) **撰寫 Plan C 計畫文件**（childId 點數重構）；(3) **codex consult 審查** → 抓到多個安全/正確性洞 → 改寫成 **Plan C v2**。Plan C v2 已定案，**尚未寫任何 code**，下一步是實作。HEAD 仍 `ba0f0de`（本 session 沒 commit），git 乾淨（只有未追蹤的 plan 檔 + .maestro + 舊 handoffs）。

### Decisions Made

- **Step 0 清理範圍：7 個多餘 QQ + 1 個孤兒 membership 共 8 筆改 `status: removed`**。dev-family-001 現剩 2 個 active child：QQ(`EPXQAVroCrUwQWX5b880vzSsABt1`, canonical, 錢包30) + RR(`giVFzmh1fy1WfDDgtF7e`, 錢包10)。孤兒 `sWGqOa6r5fTioTBRszQ6SeZJERw1`（無 user doc/無錢包/無暱稱）也清掉。家長 chip 列下次開會從 10 變 2。只改 status、可逆。
- **Plan C 推進方式：先寫計畫文件 → codex 審 → 實作**（使用者選的，照 Plan A/B 慣例）。
- **資料策略以 spec 為準：不遷移、不搬點，全清 + 走新邀請小孩驗證**（design spec line 27/77/122）。舊 dev QQ 的 30 點在 auto-id 錢包，新 doc-id 讀取讀不到 → 視覺上「消失」是預期行為。
- **Plan C 發現：childId 重構的 code 還沒實作**。acceptFamilyInvite 已建確定性錢包 `{familyId}_{childId}`（Plan B 做的），但 grantPoints / onTaskInstanceApproved / onRewardOrderCreated / 退款 4 個 CF + client 寫入/讀取全是舊 `where userId==X` 模型。
- **codex 審後 v2 必修（已寫進計畫）：** (1) **money 路由 server 端重解析 childId、不信任 client 寫的欄位**（最重要安全洞）；(2) **退款退回原始扣款 transaction 的 walletId、不重算**；(3) grantPoints 驗證 childId 屬該家庭；(4) 3 個 trigger 加確定性 transaction doc id 防重放 double；(5) 金額欄位 finite/非負驗證；(6) parent review.tsx 漏網的錢包讀取；(7) 測試斷言「四個 CF 都不寫 auto-id 錢包」+ malformed/cross-family childId 案例。
- **使用者兩個範圍決策：** ① **歷史一起搬**（task/order/transaction 查詢也改 childId，不只錢包）；② **redeemInvite.ts 留給 Plan D**（它還用 userId 遷移、不寫 childId，牴觸架構，但範圍外）。
- **`childId ?? uid` fallback 護欄**：只容許「欄位不存在」（舊帳號）；空字串/非字串/跨家庭一律拋錯，不靜默。
- **部署順序：CF 先 → client 寫 → client 讀**，避免舊錢包暫時不可見。

### Remaining Work

按優先序：

1. **實作 Plan C v2**（權威文件：`docs/superpowers/plans/2026-05-26-real-user-accounts-plan-c.md`）。約 13 檔、5 段 TDD：
   - Section 1：`functions/src/lib/resolveChildWallet.ts` + `resolveAuthoritativeChildId`（server 共用 helper）
   - Section 2：改寫 4 個 CF（grantPoints / onTaskInstanceApproved / onRewardOrderCreated / onRewardOrderCancelledOrRejected）— server 重解析 + idempotency + 金額驗證
   - Section 3：client 寫入帶 childId（parent tasks.tsx line 652/696、child reward/[id].tsx line 100）+ models.ts 加欄位
   - Section 4：client 讀取改 doc-id + 歷史查詢改 childId（child tasks/me/rewards/task + order/[id]）+ parent review.tsx ~line 553 + 補 firestore.indexes.json
   - Section 5：端到端驗證（用 Plan B 邀請流程開全新測試小孩 `ababaplanet@gmail.com`，跑給點/任務/兌換/退款，截圖各頁餘額一致；測完用 Identity Toolkit Admin REST 刪帳號）
2. **Plan D**：dev 真帳號 seed + 移除匿名捷徑 + redeemInvite.ts childId 化（從源頭防散）。
3. **Resend 驗證自有寄件網域**（上線需要）。
4. **cleanup policy**：`firebase functions:artifacts:setpolicy`。

### Notes

- **git**：HEAD `ba0f0de`，本 session 零 commit。Plan C 檔未追蹤，要 commit 再 add。`origin/feat/real-user-accounts` 同步。
- **codex session**：`.context/codex-session-id` = `019e72b1-7198-7261-9163-80ead6cdc39f`，要追問 codex 可 `/codex` 續這個 session。
- **codex 誤報**：審查結尾 `[codex auth error]` 是 Vercel/GitHub MCP server 沒登入的雜訊被關鍵字比對到，**codex 本身跑完整、findings 完整**（674k tokens）。
- **背景 Metro** 可能還在跑（上個 session 的 `bf3xwwg06`），不需要 `kill $(lsof -ti :8081)`。
- **gstack 有更新**可裝（1.40→1.52），要的話 `/gstack-upgrade`。
- **實作前置**：本計畫屬 bugfix/重構範圍，pre-implementation 的 tech-spec/compat-report 規則不強制（已有 design spec）。
- 相關記憶：[[points-identity-fragmentation]]、[[maestro-newarch-no-hierarchy]]、[[repo-branch-structure]]。E2E 注意新架構 Maestro 看不到 RN 畫面，用座標+截圖+firebase MCP 驗證。
- **錢包讀取現況實證**（修 Section 4 用）：child 各頁都 `where('userId','==',uid)`；parent review.tsx 用 `doc(${familyId}_${order.userId})`。
