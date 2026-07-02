---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-27T00:29:29+0800
files_modified:
  - (本 session 改動皆已 commit；工作區僅 4 個未追蹤 handoffs/*.md，刻意不動)
---

## Working on: 真實使用者帳號系統 — Plan A 全完 + Plan B 後端/client 封裝(Section 1-6)完成

### Summary

接續上次的 Plan A 後端一半。本 session 完成：(1) Plan A 剩餘 client/UI（registerParent、sign-in email/密碼 UI、index 路由修正）；(2) compat-check 補 Resend + deep link 相容性；(3) 寫 Plan B 詳細任務計畫；(4) Plan B Section 1-6 實作（資料模型 + 寄信 + createFamilyInvite + acceptFamilyInvite + Firestore 規則 + client 封裝）。分支 `feat/real-user-accounts`，HEAD `3474d86`，**比 origin 領先 13 個 commit、尚未 push**（`! git push` 即可備份，gh auth setup-git 已設好）。測試：functions 17 綠、RN 8 綠、兩邊 tsc 乾淨。

### Decisions Made

- **執行方式**：subagent-driven-development（每實作任務 fresh subagent + 兩階段審查；trivial 任務 controller 親手）。
- **Plan A 收尾**：sign-in 加 email/密碼登入+家長註冊 UI（含 autoComplete/textContentType UX）、index 路由處理「已登入但無 profile」停 loading 不彈回 sign-in。
- **Plan B 範圍邊界**：childId **只在新小孩帳號**引入（acceptFamilyInvite 產生 + 建確定性錢包 `{familyId}_{childId}`，childId=uid 與既有 doc id 相容）；**改寫既有點數流程屬 Plan C**。
- **Resend 用 raw fetch**（node 22 內建，零新依賴），封成可注入 mock 的 `sendInviteEmail`；金鑰用 `defineSecret('RESEND_API_KEY')`（照 analyzePhoto.ts）；本機測試 `functions/.secret.local`。
- **寄信失敗不擋邀請建立**（createFamilyInvite 先建 doc 再 best-effort 寄，失敗回 emailSent:false）。
- **🔒 安全決議（使用者拍板）**：acceptFamilyInvite 加 `INVITE_EMAIL_MISMATCH`（permission-denied）—— 登入者 token email 必須 == invite.email，擋 inviteId 外洩冒用。**連帶 Section 7 接受畫面 email 欄位要設唯讀**（已寫進計畫）。
- **deep link Phase 1 只用既有 `missionforkids://` scheme**；universal link 延後上線前。
- **familyInvites 規則**：單 doc `get` 公開（inviteId 是隨機秘密，接受畫面 pre-auth 顯示用）、`list` 禁、`write` admin-only。
- 錯誤訊息前綴 code（`unauthenticated:` 等）以過 firebase-functions-test regex —— 沿用 bootstrapParentAccount 既有慣例，HttpsError code 不變。

### Remaining Work

1. **Plan B Section 7（UI，下次接續）**：
   - Task 7.1 `src/app/invite/[inviteId].tsx` 接受邀請畫面（deep link 落地）— **email 欄位必須唯讀**（從 invite 預填）。完整 code 在計畫檔。
   - Task 7.2 `src/app/parent/(tabs)/family.tsx` 加「用 email 邀請小孩」入口（實作者需先讀該大型檔再整合）。
2. **Plan B Section 8**：functions + RN 全套件整合回歸（大部分已綠，補 7.x 後再跑一次）+ deep link 手動驗證 `npx uri-scheme open "missionforkids://invite/<id>" --ios`。
3. **Plan C**：childId 點數重構（grantPoints / onTaskInstanceApproved / onRewardOrderCreated+退款 / 各頁讀取 全改 childId + 確定性錢包）。
4. **Plan D**：dev 真帳號 seed + 退匿名 bootstrapDevSession + 清測試資料。
5. **上線前人工**（不擋開發）：Resend 帳號+API key→`! firebase functions:secrets:set RESEND_API_KEY`；Firebase Console 開 Email/Password provider；`! firebase deploy --only firestore:rules,functions`；universal link hosting。

### Notes

- **下次第一步建議**：`/context-restore` 讀本檔 → 接 Plan B Task 7.1（接受畫面，記得 email 唯讀）。
- **權威文件**：spec `docs/superpowers/specs/2026-05-26-real-user-accounts-design.md`、Plan A `docs/superpowers/plans/2026-05-26-real-user-accounts-plan-a.md`、Plan B `docs/superpowers/plans/2026-05-26-real-user-accounts-plan-b.md`、相容報告 `.specs/compatibility-report.md`（含 Plan B 附錄）。
- **functions 測試指令坑**：`npm test -- <pattern>` 不會過濾（參數跑進 emulators:exec）。跑單檔用 `cd functions && firebase emulators:exec --only firestore,auth 'npx jest --runInBand --forceExit <pattern>'`（npx jest，非裸 jest）。已記進 gstack learnings。
- **新 callable 已匯出**：createFamilyInvite / acceptFamilyInvite 在 functions/src/index.ts。
- **git/分支真相**見記憶 [[repo-branch-structure]]；點數根因見 [[points-identity-fragmentation]]（Plan B 已開始鋪 childId 地基）。
- HEAD `3474d86`，領先 origin 13 commit，未 push。
