---
status: completed
branch: fix/cowork-round2
head: "7ba91a7"
timestamp: 2026-07-09T20:00:33+0800
continues_from: 20260709-034046-p8-p9-verification-passed-r1-fully-closed.md
files_modified:
  - （分支 62 檔 +4220/−383，37 commits——逐項清單見 .superpowers/sdd/progress.md 與計畫文件）
  - ~/.claude/projects/.../memory/project-decision-log.md（R2 里程碑）
---

## Working on: R2 改善輪全程完成——37 commits 三層審查全過、實測 8/8，待 push/PR/merge/deploy（使用者 !）

### Summary
使用者授權 ultracode workflow 全程推進 R2。Scope workflow 從 Run 01/02 報告＋fix plan §6＋PR#8 diff
語意分析建出 28 項 backlog → 四批實作（每項獨立 commit、實作兵＋對抗審查兵）→ /check Deep（7 審查兵）
→ codex 跨模型二審（採納 3、分歧 1 記錄）→ 雙機 Maestro 實測 8/8 通過。分支 fix/cowork-round2 共
37 commits（28 項 R2＋5 項 /check 修復＋3 項 codex 修復＋實測報告），閘門終值 tsc 0、app jest 88、
functions 78、E2E 78 步（含 rules 攻防 18 步）、rules-proof 11/11。**未 push——push/PR/merge/deploy
全需使用者 `!`。**

### Decisions Made
- **免費領獎窗口（FIX-A，4 審查兵獨立發現）**：扣款守衛收窄至 cancelled/rejected——approved 照扣。
  TDD 紅測證實舊碼漏扣。
- **CX-1 rules 編碼狀態機**：紅測證明 7 種攻擊（cancelled→approved、未提交直批、竄改快照）在舊 rules
  全成功 → 新 rules 全擋。E2E 從 59 擴到 78 步。
- **codex #4 不採納（跨模型分歧記錄）**：approved 遇餘額不足蓋 rejected 是金流正確行為，codex 建議會
  重開免費領獎窗口。
- **R2-12 照片上限**：12MB rules（零依賴）；**R2-15 拆半**：導覽做、已讀持久化延 R3。
- **#SXSN 處置**：小安取消（兼作 R2-04 stale 守衛實測），退款 8→38；Kid3 留 fixture。
- **點數輸入 maxLength=4**（上限 9999）——R2-21 隱性產品決策，已向使用者報備，不合意可回退。

### Remaining Work / Next Steps
1. **使用者執行上線路徑（依序、勿反序）**：
   a. `! git push -u origin fix/cowork-round2`
   b. `! gh pr create --base main --title "R2 改善輪：28 項修復＋/check+codex 終審修復" --body-file handoffs/最新這份`（或手動開 PR）
   c. merge（建議 `--merge` 保留逐項可回退歷史，同 R1 慣例）
   d. `! firebase deploy --only functions,firestore:rules,storage`（🔴 **本輪 storage 也有變更**）
   e. 部署後由 Claude 用 Firebase MCP 重讀 prod rules 驗證 CX-1 生效
2. 🔴 **部署順序硬約束**：deploy functions **之前**，任何新 client（Metro/EAS）不得對 prod 觸發
   註冊/邀請流程——舊 CF 會被 R2-05 恢復路徑觸發整份覆寫 user doc。
3. **Run 03 部署後補測**（清單見 docs/testing/results/2026-07-09-test-run-r2-sim.md）：R2-13 clamp
   UI、R2-05/06 註冊恢復＋逃生出口、R2-29 真流程、rules prod 生效、R2-24~27、E2E 補「建單即 approve
   仍扣款」步。
4. **R2-28 prod 清理（需使用者授權）**：舊殘留（整理房間多 instance、2 筆 dev-order-ice）＋本輪新增
   （封存的 dev-reward-game「遊戲30分鐘」、封存的「測試任務」）。
5. **R3 池**：🟡 小孩清單不即時反映封存（可提交已封存任務）、🟡 多家庭雙 membership（產品決策）、
   🟡 移除成員不作廢 pending 邀請（產品決策）、🟡 notif/rewards 無上限查詢（規模）、markMissed 裸
   update、rejectOrderIfPending 同款收窄、通知已讀持久化＋per-item 導覽。完整清單：計畫文件 §8＋ledger。

