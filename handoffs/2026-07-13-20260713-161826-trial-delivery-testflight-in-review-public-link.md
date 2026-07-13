---
status: in-progress
branch: docs/trial-guide-link-note
head: 5d7136f
timestamp: 2026-07-13T16:18:26+0800
continues_from: 20260712-022117-rollover-notif-shipped-verified-prod.md
files_modified:
  - src/lib/inviteLink.ts（新，邀請連結 helper）
  - src/lib/__tests__/inviteLink.test.ts（新，10 邊界測試）
  - src/app/parent/(tabs)/family.tsx（家長 Share sheet＋重分享列）
  - src/app/auth/sign-in.tsx（小孩端貼上入口）
  - docs/trial/family-onboarding-guide.md（試用指南＋連結私下提供）
  - app.json（buildNumber 3→4，未提交，EAS 建置自動寫回）
---

## Working on: 第 3 步試用交付 — 邀請最後一哩上線＋TestFlight 重送審＋公開連結＋DB 備份

### Summary
把「首批 2-5 試用家庭能實際用起來」推進到只差 Apple beta 審查。做完四件事：(1) Firestore
PITR＋每日備份排程開啟（事故後硬項結案）；(2) 邀請最後一哩上線 main（PR #14，家長分享連結
＋小孩貼上入口，繞過收不到邀請信的 Resend sandbox 限制）；(3) TestFlight build 4 建置→
submit→建外部群組「試用家庭」→送 beta 審查（現「等待審查」）→建公開連結（上限 25）；
(4) demo 帳號密碼設好並實測可登入。**現在等 Apple 一次性 beta 審查通過，家庭才能安裝。**
寄件自有網域仍延到上市前（使用者定）。

### Decisions Made
- **邀請主交付路徑改「家長分享連結＋小孩貼上」**：試用期 Resend sandbox 只寄得到開發者本人，
  邀請信到不了試用家庭 → 家長用 iOS Share sheet 分享 deep link、小孩登入頁貼上整段訊息進邀請頁。
- **不做 pending 邀請列表**：firestore.rules 對 familyInvites `list=false`（A16 防 email 枚舉），
  client 端列表要放寬 rules，屬安全取捨，不在本輪做；改用「記住本 session 最後一筆邀請」的重分享列。
- **TestFlight 公開連結設 25 人上限**：私人試用，防連結外流被灌爆；可隨時調整。
- **公開連結與 demo 密碼不入 git**：repo 為 PUBLIC。連結私下給家庭；指南 PR #15 標明「私下提供」。
- **demo 帳號用 dev-parent@mfk.test**：有完整 seed 家庭資料，審查員登入即見任務／獎勵全流程。

### Remaining Work / Next Steps
1. **等 Apple beta 審查通過**（通常幾小時~1 天；Apple 寄 email 給帳號持有人）→ 通過後家庭才能裝。
2. **審查過後**：把 TestFlight 公開連結＋試用指南**私下**發給首批 2-5 家庭（LINE／訊息）。
3. **merge PR #15**（docs/trial-guide-link-note，指南連結改私下提供的措辭）。
4. 決定 app.json buildNumber 3→4 這筆未提交變更要不要收（見 Gotchas）。
5. 里程碑目標＝首批家庭連續用 7 天。寄件自有網域＝上市前硬項（延後中）。

### Notes / Gotchas
- **Apple《開發者協議》會過期**：`REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED` 403 會擋 EAS submit 上傳
  （與 App／憑證無關），到 App Store Connect 首頁橫幅同意即解，生效要幾分鐘。
- **ASC 測試資訊電話要國際格式**：`0939...` 被擋，要 `+886939...`。
- **submit／beta 審查提交走使用者 `!` 或本人瀏覽器**：classifier 擋 agent 對外發佈；同意協議、輸入
  Apple 帳密、點「提交以供審查」都必須使用者親自。
- **app.json buildNumber 3→4 未提交**：EAS 建置自動寫回本地；eas.json preview profile autoIncrement:true
  用 EAS 遠端計數器，不靠本地值，故不收也不會壞，但收了較同步。
