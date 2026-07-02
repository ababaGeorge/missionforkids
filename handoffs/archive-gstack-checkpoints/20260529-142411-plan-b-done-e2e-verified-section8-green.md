---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-29T14:24:11+08:00
files_modified:
  - (本 session code 零變更；工作區只有 4 個未追蹤 handoffs/*.md 與 .maestro/ 目錄 — 都刻意不動)
---

## Working on: Plan B 邀請功能 100% 完工 + E2E 全綠 + Section 8 驗證通過

### Summary

Plan B（家長 email 邀請小孩 + 接受畫面）**從 Section 1 到 8 全部完成**。本 session 做完了：
(1) iOS 模擬器 + Maestro 全自動 E2E 跑通完整邀請流程，
(2) Section 8 整合驗證（functions 17 / RN 8 / tsc 雙乾淨）全綠，
(3) 測試資料完整清除（3 個 Firestore docs + ababaplanet@gmail.com auth user），
(4) /investigate 釐清家長任務頁 QQ chip 重複的根因（非回歸，是 5/25 就標記未清的髒資料）。
HEAD `ba0f0de`，已 push（ahead=0 behind=0），git 乾淨。

### Decisions Made

- **E2E 用座標點擊 + 原生 alert 文字 + 截圖 + 後端 MCP 驗證**：因發現 missionforkids 開了 `newArchEnabled: true`（RN Fabric），Maestro/XCUITest 完全看不到 RN 的 view hierarchy（連 testID 都不可見），只看得到原生 UIAlertController。所以上次 checkpoint 「testID 都埋好給 Maestro」的前提錯了 — 走座標方案才跑得通。已寫進記憶 `maestro-newarch-no-hierarchy.md`，下次寫 iOS E2E 不會再踩。
- **`hideKeyboard` 在 iOS Maestro 不可靠**，改用 `pressKey: Enter`（單行 TextInput blurOnSubmit 預設 true，按 return 會收鍵盤）。
- **`assertVisible: { timeout }` 在 Maestro 2.6.0 不支援**（"Unknown Property: timeout"），等候要用 `extendedWaitUntil`。
- **測試小孩用 `ababaplanet@gmail.com`**（因 Resend sandbox 寄件人 `onboarding@resend.dev` 只能寄到 Resend 帳號本人 email），測完用 Identity Toolkit Admin REST API 刪掉避免日後撞 `email-already-in-use` 或跟 Google 登入混淆。
- **QQ chip 重複是 Plan C 範圍，不是 Plan B Section 7/8**：Plan B 文件 self-review 明文（line 1340）「清資料 → Plan C/D，不在 B」。使用者決策：先完成 Section 8，QQ chip 延後到 Plan C Step 0。
- **`ac113ec`（5/14）那個「清 stale dev memberships」的修法條件是 `isDev:true OR displayName in (Dev Parent, Dev Child)`**，QQ 成員 displayName 不是 Dev Child（是 nickname="QQ"），所以 ac113ec 從沒處理過 QQ — 不是回歸，是從沒修。

### Remaining Work

按優先序：

1. **Plan C Step 0：清 dev-family-001 髒資料**（5 分鐘，Firestore MCP）：把 8 個 nickname=QQ 的 active membership 留 1 個 canonical（建議留 `EPXQAVroCrUwQWX5b880vzSsABt1` — 是現登入 dev parent 用的）、其他 7 個 status 改 `removed`。chip 列立即從 8 個 QQ 變回 1 個。
2. **Plan C 主體：childId 點數重構**（修 [[points-identity-fragmentation]]）：選 canonical childId、把 taskInstances / pointWallets / grantHistory / memberships 全部統一到它、舊的 mark removed。錢包 fragmentation 也一起解。估 1-2 小時。
3. **Plan D：dev 真帳號 + 移除 Beta 測試帳號區**：從源頭避免 anonymous uid 再累積（解 root cause 防未來再髒）。
4. **Resend 驗證自有寄件網域**：解開 sandbox 只能寄 ababaplanet 自己的限制，讓正式 user 用任意小孩 email 都能寄到（產品上線需要）。
5. **cleanup policy**：`firebase functions:artifacts:setpolicy` 處理部署的非致命警告，避免舊 container image 累積月費。

### Notes

- **git 狀態**：HEAD `ba0f0de` = 上個 session 最後一個 commit，本 session 沒寫任何 code（除了 `.maestro/` 下的 flow yaml 與 screenshots，刻意不追蹤）。`origin/feat/real-user-accounts` 同步（0/0）。
- **`.maestro/` 目錄狀態**：本 session 新建未追蹤，內含 1 個 flow yaml（`01-parent-invite.yaml` 的 testID 版本 — 因新架構問題不實際可用）、`_tap.yaml` `_dismiss.yaml` 工作區暫存、`screens/` 8 張 E2E 過程截圖。要保留或刪都行，不影響專案。
- **背景 Metro**：bash bg id `bf3xwwg06` 還在跑（重啟模擬器後重啟的那個）。不需要的話 `kill $(lsof -ti :8081)` 一行解決。
- **Memory 新增**：`maestro-newarch-no-hierarchy.md` 已寫入 `~/.claude/projects/.../memory/` 並更新 `MEMORY.md` 索引。下次 session start 會看到。
- **權威文件**：Plan B = `docs/superpowers/plans/2026-05-26-real-user-accounts-plan-b.md`（整份已完成）。
- **新測試帳號 cleanup 痕跡**：執行了 Firebase Identity Toolkit Admin REST API（`accounts:batchDelete`）刪 password user。要寫 admin script 操作 auth 可走這條：`gcloud auth print-access-token` + `X-Goog-User-Project: mission-for-kids` header。比起裝 firebase-admin + ADC 更輕。
- **不是回歸 vs 是新 bug**：使用者一度認為 QQ chip 是回歸（「上次不是修過了」），實際 5/25 checkpoint 就標記「8 個 active QQ membership 應剩 1，需清理腳本」並 defer，後續 3 個 session 都在做 Plan B、沒回頭。所以下次接續時這是 known-deferred 不是新發現。
- 相關記憶：[[points-identity-fragmentation]]、[[maestro-newarch-no-hierarchy]]、[[repo-branch-structure]]。
- 前一個 checkpoint `20260527-180004-invite-deployed-e2e-handoff-maestro.md` 是部署完待 E2E 狀態，**本檔較新**（E2E 已完成 + Section 8 已綠）。
