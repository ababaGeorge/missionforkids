---
status: completed
branch: main
head: "f8c85e5"
timestamp: 2026-07-11T18:20:06+0800
continues_from: 20260710-162425-run03-complete-pr11-merged-residue-cleaned-8-decisions.md
files_modified:
  - docs/superpowers/plans/2026-07-10-r3-improvement-plan.md（新，已入庫）
  - functions/src/removeFamilyMember.ts（新 CF）＋ acceptFamilyInvite / bootstrapParentAccount
  - firestore.rules（memberships/families 鎖 client 直寫、taskInstances 提交擋 archived）
  - src/app child tasks/[id]、parent family/tasks、lib/instances、types/models、i18n ×2
  - functions/scripts/core-loop-e2e.cjs（sections 18-21）＋ rules-proof.cjs
  - ~/.claude/...memory/：project-decision-log、communication-keep-it-tiny（新）
---

## Working on: R3 安全閘門全程完成——設計→codex 全局改道→實作→審查→上線；大方向定案轉產品主線

### Summary
一個 session 走完整輪：/think 定 R3 計畫（方案 B 六項）→ 使用者表達迷路 → codex 全局審視
（診斷「開始過度加固」、建議瘦身＋轉試用路線）→ 使用者同意 → ultracode workflow 實作
（28 agents：5 實作＋15 審查兵 41 findings→18 修＋5 修正兵＋3 閘門）→ /check Deep
（security opus 零 HIGH、10 攻擊路徑 fail-closed；architecture 4 項→修 1 留池 3）→
PR #12 merge（`f8c85e5`）→ `firebase deploy --only functions,firestore:rules`（使用者 `!`）→
Firebase MCP 重讀 prod 驗證 rules 收緊與 removeFamilyMember 全部生效。

### Decisions Made（全部使用者確認）
- **R3 瘦身（codex 建議採納）**：R3-5 查詢上限退池（資料數百筆後才痛，不擋首批試用）；
  R3-3 限移除 child（無「家長互移」產品政策，不提前開權限面）；
  R3-6 修正為 IN_PROGRESS 三態收窄（codex 抓到初版規格錯誤、讀碼證實——只留 pending 會讓
  submitted/rejected 無法解除指派）。
- **移除成員收進 CF**（`removeFamilyMember`）：兩步非原子會留「被踢用舊邀請回來」後門；
  使用者以白話「退租收鑰匙」比喻確認選伺服器一次做完。
- **大方向定案**：R3 後**不開 R4 修復輪**，轉產品主線——①週期任務排程（rollover）＋最小推播
  ②Resend 自有網域＋邀請重寄 fallback＋TestFlight 重發 ③首批 2-5 家庭 7 天封閉試用
  ④依數據決定 AI 半自動核准/OAuth。下個里程碑＝「首批家庭連續使用 7 天」。
- **溝通紅線（新 memory：communication-keep-it-tiny）**：使用者連兩次說「看不懂」——
  之後對他 3-5 句話、一次一個決定、不用代號輪次、進度用產品成果描述。

### Remaining Work / Next Steps
1. **模擬器實測 R3（部署後補測）**：測前**重啟 Metro --clear**；TestFamily2（dev-parent2@mfk.test）
   測擋多家庭；移除鏈實測**不清 Kid3**（用臨時帳號、或移除後重邀走 reactivate 復原）；
   封存後小孩清單即時消失＋提交被擋。
2. **產品主線第一步（下一個開發輪，建議 /think 起）**：週期任務排程（rollover scheduler；
   PR #8 參考實作＋11 測試在本地分支 `pr8-audit-reference`）＋最小推播（孩子收提醒、
   家長收提交、孩子收審核結果）。
3. **試用交付**：Resend 自有寄件網域（🔴 上線前硬項）＋邀請寄失敗重寄/分享入口＋TestFlight 重發
   （四月版已過期）。