- **ASC React 表單 form_input 設值無效**：要用真實鍵盤 click+type 才進得去（React controlled input）。

### Branch / PR / Commits
- 目前分支 `docs/trial-guide-link-note` @ `5d7136f`（PR #15，未 merge）＝指南措辭。
- **PR #14 已 merge 進 main（`898a57f`）**：邀請最後一哩 6 commits（inviteLink helper＋測試、家長 Share、
  小孩貼上、指南、審查修正重分享入口）。
- 前一輪 PR #13（rollover-notif）已在上個 session merge。

### Validation
- **邀請最後一哩（本 session workflow＋/check）**：tsc --noEmit 0；npm test（root jest）**114/114、17 suites**
  （含新增 10 個 extractInviteId 邊界測試）；workflow 三鏡頭對抗審查（正確性／資安／UX）→ 6 發現、
  對抗驗證確認 1 項並修；/check Standard security 專家零 HIGH／CRITICAL（路徑注入／fail-closed／
  id 熵／分享洩漏四點皆有防護）。**未碰 functions/、未跑 functions 測試**（事故防護）。
- **TestFlight**：EAS build 4 finished；eas submit 成功上傳 ASC；build 1.0.0(4) 狀態「等待審查」。
- **demo 帳號登入實測**：Firebase Auth REST signInWithPassword 對 dev-parent@mfk.test（本 session 設的
  密碼）回 idToken＝可登入（審查員登得進去）。
- **DB 備份**：gcloud describe 確認 PITR ENABLED＋backup schedule retention 604800s。

### Data Safety
- 未動 .env／secrets／firestore.rules／functions／storage。純 client＋docs＋ASC 設定＋prod Auth 密碼重設。
- **prod 寫入**：dev 三帳號密碼經 `functions/scripts/rotate-dev-passwords.ts` 重設（只改 Auth 密碼，
  不碰 Firestore 資料）；Firestore PITR＋備份排程開啟。
- **demo 密碼值不記於此檔**（repo 公開，避免 A7 同型洩漏）：值＝本 session 使用者於對話提供、經
  rotate 腳本以 `DEV_SEED_PASSWORD` 帶入的測試密碼；dev 密碼風險已接受。
- **TestFlight 公開連結不記於此檔**：見 ASC → App「Mission for Kids」→ TestFlight → 外部測試群組
  「試用家庭」→ 測試人員 → 公開連結（或本 session 對話）。
- 回滾：邀請功能各 commit 可單獨 revert；公開連結可在 ASC 停用；beta 審查可在 ASC 撤回；PITR／備份
  可 gcloud 關閉；demo 密碼可再 rotate。

### Manual Acceptance Checklist
1. 收到 Apple「beta 審查通過」email（或 ASC 該 build 狀態轉「可供測試」）。
2. 用另一支 iPhone 點 TestFlight 公開連結 → 能安裝 Mission for Kids（審查過後才行）。
3. 家長端：註冊→建家庭→邀請小孩→「分享邀請連結」把訊息傳出。
4. 小孩端（另一台）：登入頁「我有邀請連結」→貼上→進邀請頁→註冊加入。
5. GitHub PR #15 已 merge。

### Rollback / Do-Not-Do
- **不要**把 TestFlight 公開連結或 demo 密碼 commit 進 repo（PUBLIC，A7 同型風險）。
- **不要**裸跑 `npx jest` 於 functions（會清 prod，已有閘擋，別繞）。
- **不要**放寬 familyInvites rules 去做 pending 列表（A16 防枚舉，需另案評估）。
- **不要**重跑 seed 腳本而不帶 `DEV_SEED_PASSWORD=<本 session 密碼>`（會把 demo 密碼覆寫掉、審查員登不進）。

### Remaining Confirmations
- app.json buildNumber 3→4 未提交變更要不要收進 git（本 session 未決）。
- 首批試用家庭名單與發連結時機（待審查通過）。
