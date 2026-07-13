---
status: completed
branch: main
head: "633beb4"
timestamp: 2026-07-12T02:21:17+0800
continues_from: 20260711-182006-r3-gate-shipped-pr12-deployed-roadmap-to-trial.md
files_modified:
  - functions/src/__tests__/setup.ts（jest emulator 硬閘）
  - functions/scripts/cleanup-r3-sim-test.cjs（新，R3 實測殘留清理）
  - docs/superpowers/plans/2026-07-11-rollover-notif-plan.md（新，設計定案）
  - functions/src/lib/recurrence.ts（新，rollover 核心）
  - functions/src/rolloverRecurringTasks.ts（新，onSchedule 殼）
  - functions/src/__tests__/rolloverRecurringTasks.test.ts（新，11 測試）
  - functions/src/index.ts（+rollover export）
  - functions/scripts/core-loop-e2e.cjs（+第 22 節 rollover）
  - src/types/models.ts（+notifLastReadAt）
  - src/app/child|parent/(tabs)/notif.tsx（已讀持久化）
  - firestore.rules（users update 白名單）
  - functions/scripts/rules-proof.cjs（+自升家長攻防）
---

## Working on: R3 模擬器實測收尾 → 產品主線第一步（週期任務自動排程＋通知已讀）全程上線驗證

### Summary
一個 session 走完兩大段：(1) R3 安全防護的雙機模擬器實測三項全過；中途發現並處理「正式資料庫被測試清空」事故（加防護閘＋seed 重建）。(2) 產品主線第一步——/think 定案「週期任務自動排程 rollover＋通知已讀持久化」（範圍使用者選定，不含系統推播），ultracode workflow 實作＋對抗審查抓 4 條缺陷（含雙倍點、自升家長）全修，PR #13 merge → 部署 prod → Firebase MCP 三項驗證 → **手動觸發 rollover 正式環境端到端實測「真的生出今天新任務」** → cleanup 清殘留。**功能完整上線並驗證。** 結束於 main clean、下一里程碑＝第 3 步試用交付。

### Decisions Made
- **範圍：第一步只做 rollover ＋ 通知已讀，不做系統推播**——推播是零基礎重工程（沒裝套件、需 APNs .p8 憑證＋新 EAS build＋真機測），拆下一輪；rollover 純後端、有 PR#8 現成實作、模擬器可驗，最小風險。
- **rollover 用決定性 doc id `{taskId}_{userId}_{periodEndMs}` + `.create()`**——原收割的 `.add()` 隨機 id 在並發重複觸發時同期建兩筆 → 小孩同一週期領兩次點（違反點數唯一來源）。決定性 id 讓第二筆被 Firestore 擋。這是對抗審查（medium 但金流）發現、我判斷必修。
- **趁通知已讀收緊 users update rule**——通知已讀是全 repo 首個 client→users 直寫路徑，暴露既有過寬規則（小孩可寫 roleType:'parent' 自升家長）。改 `changedKeys().hasOnly(['notifLastReadAt'])`。既有漏洞但本輪是自然收緊時機。
- **通知已讀用 lastReadAt 時間戳（非 readIds 陣列）**——合成通知會隨底層 doc 消失，時間戳零維護不膨脹；樂觀水位用當前通知最大時間戳（與 server timestamp 同源，修時鐘偏移）。
- **事故根治：jest setup.ts 加 emulator 硬閘**——缺 FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST 即拒跑，與 E2E 腳本同款。跑測試交辦 prompt 一律指定 `npm test`（含 emulators:exec），不可裸 `npx jest`。

### Remaining Work / Next Steps
1. **第 3 步：試用交付**（下一里程碑，建議新 session /think 起）——Resend 自有寄件網域（🔴 上線前硬項）＋邀請寄失敗重寄/分享入口＋TestFlight 重發（四月版已過期）。目標＝首批 2-5 家庭連續用 7 天。
2. 🔴 **上線前硬項：開 Firestore PITR ＋每日備份排程**——這次能從資料清空事故重建是因無真用戶；有家庭在用前必開（事故暴露的根本缺口，目前無備份/無 PITR）。
3. **下下輪：系統推播**（獨立大工程）——APNs .p8 憑證、含 push entitlement 的 EAS build、client token 註冊＋授權流程。
4. 🟢 rollover 今晚 00:10（台北）會自動再跑一次（正常排程）；封存後復原的整理書桌下次 rollover 會納入。

