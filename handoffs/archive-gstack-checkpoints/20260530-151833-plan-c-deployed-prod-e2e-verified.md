---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-30T15:18:33+0800
files_modified:
  - (本 session 後段無 code 變更；Plan C v2 程式碼已於前一 checkpoint commit+push)
---

## Working on: Plan C v2 已部署正式環境 + 正式 Firebase E2E 驗證通過（三個 trigger 全綠）

### Summary

Plan C v2（childId 點數重構）**已完成、commit、push、部署正式環境、並在正式 Firebase 跑 E2E 驗證通過**。
HEAD `0d06d7d`（已 push，origin 同步）。4 個 CF + firestore index 已部署。長期「點數不同步」bug 的根因修復確認在正式環境生效。

### Decisions Made

- **部署範圍**：只部署 4 個改過的 CF（grantPoints / onTaskInstanceApproved / onRewardOrderCreated / onRewardOrderCancelledOrRejected）+ firestore:indexes，全部「Successful update operation」。部署尾端 cleanup-policy Error 是非致命警告（artifacts 月費，待辦）。
- **E2E 方式（重要）**：因小孩登入現需 email 真帳號（舊匿名 QQ/RR 登不進、舊點數在 auto-id 錢包讀不到），改用 **firebase MCP 直接對正式 Firestore 寫測試資料、觸發實際部署的 trigger、MCP 查後端錢包** 來驗證。比走完整 email 邀請 UI 流程快且高信度（測的是真部署的 code）。grantPoints 是 callable（需 auth token），邏輯同源 + 已單元測，未跑 MCP E2E。
- **App 視覺確認**：家長任務頁截圖確認 chip 列已是乾淨「QQ + RR」（Step 0 清理生效）。

### E2E 驗證結果（正式環境，已清測試資料）

測試 child membership `e2etest`（childId=`e2e-child-001`），taskInstance/order 故意寫**錯**的 client childId（`CLIENT-WRONG-evil`）：
1. **onTaskInstanceApproved**：approve 25 點 task → 錢包 `dev-family-001_e2e-child-001`=25；`dev-family-001_CLIENT-WRONG-evil` **不存在**（server 忽略 client 亂寫的 childId ✅ 安全洞修復生效）；instance.pointsAwarded=25。
2. **onRewardOrderCreated**：10 點訂單 → 錢包 25→**15**；扣款 tx `reward_order_e2e-order-001` walletId=`dev-family-001_e2e-child-001`（server 解析，非訂單上的錯 childId）。
3. **onRewardOrderCancelledOrRejected**：取消 → 錢包 15→**25**；退款 tx `reward_refund_e2e-order-001` 退回**原扣款 walletId**（帳本權威，非訂單錯 childId）。
全程：25→15→25，同一確定性錢包、零碎片。測試 8 個 doc 已全刪，dev-family-001 回 QQ+RR 乾淨狀態。

### Remaining Work

1. **（選用）完整 App 視覺 E2E**：用全新 email 邀請小孩（Resend→收信→deep link→註冊）跑一遍，截圖 child 端 me/tasks/rewards 餘額一致。後端已驗證，這步純 UI 層補強。注意新架構 Maestro 限制（[[maestro-newarch-no-hierarchy]]）。
2. **Plan D**：dev 真帳號 seed + 移除匿名 dev 捷徑 + `redeemInvite.ts` childId 化（仍 userId-based，牴觸架構）。
3. **cleanup policy**：`firebase functions:artifacts:setpolicy`（消部署警告）。
4. **Resend 自有寄件網域**（上線需要）。
5. **PR**：feat/real-user-accounts → main（Plan A/B/C 都完成後，可考慮開 PR；或繼續累積 Plan D）。

### Notes

- **git**：HEAD `0d06d7d`，已 push，origin 同步。3 個 commit（`a587ed8`/`3a2a62e`/`0d06d7d`）。
- **背景 Metro**：本 session 啟了 Metro（bg id `bdjwusnj5`，:8081）跑模擬器 App。不需要 `kill $(lsof -ti :8081)`。模擬器 iPhone 17 Pro（B4436202-581F-4922-8D3A-B2CAA91273DE）App 已裝、在跑。
- **測試現況**：functions 44/44、RN 13/13、tsc 雙乾淨。
- **舊資料提醒**：dev QQ(`EPXQAVro`)/RR(`giVFzmh1`) 是舊匿名帳號、無 childId 欄位、點數在 auto-id 錢包，新 doc-id 讀取顯示 0（spec 決定不遷移，預期）。要驗證 App child 端必須用全新邀請小孩。
- Plan C v2 權威文件：`docs/superpowers/plans/2026-05-26-real-user-accounts-plan-c.md`。codex session：`019e72b1-7198-7261-9163-80ead6cdc39f`。
- 相關記憶：[[points-identity-fragmentation]]（根因已修，可考慮更新該記憶）、[[maestro-newarch-no-hierarchy]]、[[repo-branch-structure]]。
