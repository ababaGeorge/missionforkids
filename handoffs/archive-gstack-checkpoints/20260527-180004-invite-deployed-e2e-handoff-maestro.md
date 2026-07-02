---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-27T18:00:04+0800
session_duration_s: unknown
files_modified:
  - (本 session 改動皆已 commit + push 到 origin；工作區僅 4 個未追蹤 handoffs/*.md，刻意不動)
---

## Working on: 邀請功能後端已部署上線 → 交接給 Maestro session 跑 E2E 測試

### Summary

Plan B 邀請功能（家長用 email 邀請小孩）**前端 + 後端全部上線**。本 session：做完 Section 7 UI（接受畫面/家長入口/卡死修復/移除舊輸入邀請碼）、模擬器驗過 UI、**部署後端到正式專案 mission-for-kids**（createFamilyInvite + acceptFamilyInvite + familyInvites 規則 + Resend secret + 開 Email/Password 登入）。HEAD `ba0f0de`，**已 push origin（ahead=0）**。下一步交接給**新 session 用 Maestro 跑完整 E2E 測試**，測試信箱用 `ababaplanet@gmail.com`，新 session 自己收信、提取邀請連結、完成小孩接受。

### Decisions Made（本 session）

- Section 7 UI 全做完並驗證（見上一個 checkpoint 20260527-143647 細節）。
- **部署上線（2026-05-27 ~17:xx）**：`firebase deploy --only functions:createFamilyInvite,functions:acceptFamilyInvite,firestore:rules` 成功。MCP functions list 確認 10 個函式含兩個新的。Resend secret 用 `printf '%s' "$(pbpaste)" | firebase functions:secrets:set RESEND_API_KEY --data-file=-` 設好（互動式在 `!` 下吃空值會 400，要走 stdin）。Email/Password 在 Console 手動開（admin API PATCH 被 auto-mode classifier 擋 → 使用者自己 Console 點，已啟用，截圖確認）。
- **測試信箱定 `ababaplanet@gmail.com`**：因 sendInviteEmail 用 Resend sandbox 寄件人 `onboarding@resend.dev`，sandbox **只能寄到 Resend 帳號本人的 email**。使用者 Resend 帳號 = ababaplanet@gmail.com，所以寄得到、新 session 收得到。

### Remaining Work — 新 session（Maestro）要做的 E2E 測試

**目標**：在 iOS 模擬器跑完整邀請流程並驗證，全自動。

**工具**：
- **Maestro**（mobile.dev 的 E2E UI 測試框架）做點按自動化 — 取代失敗的 idb。安裝：`curl -Ls "https://get.maestro.mobile.dev" | bash`（裝完 `~/.maestro/bin` 加 PATH）。Maestro 用文字/id 點 RN 元件，testID 已埋好（invite-child-name / invite-child-email / invite-child-submit / invite-email / invite-password / invite-submit / invite-invalid-home）。
- **Gmail MCP 工具**讀信：`mcp__claude_ai_Gmail__search_threads`、`mcp__claude_ai_Gmail__get_thread`（讀 ababaplanet@gmail.com）。
- **不要用 idb**：本機 Homebrew python 3.14 壞掉（pyexpat dlopen 失敗），fb-idb 裝不起來。

**E2E 步驟**：
1. 起 App：dev client（非 Expo Go）。`expo start --dev-client --port 8081`（watchman 已裝，hot reload 正常）→ `xcrun simctl openurl booted "missionforkids://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`。模擬器 iPhone 17 Pro iOS26.4 `B4436202-581F-4922-8D3A-B2CAA91273DE`。
2. 家長端（Maestro 驅動）：sign-in 點「以家長身分進入」→ 底部「設定」tab（家庭頁）→ 右下 `+` FAB → Alert 選「用 Email 邀請小孩」→ 填 小孩姓名 + `ababaplanet@gmail.com` → 「送出邀請」。**預期**：Alert「邀請已送出」(emailSent true)。若 NOT FOUND 代表函式沒部署（已確認部署了，不該發生）。
3. 收信（Gmail MCP）：search `from:onboarding@resend.dev` 或 subject 含「邀請你加入」。信件 body 有連結 `missionforkids://invite/<inviteId>`（HTML `<a href>` + 純文字「請複製：missionforkids://invite/<id>」）。提取 inviteId。
4. 小孩端：`xcrun simctl openurl booted "missionforkids://invite/<inviteId>"` → 接受畫面（email 已預填唯讀=ababaplanet@gmail.com）→ Maestro 在 invite-password 輸密碼 → 點 invite-submit「建立帳號並加入」。**預期**：導到 `/child/(tabs)/tasks`。
   - ⚠️ acceptFamilyInvite 會驗 token email == invite.email。小孩用 `createUserWithEmailAndPassword(ababaplanet@gmail.com, 密碼)` 建帳號 → token email 就是 ababaplanet@gmail.com == invite.email ✅ 一致，能過。
5. 驗證：家庭頁出現新小孩成員；invite doc status → accepted；建了 `pointWallets/{familyId}_{childId}`。可用 firebase MCP `firestore_get_document` / `firestore_query_collection` 查。

**其他剩餘（E2E 後）**：
- Section 8 全套件回歸（RN 已 8 綠；functions 17 綠）。
- Resend 驗證自有寄件網域（才能寄給非 ababaplanet 的任意小孩 email；現在 sandbox 只能寄自己）。
- cleanup policy（部署有非致命警告，舊 container image 會累積小額月費）：`firebase functions:artifacts:setpolicy`。
- Plan C：childId 點數重構（修 [[points-identity-fragmentation]]）。Plan D：dev 真帳號 + 移除 Beta 測試帳號區。

### Notes

- **圖一 ChildTasks 錢包 `permission-denied`（tasks.tsx:99）**：既有 points-fragmentation 問題，留 Plan C，E2E 測試忽略它（不是邀請流程的事）。
- **git**：HEAD `ba0f0de`，已 push origin/feat/real-user-accounts（ahead=0 behind=0）。本 session 4 commit：8df64ea(7.1) 8eecb28(7.2) 6916213(卡死修復) ba0f0de(移除輸入邀請碼)。
- **firebase 部署清單（驗證用）**：createFamilyInvite, acceptFamilyInvite, analyzePhoto, autoCompleteDeliveredOrders, bootstrapDevSession, grantPoints, onRewardOrderCancelledOrRejected, onRewardOrderCreated, onTaskInstanceApproved, redeemInvite（共 10）。
- **權威文件**：Plan B `docs/superpowers/plans/2026-05-26-real-user-accounts-plan-b.md`。git 真相 [[repo-branch-structure]]。
- 前一個 checkpoint `20260527-143647-plan-b-section7-done-verified.md` 是部署前狀態，**本檔較新、以本檔為準**（部署已完成、Email/Password 已開）。
