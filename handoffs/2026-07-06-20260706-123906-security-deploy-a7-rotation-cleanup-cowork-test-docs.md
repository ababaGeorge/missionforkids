---
status: completed（2 個 pending：push 1 commit + 建議重輪 dev 密碼）
branch: main
head: d6f3d7a
timestamp: 2026-07-06T12:39:06+0800
files_modified:
  - functions/src/grantPoints.ts（+ __tests__）
  - functions/scripts/rotate-dev-passwords.ts（新增）
  - .gitignore（.secret.local、.gstack/demo/）
  - docs/testing/（測試計畫 + UX 建議 + Claude Cowork kickoff）
  - firestore.rules / functions / storage / indexes（部署 prod，未改碼）
---

## Working on: 安全加固部署上線 + A7 密碼輪換 + 分支收斂單一本線 + Claude Cowork 測試文件

### Summary
接手時任務是「盤點一致性、收斂到乾淨單一本線、盤點 agent 工具」。查出核心風險是 **PR #6 安全修復卡著沒生效、prod 仍跑 20 天前的漏洞 rules**。本 session 把整條收尾：補了一個 grantPoints 授權缺口進 PR #6、（隔兩天遠端 session 已 merge PR #6+#7）**部署安全修復上 prod 並用 Firebase MCP 實查驗證生效**、**輪換 A7 洩漏密碼**、**分支收斂成單一乾淨本線**、在**模擬器跑起當前 build 確認畫面**、盤點 B2/B3/B4、並寫出**給 Claude Cowork Desktop 的完整測試文件三件套**。收尾時發現自己把 dev 密碼誤寫進 committed 文件（A7 同型錯），已從 HEAD 拔除。

### Decisions Made
- **grantPoints 補 active 檢查**：家長端加 `status==='active'`、收點對象驗 active child，且**只改本地不動共用 resolveAuthoritativeChildId**（退款/兌換/核准三流程共用，改它會波及未授權範圍）。
- **部署走使用者 `!`**：prod deploy / git push / eas build 都被 auto-mode classifier 擋在 agent shell 外，一律使用者 `!` 前綴跑，不繞過。
- **A7 選改密碼不停用**：使用者要保留測試帳號，故輪換密碼而非停用；用新寫的 `rotate-dev-passwords.ts`（只改密碼不碰資料、密碼吃 env）。
- **分支零損失收斂**：`feat/security-hardening-demo`（local-only）先打 tag `archive/dual-sim-security-demo` 再刪；`demo/current-snapshot` worktree **保留**（內含未提交 demo 設定，不擅刪）。
- **測試對象是 Claude Cowork Desktop（AI 代理）非真人**：kickoff 改寫成 agent prompt，跑模擬器不需實機 build。

### Remaining Work / Next Steps
1. **【使用者】push 拔密碼那個 commit**（`d6f3d7a`，local main ahead origin 1）：`! git push`
2. **【建議】重新輪換 dev 密碼**：舊值已從 HEAD 拔除但仍在 git 歷史（d71f5ae/f498375）→ 視為已曝光。用新值重跑 `functions/scripts/rotate-dev-passwords.ts`（`! cd functions && DEV_SEED_PASSWORD='<新值>' node --experimental-strip-types scripts/rotate-dev-passwords.ts`；ADC 已設定），新值只放 env 不進 repo。同步更新 Metro 的 `EXPO_PUBLIC_DEV_PASSWORD`。
3. **【使用者】把 `docs/testing/claude-cowork-kickoff.md` 的 prompt 貼給 Claude Cowork Desktop 開測**。
4. Cowork 測試結果回來 → 分診缺陷，優先兩個 🔴：小孩兌換「我拿到了」後畫面卡死（`child/order/[id].tsx:78`）、對受邀綁定小孩發點失敗（`family.tsx:320`+`grantPoints.ts:52` 身分碎片化）。
5. **【產品】挑下一個方向**：B2 推播(M，需先決定通知推到誰的裝置) / B3 週期任務(M，主成本是補 Task weekday/monthDay 錨點欄位) / B4 OAuth(M–L，Apple Developer 付費 + 做 Google 就強制綁 Apple)。三份 scoping 見對話。

### Notes / Gotchas
- **ADC 過期會讓 admin 腳本靜默 hang**（不報錯）→ 先 `gcloud auth application-default login` + `set-quota-project mission-for-kids`。
- **模擬器 dev-client 載 bundle**：deep link `missionforkids://expo-development-client/?url=...` 會跳 iOS 確認框要手點「打開」；或 `simctl launch` 後按 expo 開發者選單「Continue」。Metro 背景 log 不即時 flush，別以為沒動。
- 模擬器 iPhone 17（`C6986BCA-EA1E-48E9-B324-5DC5A54D4F67`）目前跑著當前 dev build（EAS build `46fd1149`），Metro 在背景（帶 dev 密碼 env）。
- prod 現行 firestore rules 已是加固版（A1/A3/A5/A12/A16 逐條關閉），Firebase MCP 可重讀驗證。

### Branch / PR / Commits
- 本線 `main`，origin 同步到 `f498375`，本地再 +1（`d6f3d7a` 拔密碼，**未 push**）。
- 本 session 相關 commit：`4e71cab`(grantPoints active)、`b3fc68f`(gitignore secret)、`d71f5ae`(rotate 工具+handoff封存+gitignore demo)、`f498375`(測試文件)、`d6f3d7a`(拔密碼)。PR #6+#7 已 merge（`4a927de`）。
- origin 分支現況：`main` + 4 條刻意保留的 core_loop 備份（master/chore-vercel-config/feat-core-loop-*）。其餘死線/已併分支已刪。

### Validation
- **prod 部署驗證**：`firebase deploy --only firestore:rules,firestore:indexes,storage,functions` 成功；Firebase MCP 重讀 prod firestore rules = 加固版 live ✓；9 functions 全更新。
- **A7 驗證**：3 個 dev 帳號 `passwordUpdatedAt` 由建立時間→今天、`validSince` 更新（舊 session 失效）✓。
- functions jest 59/59（PR #6 基線）、tsc 0。
- App 在模擬器載入當前 JS ✓（「歡迎來到任務獎勵」登入畫面正常渲染）。
- 未跑：完整 App 端到端手測（正是交給 Claude Cowork 的任務）。

### Data Safety
- prod 部署皆為預期內（rules/indexes/storage/functions），未動 prod 使用者資料。
- dev 密碼輪換只影響 `dev-family-seed` 測試家庭 3 帳號（加固後傷害侷限）。
- **踩坑**：dev 密碼值誤入 committed 文件（kickoff + rotate 註解），已從 HEAD 拔除；**仍在 git 歷史**→ 建議重輪（見 Next Steps 2）。
- 所有刪除可逆：分支有 tag/origin 備份、worktree 保留。

### Rollback / Do-Not-Do
- **不要**再把 dev 密碼寫進任何 committed 檔（env / 使用者 `!` 傳入）。
- **不要**刪 core_loop 4 條備份線、**不要**強刪 `demo/current-snapshot` worktree（含未提交設定，要清先保留設定）。
- 重輪密碼後記得同步 Metro 的 `EXPO_PUBLIC_DEV_PASSWORD`，否則 dev 快速登入鈕填的是舊值。

### Remaining Confirmations
- 要不要重新輪換 dev 密碼（建議要）？
- `demo/current-snapshot` worktree 去留？
- 下一個產品方向選哪個（B2/B3/B4）？