### Notes / Gotchas
- **workflow 編排 recipe 有效**：每項「實作兵＋對抗審查兵（還原驗紅／變異測試）」抓到多個恆真測試風險；
  /check 對抗四角抓到單項審查看不到的跨 commit 交互（免費領獎窗口）。
- **長命 Metro 不吃新 commit**（stale bundle 差點誤判 S2 fail）——驗 client 修復前重啟 Metro `--clear`。
- workflow 的 args 參數傳物件會被字串化（agent prompt 裡 `args.repo` 變 undefined）——路徑常數直接寫進
  script 較穩。
- session 額度斷點恢復：Workflow resumeFromRunId 快取重放有效，斷點前 commit 全保留；死兵留下的髒檔
  `git checkout --` 丟棄後 resume 即可。
- 模擬器 B 實為 iPhone 17（C6986BCA-EA1E-48E9-B324-5DC5A54D4F67），現登入 Kid3；Metro PID 16078
  帶 dev 密碼跑著。

### Branch / PR / Commits
- fix/cowork-round2 @ 7ba91a7，base main @ fcb0e0d，37 commits，62 檔 +4220/−383。**未 push、無 PR**。
- 逐項 commit 對照：.superpowers/sdd/progress.md（R2-01..32、FIX-A..E、CX-1..3 全列）。

### Validation
- 本 session 實跑（獨立驗證兵）：npx tsc --noEmit 0 錯；npx jest --ci 88/88（16 suites）；functions
  build＋test 78/78（10 suites）；E2E emulator 78/78（含 16 節攻防）；rules-proof.cjs 11/11。
- 模擬器實測 8/8（雙機 Maestro＋MCP 後端讀值），報告與截圖路徑見
  docs/testing/results/2026-07-09-test-run-r2-sim.md。
- **未跑**：prod 上的新 CF 行為（未部署，Run 03 補）。

### Data Safety
- prod 只動 dev-family-seed 且全走 App UI：封存 dev-reward-game、封存測試任務 rSiDfFFkRZHfvnmnDBMH、
  取消訂單 ZBvt53YQyPleVeXRsXSn（退款 8→38 由既有 CF 執行）。無 admin 直寫、無 rules 繞過、未動
  .env/prod 設定/真實使用者。
- repo：無依賴變更（package.json 僅 jest 白名單）；storage.rules 5MB→12MB＋firestore.rules 狀態機
  ——**皆未部署**。

### Manual Acceptance Checklist
1. `git log --oneline main..fix/cowork-round2`：37 commits、一項一 commit 可逐項回退。
2. 模擬器 A（家長）設定頁：FAB 顯示「+ 邀請小孩」；點「語言」列有「尚未開放」提示。
3. 模擬器 B（Kid3）我的頁：顯示「今天加入」；審核頁已清空（#SXSN 取消完成）。
4. merge＋deploy 後：家長對餘額 40 小孩扣 999 → 提示顯示 -40（已依餘額調整）＝R2-13 生效。

### Rollback / Do-Not-Do
- 回退單項：`git revert <該項 commit>`（一項一 commit 設計目的）。整分支不併：直接不 merge PR 即可，
  main 未被動過。
- **不要**在 deploy functions 前對 prod 跑註冊/邀請流程（見上）；**不要**先 merge 後拖延 deploy——
  merge 即應接 deploy，縮短新 client 舊 CF 窗口。
- **不要**再提 dev 測試密碼議題（使用者已結案）；不要刪 core_loop 備份線；不要動 demo/current-snapshot。

### Remaining Confirmations
1. 上線路徑四步（push→PR→merge→deploy）等你的 `!`。
2. R2-28 prod 清理授權（含本輪兩筆封存殘留是否復原「遊戲30分鐘」品項）。
3. 點數輸入 maxLength=4 上限 9999 是否接受。
4. R3 兩個產品決策：多家庭 membership 要擋還是支援；移除成員要不要作廢 pending 邀請。
