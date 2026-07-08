---
status: completed
branch: main
head: 150f050
timestamp: 2026-07-09T01:59:14+0800
continues_from: 20260706-123906-security-deploy-a7-rotation-cleanup-cowork-test-docs.md
files_modified:
  - docs/testing/results/2026-07-08-test-run-02.md（新增，Run 02 回測報告）
  - docs/testing/2026-07-06-ux-recommendations.md（補回測追蹤＋分診更正）
  - firestore.rules / 9 個 functions（部署 prod，本 session 未改碼）
---

## Working on: 改善輪 R1 全程收尾——Run 02 回測通過 → PR #9 merge → 部署 prod 驗證生效

### Summary
接續 R1 程式碼完成後的上線路徑。解除 Run 02 環境阻斷（Metro 未啟動，使用者 `!` 起起來後 App 自動連上）→ Cowork 代理跑完 Run 02：**P1–P8 全數實測通過**，核心閉環端到端跑通、點數帳三處一致（58→28→38）。測試產出 commit 進分支 → PR #9 以 `--merge` 併入 main（`150f050`）→ `firebase deploy --only functions,firestore:rules` 成功 → **Firebase MCP 重讀 prod rules 確認 P8 快照釘欄位三道防線生效**。R1 一輪完整收尾，剩兩個補驗與 R2 候選池。

### Decisions Made
- **dev 測試密碼風險接受、議題結案（使用者定案 2026-07-09）**：洩漏不用管、不重輪、不再提醒、不為此中斷進度。已寫入專案 memory（dev-password-risk-accepted.md）——未來 session 不要再翻出來。
- **Run 02 報告的「邀請入口不存在」判定為誤報**：程式碼查證入口存在＝family 頁右下「+」FAB（`src/app/parent/(tabs)/family.tsx:382`，無顯示條件，開「用 Email 邀請小孩」modal）。測試代理沒找到 → 降為可發現性 UX 問題列 R2。已在 ux-recommendations 文件加分診更正註記，避免誤報被當事實引用。
- **P9 受邀情境不擋 merge**：修復本身一行（改傳 membership.userId）、已過逐項審查；發點核心機制 Run 02 實測正常；受邀路徑需 Resend 寄信＋新帳號，本來就適合部署後真流程補驗。
- **merge 用 `--merge` 保留完整歷史**（非 squash）：R1 每項修復是獨立 commit 可單獨 revert 的設計，保留這個回退能力。
- **U6（扣點 clamp 提示顯示請求值）不在 P1–P9 範圍**，列 R2 首位候選（DEFECT-R2-01）。

### Remaining Work / Next Steps
1. **P8 快照正路徑補驗**：部署後在 App 下一筆新兌換訂單 → 用 Firebase MCP 查該 rewardOrders doc 應含 `balanceBeforeSnapshot`/`balanceAfterSnapshot`（CF 寫入的 server 權威值）。
2. **P9 受邀小孩發點補驗**：family 頁「+」FAB 發真邀請 → 受邀小孩註冊 → 對其發點，確認不再報「不是家庭成員」（Run 01 重點②的最終驗證）。
3. **R2 待辦池**（下次開發輪的輸入）：U6 提示文案、邀請入口可發現性（「+」加文字）、種子殘影清理（「整理房間」多 instance 舊資料）、高成本補測（C4 退回3次→錯過、通知>20、A9–A11 完整註冊送出）、`.superpowers/sdd/progress.md` 的 Minor 清單、PR #8 其餘資料完整性修復（fix-plan §6）。
4. **產品方向選擇（開著）**：B2 推播 / B3 週期任務 / B4 OAuth，三份 scoping 見 07-06 checkpoint。
5. 舊開著的線：`demo/current-snapshot` worktree 去留、Resend 自有寄件網域（上線前 🔴）。
6. 背景 Metro（task bi0ry9i7e、:8081）還開著，不用可 `kill $(lsof -ti :8081)`。

### Notes / Gotchas
- Run 02 測試代理（cowork）的環境限制：shell 是隔離 Linux sandbox 起不了 Mac 的 Metro；模擬器選單列點不到（關硬體鍵盤要人手動）；建帳號屬其護欄禁區（所以註冊只驗到表單層）。
- 模擬器現用 iPhone 17 Pro（非 kickoff 文件那台 iPhone 17）。
- deploy 時 firebase-functions 版本過舊警告＝🟢 純雜訊（v6 部署正常，升級有 breaking changes，不動）。
- RNFirebase v22 棄用 WARN 洗 Metro log＝🟢 雜訊。

### Branch / PR / Commits
- 本線 `main` @ `150f050`（= origin/main），worktree clean。
- PR #9（fix/cowork-round1 → main）已 merge（--merge），分支已刪（本地＋遠端）。
- 本 session 唯一新 commit：`aea37b1`（Run 02 報告＋ux-recommendations 更新＋分診更正）。
- R1 全部內容：13 commits（P1–P9 各自獨立）＋ 1 docs commit，經 PR #9 進 main。

### Validation
- **Run 02 實測（Cowork 代理）**：P1–P8 全過；補測 E3/E4/E5/④/⑧/C3/B1 過；點數帳目全對。報告 `docs/testing/results/2026-07-08-test-run-02.md`。
- **prod 部署驗證**：deploy 成功（rules released＋9 functions 全更新）；Firebase MCP 重讀 prod firestore rules＝加固版含 P8 快照釘欄位（create `hasAny` 禁預埋＋家長/小孩 update `diff()` 擋竄改）✓。
- 本 session 無程式碼變更（僅 docs），未重跑本地測試套件；R1 閘門（tsc 0、App 13/13、functions 59/59）在 merge 前的分支上已全綠。
- **未跑**：P8 快照正路徑、P9 受邀情境（見 Remaining Work 1–2）。

### Data Safety
- prod 部署皆預期內（rules＋functions），未動 prod 使用者資料。
- Run 02 測試只在 `dev-family-seed` 測試家庭內操作，點數操作全走 App 正常流程（CF）。
- 本 session 的 repo 變更只有 docs。

### Manual Acceptance Checklist
1. App 下一筆兌換訂單 → 審核 sheet 顯示「兌換前→兌換後」餘額（來自 CF 快照，非 fallback 回推）。
2. 家長 family 頁右下「+」→ email 邀請 → 小孩註冊加入 → 對該小孩發點成功。

### Rollback / Do-Not-Do
- R1 各修復 commit 獨立，可單獨 `git revert`；rules 可從 git 歷史取前版重部署。
- **不要**再提 dev 測試密碼的洩漏／重輪議題（使用者已結案）。
- **不要**刪 core_loop 4 條備份線、不要強刪 `demo/current-snapshot` worktree。

### Remaining Confirmations
- 下一個產品方向：B2 推播 / B3 週期任務 / B4 OAuth？
- `demo/current-snapshot` worktree 去留？
- R2 什麼時候開（待辦池已備好）？