4. 留池備忘（`.superpowers/sdd/progress.md` R3-lite 節）：🟡 錯誤碼無單一來源（CF/client 字串比對）、
   🟡 E2E markMissed 鏡像副本、🟢 雙碼近義（NOT_SUBMITTED/NOT_SUBMITTABLE）、🟢 taskSubmissions
   孤兒 doc（pre-existing、rules 註解已揭露、無點數路徑）。

### Notes / Gotchas
- codex CLI 已升級 0.142.5→0.144.1（npm -g；舊版跑不動帳號預設模型 gpt-5.6-sol，錯誤訊息指示升級）。
- codex 對 R3 diff 的跨模型二審**被中停未完成**（使用者知情；前置審查鏈已足，可不補）。
- workflow 的 E2E 以 node 鏡像 markMissed 交易語意（RN 模組不能在 node 跑）——真 helper 由
  app jest 覆蓋；鏡像與本尊的同步是留池技術債。
- 溝通事故複盤：長報告＋代號＋一次多決策讓使用者斷線兩次；縮到三句話＋單一決定後立即恢復。
  「cl3」＝注音「好」（IME 未轉換）。

### Branch / PR / Commits
- main @ `f8c85e5` = merge PR #12（fix/r3-lite，13 commits）：`164236c` 計畫、`aff76a3`/`aba25b6`
  R3-1/2 守衛、`49e0455` R3-3 CF、`1a538b6` R3-4 三層、`421c490` R3-6、`017c288` E2E 18-21 節、
  `8783976`（client 直建家庭路徑關閉）/`de806f6`/`21943f3`/`676c8d5`/`8bd9f59` 審查修、
  `e9eb8f3` /check 修（快照錯誤降級）。分支已刪（遠端＋本地）、已 push。

### Validation
- 閘門全綠（本 session subagent 實跑）：tsc×2 0 錯；functions jest **99/99**；app jest **104/104**
  （/check 修正後重跑）；emulator E2E **110/110 兩次**（81 既有零退化＋29 新攻防步）；
  rules-proof **18/18**（含 main 舊 rules 下 5 條 R3 攻擊成功的前後對照）。
- 部署後 Firebase MCP 重讀 prod：rules 含全部 R3 收緊（families/memberships create:false、
  status 完全鎖、提交 archived get() 擋）；functions 10 支含 removeFamilyMember（v2 callable）。
- **未跑**：模擬器實測（列 next step 1）。

### Data Safety
- prod 只動 rules＋functions 部署；未動 Firestore 資料、.env、storage、真實使用者。
- rules 收緊空窗：舊 Metro bundle 的「建家庭」「移除成員」direct write 會被拒——重啟 Metro 即解；
  無真實使用者，dev 階段可接受。
- 回退：各 commit 可單獨 `git revert`；redeploy 前版 functions/rules 即回復；`revoked` 為新增
  狀態值、無資料遷移，殘留 doc 無害。

### Manual Acceptance Checklist
1. 家長 App 移除一個小孩成員 → 成功，且該小孩 email 的待用邀請同時作廢。
2. 已有家庭的帳號開另一家庭的邀請連結 → 顯示「已加入其他家庭」提示，不會加入。
3. 家長封存一個任務 → 小孩清單立即消失；若小孩已停在詳情頁按提交 → 被擋並提示。
4. GitHub：PR #12 merged、main 最新 `f8c85e5`。

### Rollback / Do-Not-Do
- **不要**清 TestFamily2 / Kid3（fixture）；不動 core_loop 備份線；不提 dev 密碼議題（已結案）。
- **不要再開修復輪**——大方向已定案轉產品主線；下輪從週期排程＋推播起。
- 對使用者溝通照 memory `communication-keep-it-tiny`：極簡、無代號、一次一決定。

### Remaining Confirmations
- 無——瘦身、CF 化、試用路線、上線全數本 session 定案。
