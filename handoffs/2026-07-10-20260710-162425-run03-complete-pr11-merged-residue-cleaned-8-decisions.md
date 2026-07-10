---
status: completed
branch: main
head: "46ee10d"
timestamp: 2026-07-10T16:24:25+0800
continues_from: 20260709-200033-r2-complete-37-commits-awaiting-push-merge-deploy.md
files_modified:
  - docs/testing/results/2026-07-10-test-run-03.md
  - functions/scripts/cleanup-run03-residue.ts
  - functions/scripts/core-loop-e2e.cjs
  - ~/.claude/projects/.../memory/project-decision-log.md（Run 03 里程碑＋八項定案）
---

## Working on: Run 03 部署後補測全程完成——PR #11 merge、殘留清理執行畢、使用者八項定案

### Summary
接續 R2 上線後的 Run 03 補測：清單 6 項——5 通過（CX-1 rules prod 生效、R2-13 clamp 三分支、
R2-29 reactivate 全鏈、R2-05 兩分支、R2-24 家長完整註冊）、R2-06 標註不可安全重現（維持 emulator
覆蓋）、R2-25/26/27 評估後使用者接受延後。FIX-A E2E 補步（section 17）81/81 兩次全綠。
PR #11（E2E 步＋報告＋清理腳本，3 commits）已 merge 進 main（`46ee10d`）、遠端/本地分支已刪。
R2-28 殘留清理腳本已由使用者 `--execute` 跑完 7/7，MCP 重讀 prod 驗證全過。**本輪不需部署**
（只動測試檔/文件/腳本）。

### Decisions Made（使用者 2026-07-10 點選定案，全記錄於 memory decision log）
- **R2-21 結案**：點數輸入 maxLength=4（單筆上限 9999）接受。
- **R3① 擋多家庭**：接受邀請時若已有別的 active 家庭就擋下並提示（單一家庭原則）。
- **R3② 移除成員時作廢其 pending 邀請**（改 revoked），關「被踢還能用舊邀請回來」的後門。
- **TestFamily2 留作第二家庭 fixture**（dev-parent2@mfk.test / families/xBNBwJRowZI8Jkj2lMkA）——
  正好供 R3① 實作測試。
- **R2-25/26/27 延後**（Run 04 候選，先備 seed 腳本）；R2-28 清理授權並已執行。
- 清理腳本對「遊戲 30 分鐘」採**復原 active**（種子品項回復原狀）而非刪除。

### Remaining Work / Next Steps
1. **R3 改善輪**（下一個開發工作）：① 擋多家庭雙 membership（acceptFamilyInvite ＋
   bootstrapParentAccount 檢查既有 active membership）② 移除成員作廢 pending 邀請
   ③ 🟡 小孩任務清單不即時反映封存（tasks 訂閱或組裝時重讀 status）④ notif/rewards 無上限查詢
   ⑤ markMissed 裸 update、rejectOrderIfPending 同款收窄、通知已讀持久化＋per-item 導覽。
   完整池：R2 計畫文件 §8＋`.superpowers/sdd/progress.md`。
2. **Run 04 候選**（測試）：R2-25（先寫 submissionCount seed 腳本）、R2-26（通知 seed 腳本）、
   R2-27 挑測（在 A 機跑，B 機軟鍵盤不穩）、R2-06 斷網重現（可選）。
3. 🔴 上線前既有硬項不變：Resend 自有寄件網域。

### Notes / Gotchas
- **模擬器實測環境觀察**（詳 Run 03 報告末節）：dev client 被 Maestro 點擊偶發閃退回主畫面
  （重開即續，Metro 無 JS 錯誤）；模擬器 B（iPhone 17）軟鍵盤間歇不出，inputText 會靜默失效——
  繞法 `simctl pbcopy`＋長按→原生「貼上」選單；LogBox toast 會攔 tab bar 點擊，先關再點；
  secure 欄位未聚焦不顯示點點，內容以送出結果/Auth 查詢為準。
- Fabric 下 Maestro 只吃座標＋原生 alert 文字（scrollUntilVisible 對 RN 文字無效）——重踩確認。
- `!` 指令一次只吃一行（多行 body 會被截斷）；gh pr merge --delete-branch 會自動切回 main 並 ff。
- 使用者 shell 的 cwd 會留在上一條 `!` 的位置（cd functions 後下一條不用再 cd）。

### Branch / PR / Commits
- main @ `46ee10d` = merge PR #11（test/run03，3 commits：`af3eb10` E2E 步、`7bcb427` 報告、
  `7c13d2f` 清理腳本）。分支已刪（遠端＋本地）。已 push。
- E2E 步驟原始實作出自 subagent worktree（已 cherry-pick 收整，worktree 已清）。

### Validation
- E2E emulator：81/81 **兩次**全綠（78 原步零退化＋新 3 步）；functions 單元測試 78/78、
  functions build（tsc）0 錯——皆本 session subagent 實跑。
- 模擬器實測：R2-13/29/05/24 全部「UI 操作＋Firebase MCP 後端讀值」雙面驗證（錢包、membership、
  invite、users/families 三件套，數值逐筆核對）。
- 清理腳本：DRY RUN 7 項全命中 → --execute 7/7 → MCP 重讀 4 個代表點全數符合預期。
- **未跑**：App jest 套件（本輪未動 src/）；R2-06 逃生出口（不可安全重現，emulator E2E 覆蓋）。

### Data Safety
- prod 寫入全走 App UI（小安 38→0→38、小宇 delta=0 冪等標記、Kid3 移除→reactivate、
  TestFamily2 註冊）或使用者執行的顯式清理腳本（7 個釘死 doc id，動手前逐項驗欄位）。
- 清理刪除項：2 筆 dev-order-ice、2 個整理房間重複 instance（保留已發點的
  4h4om0ktsWitI1vxA5XS）、測試任務＋其 instance。恢復項：dev-reward-game→active。
- 未動：.env、prod 設定、真實使用者、錢包餘額（清理不含 pointTransactions）。
- 新殘留（使用者知情同意留存）：TestFamily2 全套、invite 2zvBzjKTJ5QOa0LUioBj（accepted）。

### Manual Acceptance Checklist
1. 家長 App 禮物頁：「遊戲 30 分鐘」重新出現（active）。
2. 家長任務頁「整理房間」只剩正常週期 instance（無 rejected/pending 殘影）。
3. 設定頁小孩清單：Kid3、小安、小宇 三人齊（Kid3 為 reactivate 後）。
4. GitHub：PR #11 merged、main 最新 commit 46ee10d。

### Rollback / Do-Not-Do
- 回退單項 commit：`git revert af3eb10|7bcb427|7c13d2f`。清理腳本刪掉的 doc 不可逆
  （但全是測試雜訊，且有本 checkpoint＋報告記錄原值路徑）。
- **不要**再提 dev 測試密碼議題（已結案）；**不要**清 TestFamily2 / Kid3（fixture）；
  不要動 core_loop 備份線與 demo/current-snapshot。
- 模擬器 A=家長、B=Kid3（已恢復）；Metro 背景跑著（PID 見 lsof :8081），不用可殺。

### Remaining Confirmations
- 無——上輪四項開放確認（上線路徑、R2-28、maxLength、R3 兩決策）本 session 全數定案。
