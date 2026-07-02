---
status: completed
branch: feat/real-user-accounts
timestamp: 2026-06-02T03:25:10+0800
files_modified: []
---

## Working on: Plan D 全數完成 + 上線（push + PR #5 + 部署）+ codex 審查

### Summary
真帳號工程 Plan D v2（移除匿名 dev 捷徑 + 全收舊邀請碼 + 真帳號 seed + 清 prod 匿名資料）本 session 從頭做到上線：5 段 Section 全做完、codex 獨立審查 gate PASS、push + 開 PR #5 + 部署 functions/rules 到正式環境。Plan A/B/C/D 全部上線。git 乾淨（tracked 全 commit + push，origin 同步）。

### Decisions Made
- **S2 驗證範圍（使用者定）**：採「登入+渲染證明」，不在脆弱盲點座標 E2E 重跑給點/核准/兌換（已被 51 functions 測試 + Plan C 正式 E2E 覆蓋）。
- **seed 認證**：gcloud ADC（非 service account key）。跑 TS 腳本用 `node --experimental-strip-types`，firebase-admin(CJS) 用 `createRequire` 載入。root tsconfig 加 `exclude:[functions]`。
- **seed 用全新 familyId `dev-family-seed`**（與舊髒 dev-family-001 隔離），穩定 UID dev-parent/dev-kid1/dev-kid2。
- **清舊資料用明確標記法**（authProvider==anonymous / familyId==dev-family-001），不靠 display-name（codex #12）。連舊「Roy」也是匿名，已清。
- **codex 審查 gate PASS**：3×P2 advisory。#2(seed 訂單被 onRewardOrderCreated 退) 已修 commit；#1(email 失敗無重寄)、#3(cleanup scope 過廣) 使用者決定先記錄待處理。
- **部署**：push → PR #5(feat→main, OPEN) → functions 部署(刪 redeemInvite + 早期孤兒 bootstrapDevSession、新建 bootstrapParentAccount、共 9 個)→ rules 部署(移除 inviteCodes)。皆 MCP/live 驗證。

### Remaining Work
1. 🟡 **PR #5 待 merge**（feat/real-user-accounts → main，A/B/C/D 收齊）— 使用者決定何時 merge。
2. 🟢 codex #1：email 寄送失敗（Resend 故障）家長無重寄路徑 → 併入未來 email 邀請擴充。
3. 🟢 codex #3：`cleanup-anon-dev-data.ts` 全域刪匿名 Auth，重用前加 dev-family scope 防呆。
4. 🟢 prod 殘留 2 個 rejected 訂單 doc（`rewardOrders/dev-order-ice-dev-kid1/kid2`）— classifier 擋了刪除（只授權 review），要清需另外授權。純雜訊。
5. 🔴 上線給真實用戶前：Resend 自有寄件網域。
6. 未來：email 邀請擴充補 co-parent。

### Notes
- **git HEAD** `367175d`（已 push，origin 同步 0/0）。`.maestro/` + 舊 handoffs 仍刻意未追蹤。
- **測試現況**：functions 51/51（含新 seed-shapes 7 個）、RN 13/13、root + functions tsc 乾淨、firestore.rules MCP 驗證 OK。
- **背景 Metro**（:8081）還開著、模擬器登著 seed 家長。不需要可 `kill $(lsof -ti :8081)`。
- **seed 帳號**：dev-parent@mfk.test / dev-kid1@mfk.test / dev-kid2@mfk.test，密碼 `mfk-dev-2026!`，familyId `dev-family-seed`。sign-in 有 __DEV__ 自動填入鈕（家長/小安/小宇）。
- **權威文件** `docs/superpowers/plans/2026-05-30-real-user-accounts-plan-d.md`（含 Codex 審查發現 + GSTACK REVIEW REPORT + 部署狀態）。全局抓宏觀讀 memory `project-decision-log.md`。
- 相關記憶：[[points-identity-fragmentation]]（根因已修）、[[maestro-newarch-no-hierarchy]]（新架構盲點座標）、[[repo-branch-structure]]。
