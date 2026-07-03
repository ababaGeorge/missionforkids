# Handoff: 安全加固合併 + QA 4 修正 — prod 部署待做

> 2026-07-03（remote session 接續本機下午工作）

## 這個 session 做了什麼

1. **接續 `feat/security-hardening`（PR #6）**：下午本機推的最後兩個 commit（grantPoints active 檢查 `4e71cab`、secrets gitignore `b3fc68f`）確認完整。
2. **驗證 QA 報告 12 個未二次確認項**（`.gstack/audit-reports/2026-06-13-qa-audit-and-product-gaps.md`），修掉 4 個確認屬實的（PR #7，base = feat/security-hardening）：
   - `getFamilyInvite` 誤用 `.exists` 屬性（v24 是方法）→ 無效邀請恆回空殼
   - `[dev] 假提交` 按鈕缺 `__DEV__` gate
   - 任務提交改 batch 原子寫入 + `submissionCount` 用 `increment(1)`
   - `useFamily` onSnapshot 補 error callback（rules 收緊後必要）
3. **審查 PR #6 全部 security diff**：rules 家庭隔離/角色/狀態流轉鎖與 client 寫入路徑吻合、CF 金額權威化正確 → 判定可 merge。
4. **Merge**：PR #7 → `feat/security-hardening`，再 PR #6 → `main`（授權代決策）。

## 驗證基線（merge 前）

app tsc 0 錯誤｜RN jest 13/13｜functions jest 59/59（`emulators:exec --only firestore,auth`）

## ⚠️ 上線生效前必做（remote 環境無 firebase 憑證，未執行）

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project mission-for-kids
firebase deploy --only functions --project mission-for-kids
```

- rules 不部署 = A1–A6 攻擊面仍在 prod 開著
- indexes 含 A8 的 `(familyId ASC, createdAt DESC)`，不部署家長訂單歷史仍空白
- functions 含金額權威化/冪等/退款守衛/grantPoints active 檢查
- **A7 補刀**：三個 `@mfk.test` prod 帳號的舊密碼 `mfk-dev-2026!` 已公開洩漏，
  要在 Firebase Console 改密碼或停用帳號（拔原始碼只擋未來洩漏，不撤已洩漏的）

## 已驗證但仍開放（下次的候選工作）

- `acceptFamilyInvite` 未要求 `email_verified`（要動小孩註冊流程，產品決策）
- parent 路由缺 UI 層角色守衛（server 端已被 rules/CF 擋住）
- 註冊非原子（Auth 先建、CF 後呼叫，失敗重試 email-already-in-use）
- 審核按鈕 UI 防連點（server 端已冪等，純打磨）
- 產品缺口 B2（推播）、B3（週期任務排程）、B4（Apple/Google 登入）未動
