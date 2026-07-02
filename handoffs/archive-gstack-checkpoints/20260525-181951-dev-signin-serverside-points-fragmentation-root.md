---
status: in-progress
branch: fix/dev-signin-flow
timestamp: 2026-05-25T18:19:51+0800
files_modified:
  - functions/src/bootstrapDevSession.ts (new)
  - functions/src/grantPoints.ts
  - functions/src/redeemInvite.ts
  - functions/src/index.ts
  - src/app/auth/sign-in.tsx
  - src/app/parent/(tabs)/family.tsx
---

## Working on: dev 登入改 server-side（已部署）+ 點數身分碎片化根因確認

### Summary

主資料夾首次跑 dev build 時，小孩 dev 登入一直 firestore/permission-denied。investigate
找到根因（seedDevTasks 用 .doc().get() 讀不存在的 taskInstances → 規則 deny），但補丁越補越
脆。改用 codex 主導：把整個 dev 登入/seed/cleanup 從 client 搬到 server-side callable
`bootstrapDevSession`（Admin SDK，繞過 client rules 的先有雞先有蛋死結）。經 4 輪 codex
review（FAIL→FAIL→FAIL→PASS），修了 6 個 P1，**已部署 3 個 function 到 prod**。dev 三種
登入都驗證可用。

接著測試發現「點數各頁不同步」，查 Firestore 實際資料，確認**真正的長期根因 = 小孩點數身分
碎片化**（見下）。這條是獨立的大工程，本 session 只完成「查清根因」，未動手修。

分支 `fix/dev-signin-flow`，HEAD 279ab51，4 commit，**未 push、未合 main**。

### Decisions Made

- **dev 登入改 server-side bootstrapDevSession**（codex 主推，使用者拍板）：client 只做匿名
  登入 → 呼叫 callable，建立/清理/seed/重綁遷移全用 Admin SDK 冪等完成。sign-in.tsx 從
  795 行瘦到 490 行，移掉全部 client batch/cleanup/seed + 診斷碼。
- **mode：parent / child / existingChild**（QQ/RR）。existingChild 取代原本 createInviteCode
  +redeemInvite 的 dance，直接 admin 綁定 + 遷移。
- **順帶修 2 個 codex 抓到的 prod P1**：grantPoints 加 parent/child status==='active' + child
  role 檢查；redeemInvite 重綁時把舊 authUid membership 標 removed（移進 transaction）。
- **6 個 P1 全修**（4 輪 codex）：seed query 用 familyId-constrain（rules-are-not-filters）、
  family.tsx 給點傳 m.membership.userId 而非 m.user.id（修回歸 + 統一錢包）、existingChild
  驗證 childUserId 是 dev-family child、遷移補 tasks/rewards/orders + itemId 重映射、綁定包
  transaction。
- **規則安全漏洞（forgeable familyMemberships）刻意延後**：codex 標 P1 但這是 prod-wide 既有
  問題、牽涉家長建小孩 placeholder 的 client 寫入，使用者決定另開獨立任務（建議搭 /cso）。
- **點數系統不在本 session 修**：根因查清即收 checkpoint，下個 session 專心處理。

### Remaining Work

1. **【最高優先】點數身分統一 + 髒資料清理**（核心長期 bug「點數不同步」）：
   - 根因：一個小孩（QQ）的點數散在多個 id 的錢包——placeholder user doc id（KT9Fqzi…，
     家長以前給點對象，53 分成 3 個錢包）+ 每次登入輪換的 auth uid（任務發點對象，
     EPXQAVro…=30 / 7CYqada…=10 / hUPWR1ov…=10）。**系統從沒有「QQ 的單一錢包」**，
     auth uid 與 placeholder id 兩套身分從未調和。
   - 需決定 canonical 小孩點數 id（建議固定用 placeholder user doc id，auth uid 只做登入），
     task-award（onTaskInstanceApproved）/ grant / 各頁顯示全部統一到它。
   - 各頁顯示 desync（任務頁 ★30 vs 獎勵頁 ★0）：clean data 後重測確認；可能還有 rewards.tsx
     的 onSnapshot guard 小差異。
   - **髒資料清理**：dev-family-001 現有 8 個 active QQ membership（應剩 1）+ ~45 個錢包
     （多數 0、QQ 的散 5 個）。需一次性清理腳本，否則測什麼都被污染。
2. **規則安全漏洞**：firestore.rules `familyMemberships create: if isSignedIn()` 任何人可偽造
   parent membership → 在任意家庭 grantPoints。prod-wide。獨立任務，建議 /cso。
3. **家庭頁顯示小孩點數**（功能需求，圖2）：family.tsx 小孩列加餘額顯示。
4. **合併決定**：fix/dev-signin-flow（279ab51）未 push 未合 main，等使用者決定。
5. dev 捷徑上正式前要 __DEV__ gate（沿用前輪 pending）。
6. GCP Artifact 清理政策 + auto-mode classifier 白名單（使用者本人跑）。

### Notes

- **點數系統實際運作**（已查證）：pointWallets 每個 (userId, familyId) 一 doc，balance 唯一
  真實來源，只有 Cloud Functions 能寫。進帳 = onTaskInstanceApproved（加到 instance.userId）
  / grantPoints（加到傳入 childUserId）/ 兌換扣點。各頁用 `where userId==當前auth uid` 讀。
  問題就出在「childUserId 到底是哪個 id」從來不一致。
- **seed 的「拿到★X」是 instance.pointsAwarded 欄位**（seed 直接寫），不等於錢包餘額——
  seed approved 不會真的 credit 錢包。
- **functions 已部署 prod**：bootstrapDevSession（new）、grantPoints、redeemInvite，Node 22,
  us-central1。部署末尾 cleanup-policy Error 不是失敗。
- **codex review 紀錄**：4 輪，最終 PASS（唯一剩的 P1 是已接受延後的規則漏洞）。
- 環境：主資料夾 `~/Desktop/missionforkids project/missionforkids` 已 npm install（426 套件）+
  functions npm install。Metro 從主資料夾跑 8081，simulator B4436202 booted。
  cwd 注意：session 在 ~/Desktop/glab，slug 已硬指 ababaGeorge-missionforkids。
- **下個 session 第一句建議**：接續 mfk。dev 登入已改 server-side bootstrapDevSession 並部署
  （branch fix/dev-signin-flow 未合）。讀本 checkpoint。最優先：點數身分統一 —— 先寫髒資料
  清理腳本（dev-family-001 的 8 個 QQ membership + 散錢包），再決定 canonical 小孩點數 id
  並統一 task-award/grant/顯示。可用 firebase MCP（firestore_query_collection）直接查/改 DB。
