---
status: in-progress
branch: main
timestamp: 2026-06-02T14:45:56+0800
files_modified: []
---

## Working on: PR #5 merged — 真帳號工程全數落地 main + 模擬器測試中

### Summary
本 session 從 `/context-restore` 接續「Plan D 已上線、PR #5 待 merge」，跑 `/land-and-deploy` 把 PR #5（feat/real-user-accounts → main）合進主幹。merge 前重跑測試全綠、Firebase MCP 確認 prod 後端狀態，用 **merge commit**（保留 Plan A/B/C/D 完整歷史）合併。真帳號工程（email 真帳號取代全匿名）整條落地完成。目前模擬器已開、App 跑起來，使用者正在手動測試。

### Decisions Made
- **合併方式：merge commit（非 squash）** — 使用者選擇保留 Plan A/B/C/D 每一步開發歷史進 main。merge commit `93a2575`，feat 分支已刪（GitHub + 本地）。
- **「部署驗證」= 確認後端活著且正確，非觸發新部署** — 這是 Expo/RN 手機 App，merge 進 main 不觸發任何自動部署；Firebase functions + rules 上個 session 已手動部署上線。本次用 Firebase MCP 即時查 prod = 9 functions（含 bootstrapParentAccount，無 redeemInvite / bootstrapDevSession）+ rules 已部署，確認無誤。
- **Vercel 綠燈不當產品 canary** — 那是 Expo-web 預覽，真正出貨是 iOS/EAS build，無 web 線上 URL 可驗。

### Remaining Work
1. 🟢 **使用者正在模擬器手動測試**（iPhone 17 Pro，sim id `B4436202-581F-4922-8D3A-B2CAA91273DE`）。等測試回饋，有 bug 再修。
2. 🔴 **真實用戶開放前必做**：Resend 設定自有寄件網域（目前 sandbox `onboarding@resend.dev`）。
3. 🟢 codex #1：email 寄送失敗（Resend 故障）家長無重寄路徑 → 併入未來 email 邀請擴充。
4. 🟢 codex #3：`cleanup-anon-dev-data.ts` 全域刪匿名 Auth，重用前加 dev-family scope 防呆。
5. 🟢 prod 殘留 2 個 rejected 訂單 doc（`rewardOrders/dev-order-ice-dev-kid1/kid2`）— classifier 擋了刪除，純雜訊。
6. 未來：email 邀請擴充補 co-parent + email 重寄。

### Notes
- **git HEAD** `93a2575`（main，origin 同步 0/0，tree 乾淨）。工作分支現為 `main`（不再是 feat/real-user-accounts，已刪）。
- **測試現況**：RN 13/13、functions 51/51（emulator），merge 前剛重跑全綠。
- **模擬器**：iPhone 17 Pro 已 boot，App（com.missionforkids.app dev build）已裝、已連 Metro :8081（背景 task `bwg8r8chb`）。RNFirebase v22 namespaced API 棄用 WARN 是雜訊，非 bug。
- **seed 帳號**：dev-parent@mfk.test / dev-kid1@mfk.test / dev-kid2@mfk.test，密碼 `mfk-dev-2026!`，familyId `dev-family-seed`。sign-in 有 __DEV__ 自動填入鈕（家長/小安/小宇）。
- **報告**：`.gstack/deploy-reports/2026-06-02-pr5-deploy.md`。全局抓宏觀讀 memory `project-decision-log.md`（已更新標記落地完成）。
- 相關記憶：[[points-identity-fragmentation]]、[[maestro-newarch-no-hierarchy]]、[[repo-branch-structure]]。
