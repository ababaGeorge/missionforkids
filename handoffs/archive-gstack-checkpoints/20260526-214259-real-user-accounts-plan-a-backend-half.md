---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-26T21:42:59+0800
files_modified:
  - (本 session 改動皆已 commit；工作區僅 4 個未追蹤 handoffs/*.md，刻意不動)
---

## Working on: 真實使用者帳號系統 — Plan A（後端做完一半）

### Summary

把 missionforkids 從「全匿名登入」改成「真帳號」的大工程。匿名 uid 綁裝置不綁人，導致三個問題：dev 測試卡關、點數身分碎片化（長期 bug）、家長重裝丟家庭。本 session 完成設計定案 + git 整理 + Plan A 寫作 + 相容性檢查 + Plan A 實作前半（測試基建 + 資料模型 + bootstrapParentAccount 後端）。分支 `feat/real-user-accounts`，HEAD `b1a7119`，**尚未 push**（gh auth setup-git 已設好，跑 `git push -u origin feat/real-user-accounts` 即可上 origin 備份）。

### Decisions Made

- **架構分層**：登入方式（Firebase Auth：Phase1 email/密碼，Phase2 Google/Apple）與家庭歸屬（email 邀請）解耦。一帳號可掛多扇登入門。
- **小孩有自己的真帳號**；家長 email 邀請 → 小孩收信設帳號 → 自動綁家庭。邀請信用 **Resend**（Cloud Function 直呼）。
- **childId 點數保險絲**：點數釘永久 childId、不釘 uid，錢包 doc id = `{familyId}_{childId}`（一人一家一錢包）。
- **密碼重設**用 Firebase 內建自助（不做家長端專屬功能）。
- **現有資料全清不遷移**（都是測試資料）。
- **全程 TDD**：functions 用 firebase-functions-test + emulator；RN 用 jest-expo + Testing Library。
- **相依地雷已解**：pin `jest-expo@54.0.13`（54.0.14+ 的 react-server-dom-webpack peer 會跟 react 19.1.0 衝突，破壞 EAS `npm ci`）；**不**手動裝 rsdw（讓 npm 自解到相容的 19.0.6）；**不**用 `.npmrc legacy-peer-deps`（保持嚴格 peer）。`npm ci` 已驗 EXIT 0。
- **Java**：temurin cask 要 sudo（沙箱/`!` 都給不了密碼）→ 改用 `brew install openjdk` + `brew link --force`（免 sudo），emulator 可跑。
- 分 4 份循序計畫 A→B→C→D（見下）。

### Remaining Work

1. **Plan A 剩餘（RN client 端，下次接續）**：
   - Task 3.1 `src/lib/auth/registerParent.ts`（client 封裝：signup + 呼叫 bootstrapParentAccount）+ 測試
   - Task 3.2 `src/app/auth/sign-in.tsx` 加 email/密碼 登入+家長註冊 UI + 元件測試
   - Task 4.1 `src/app/index.tsx` 路由處理「已登入但無 profile」狀態 + 測試
   - 全部步驟與完整 code 已寫在 `docs/superpowers/plans/2026-05-26-real-user-accounts-plan-a.md`
2. **Plan B**：email 邀請(Resend) + deep link + 小孩接受註冊 + `acceptFamilyInvite`
3. **Plan C**：childId 點數重構（grantPoints / onTaskInstanceApproved / onRewardOrderCreated+退款 / 各頁讀取 全改 childId + 確定性錢包）
4. **Plan D**：dev 真帳號 seed + 退匿名 bootstrapDevSession + 清測試資料
5. 上線前人工：Firebase Console 啟用 Email/Password provider、Resend 開帳號+API key 放 Functions secret、deep link 設定

### Notes

- **執行方式**：用 superpowers:subagent-driven-development（每任務 fresh subagent + 審查），保留 controller context。Section 0 與 Task 1.1 我親手做/審（trivial），Task 2.1 派 subagent。
- **已完成並驗證**：Section 0 測試基建（functions+RN smoke 綠、npm ci 過）、Task 1.1（User 加 email + 'password'）、Task 2.1（bootstrapParentAccount，3 測試過、functions build 過）。
- **下次第一步建議**：`/context-restore` 讀本檔 → 接 Plan A Task 3.1（registerParent）。functions 測試跑 `cd functions && npm test`（需 emulator+java，已裝）；RN 測試 `npm test`。
- **權威文件**：spec `docs/superpowers/specs/2026-05-26-real-user-accounts-design.md`、計畫 `docs/superpowers/plans/2026-05-26-real-user-accounts-plan-a.md`、相容報告 `.specs/compatibility-report.md`。
- **git/分支真相**見記憶 [[repo-branch-structure]]；點數根因見 [[points-identity-fragmentation]]。
- **bootstrapParentAccount 小偏離**：unauthenticated 錯誤訊息含 'unauthenticated:' 前綴（為過測試 regex）；functions/tsconfig.json 加了 esModuleInterop（firebase-functions-test 需要，已驗不破壞既有 build）。