### Notes / Gotchas
- **rollover E2E require 編譯產物 `../lib/lib/recurrence`**（tsc 未設 rootDir→產物落 functions/lib/lib/），跑 E2E 前必 `npm --prefix functions run build`（E2E 檔頭已含）。
- **cleanup 腳本要從 functions 目錄跑**（`cd functions && node scripts/...`），從 repo 根跑套件解析失敗。
- **Claude Code `!` 前綴要手動按、不能連同命令一起貼**——否則輸入框卡住送不出（使用者踩過）。貼上時只貼 `!` 之後的命令部分。
- rollover 對 status 的處理（prod 實證）：approved 不動、submitted 保留（續等審核）、pending/rejected→missed，四者都建下一期；被移除成員（membership≠active）與 archived task 都跳過。
- 事故時序：07-11 03:41 jest 未經 emulators:exec 直跑→ADC 連 prod→setup.ts afterEach 清空全庫。Auth 帳號倖存、Firestore 全空、PITR 未開不可還原。已用 seed-dev-family.ts 重建。

### Branch / PR / Commits
- main @ `633beb4` = merge PR #13（feat/rollover-notif，5 commits）：`0b8ba5e` 防護閘+清理腳本、`d73983b` 設計、`941454a` rollover、`fbe500b` notif、`e188ec0` 資安。分支已 merge、本地已 pull。
- 前一分支 fix/r3-lite（PR #12）已在上個 session merge。

### Validation
- 閘門全綠（workflow fresh-context agent 實跑）：tsc×2 0；functions jest **111/111**（含 11 rollover）；app jest **104/104**；emulator E2E **116/116**（含第 22 節 rollover＋22.6 移除成員防禦）；rules-proof **20/20**（含自升家長舊 rules 得逞/新 rules 擋的前後對照）。
- **部署後 prod 驗證（Firebase MCP + gcloud）**：①users update = `changedKeys().hasOnly(['notifLastReadAt'])` 生效；②`rolloverRecurringTasksScheduled` 在 prod（v2 scheduled）；③Cloud Scheduler `firebase-schedule-rolloverRecurringTasksScheduled-us-central1` ENABLED、every day 00:10 Asia/Taipei。
- **rollover prod 端到端實測**：手動觸發 scheduler → 刷牙(kid1,approved) 與寫作業(kid1,submitted) 各生出決定性 id 的 7/12 新 pending instance、舊的正確保留。missed 情境本次無（seed active 任務舊 instance 皆 approved/submitted）但 E2E 已覆蓋。
- **R3 模擬器實測（本 session 前半）**：①已屬家庭者開他家邀請被「已加入其他家庭」擋、membership 不變；②移除成員→membership removed＋pending 邀請同步 revoked（原子）；③封存→家長/小孩清單即時消失，rules 擋封存任務 instance 提交（permission-denied）。

### Data Safety
- 未動 .env / secrets / storage。prod 寫入：部署 functions+rules；rollover 觸發（結算測試家庭過期任務，預期）；cleanup（刪 dev-kid4/TestFamily3/孤兒 submission＋復原整理書桌 active，皆測試資料、DRY 先驗）。
- 事故已結案：無真實使用者資料損失（全測試資料）、已 seed 重建。
- 回滾：各 commit 可單獨 revert；rollover CF 可 undeploy（刪 Scheduler job）；rules 可 redeploy 前版；notifLastReadAt/rollover instance 皆 additive。

### Manual Acceptance Checklist
1. 明早查任一每日任務的 instance：應有今天日期的新 pending（rollover 每晚 00:10 自動生）。
2. App 通知頁按「全部標示已讀」→ 殺掉重開 → 仍為已讀（跨 session 持久）。
3. GitHub PR #13 merged、main 最新 `633beb4`。
4. Firebase Console → Functions 有 rolloverRecurringTasksScheduled；Cloud Scheduler 該 job ENABLED。

### Rollback / Do-Not-Do
- **不要**裸跑 `npx jest`（會清空 prod，已加閘擋但別繞）；跑 functions 測試一律 `cd functions && npm test`。
- **不要**整包 merge pr8-audit-reference（比 main 舊、會回退 removeFamilyMember 等）。
- **不要**在此輪硬塞系統推播（需 Apple 憑證+新 build，獨立輪）。
- 🔴 有真用戶前務必先開 PITR＋備份。

### Remaining Confirmations
- 無——範圍、修復、上線、清理全數本 session 定案並執行完畢。第 3 步待新 session 開議。
