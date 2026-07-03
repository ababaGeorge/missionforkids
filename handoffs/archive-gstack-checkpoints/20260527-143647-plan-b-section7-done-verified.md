---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-27T14:36:47+0800
files_modified:
  - src/app/invite/[inviteId].tsx (new, Task 7.1)
  - src/app/parent/(tabs)/family.tsx (Task 7.2)
  - src/app/auth/sign-in.tsx (移除輸入邀請碼)
  - (皆已 commit；工作區僅 4 個未追蹤 handoffs/*.md，刻意不動)
---

## Working on: 真實使用者帳號系統 — Plan B Section 7 完成 + 模擬器驗證

### Summary

接續 Plan B Section 1-6（後端/client 已 commit）。本 session 做完 **Section 7（UI）** 並用 iOS 模擬器實機驗證：Task 7.1 接受邀請畫面（deep link 落地）、Task 7.2 家長 email 邀請入口、修接受畫面卡死、移除 sign-in 舊「輸入邀請碼」入口。分支 `feat/real-user-accounts`，HEAD `ba0f0de`，**領先 origin 4 個 commit、尚未 push**（已請使用者跑 `! git push`）。RN 測試 8/8 綠。

### Decisions Made

- **Task 7.1**：照 Plan B 計畫的完整 code 建 `src/app/invite/[inviteId].tsx`（email 唯讀、deep link `missionforkids://invite/<id>` 路由）。controller 親手做（trivial create）。
- **Task 7.1 卡死修復（使用者現場指出）**：無效邀請畫面原本死路一條 → 加「回到首頁」按鈕（`router.replace('/')`）+ useEffect 加 catch（讀取失敗當無效處理，不外洩 uncaught rejection 紅 toast）+ primaryBtn 加 paddingHorizontal 修圓球變藥丸。commit `6916213`。
- **Task 7.2**：family.tsx 是全 modal 模式（FAB→Alert→Modal），故沒照計畫的裸 inline 表單，改用 FAB 選單加「用 Email 邀請小孩」+ 專屬 modal（沿用 modalStyles），靜態 import createFamilyInvite。testID 齊全。
- **sign-in 清理（使用者要求）**：移除「孩子加入/輸入邀請碼」整段（state/handler/9 個 style），保留 redeemInviteCode/createInviteCode import（dev「以現有小孩 QQ/RR」path 仍用）。commit `ba0f0de`（-143 行）。
- **Beta 測試帳號區**：確認未來 Plan D 整區移除（dev 捷徑）。

### Remaining Work

1. **部署後端跑真 end-to-end**（使用者已聽完解釋，待其決定推進）：
   - 我可做：`firebase deploy --only functions:createFamilyInvite,functions:acceptFamilyInvite,firestore:rules`
   - 只有使用者能做：Resend API key（`! firebase functions:secrets:set RESEND_API_KEY`）+ Firebase Console 開 Email/Password provider
2. **Plan B Section 8**：functions + RN 全套件整合回歸（RN 已 8 綠；補部署後再跑一次）+ deep link 手動驗證已做過。
3. **push**：4 commit 待使用者 `! git push`。
4. **Plan C**：childId 點數重構（grantPoints/onTaskInstanceApproved/各頁讀取 改 childId）。
5. **Plan D**：dev 真帳號 seed + 退匿名 + 移除 Beta 測試帳號區 + 清測試資料。

### Notes

- **模擬器驗證結果（2026-05-27）**：
  - Task 7.1 deep link 路由 ✅、無效 fallback + 回首頁按鈕 ✅
  - Task 7.2 FAB 選單入口 + modal ✅（使用者手動點過截圖確認）
  - 送出邀請 → **NOT FOUND**：已用 firebase MCP 確認 `createFamilyInvite`/`acceptFamilyInvite` **不在已部署清單**（只有 analyzePhoto/grantPoints/redeemInvite/onTaskInstanceApproved 等 8 個）。非 bug，是後端未部署。
  - 接受畫面 `permission-denied`：familyInvites 規則未部署所致，同源。
- **圖一 ChildTasks 錢包 `permission-denied`（tasks.tsx:99）**：使用者決定**記下、留 Plan C**。是 [[points-identity-fragmentation]] 那類根因（dev 匿名 uid 輪換 + 身分對不上），非本 session 回歸（沒碰 tasks.tsx/錢包/部署規則）。
- **環境踩坑（重要）**：
  - **watchman 沒裝 → Metro 用 node fs watcher，會漏檔案變更**，改 code 一直送 stale bundle，被迫 cold restart 3 次（也是一開始紅屏「Failed to get SHA-1 pretty-format」的同源）。**本 session 已 `brew install watchman`（/opt/homebrew/bin/watchman v2026.05.25）修好**，之後 hot reload 正常。
  - **Homebrew python 3.14 壞掉**：`pyexpat` dlopen 失敗（`_XML_SetAllocTrackerActivationThreshold` 不在系統 libexpat），pip 連 bootstrap 都失敗 → fb-idb（idb 的 python client）裝不起來。idb-companion(native) 裝好了但沒 client。**可能影響其他 python 工具（含 Obsidian 結報 hook）**。待 `brew reinstall python@3.14`/修 expat。使用者說 idb 自己另想辦法。
- **模擬器跑法（無 project run skill）**：app 是 @react-native-firebase dev client（非 Expo Go，本機 build 被 Xcode26/gRPC 擋）。simulator iPhone 17 Pro(iOS26.4 `B4436202…`)已裝 dev client（無 embedded jsbundle，exp+missionforkids scheme=dev client）。跑法：`expo start --dev-client` → `xcrun simctl openurl booted "missionforkids://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"` → 載 JS → `xcrun simctl openurl booted "missionforkids://invite/<id>"` 測 deep link → `xcrun simctl io booted screenshot`。改 code 想保證生效就 cold restart Metro（現在有 watchman 應該 hot reload 即可）。
- **權威文件**：Plan B `docs/superpowers/plans/2026-05-26-real-user-accounts-plan-b.md`（Section 7 在 916 行）。git 真相見 [[repo-branch-structure]]。
- HEAD `ba0f0de`，領先 origin 4 commit，未 push。
