# Handoff: 前端全面修復 + Codex 安全審查

## Session Metadata
- Created: 2026-04-17 18:16:20
- Project: /Users/ababa_george/conductor/workspaces/missionforkids/manado
- Branch: ababaGeorge/office-hours
- Session duration: ~3 hours
- Continues from: handoffs/2026-04-13-session2-ui-fixes.md

## Current State Summary

上一個 session 測試家長端 UI 後留下 6 個問題（2 P0 + 2 P1 + 2 P2）。本次 session 全部修復，並額外發現和修復了 7 個 UX 問題。之後對照設計文件補齊了任務建立表單（截止天數、審核模式、補交期）、pending stars、退回備註、家長直接給點等缺失功能。最後讓 Codex 做 code review，發現 4 個安全/邏輯問題（1 P0 + 2 P1 + 1 P2），全部修復並部署。

App 在模擬器上可運行，但有一個 deep link dialog 殘留（是 CLI 操作 `simctl openurl` 造成的，不是程式 bug），手動點「取消」即可消除。底部有個 TypeError 紅條，疑似也是 deep link 觸發，需進一步確認。

## Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/app/auth/sign-in.tsx` | 登入頁 | 加了 KeyboardAvoidingView |
| `src/app/parent/(tabs)/_layout.tsx` | 家長 tab layout | 加了登出按鈕 |
| `src/app/child/(tabs)/_layout.tsx` | 孩子 tab layout | 加了登出按鈕 |
| `src/app/parent/(tabs)/tasks.tsx` | 家長任務管理 | 多選指派、範本、週期、截止天數、審核模式、補交期 |
| `src/app/parent/(tabs)/family.tsx` | 家庭管理 | 邀請碼管理、邀請家長、直接給點（Cloud Function） |
| `src/app/parent/(tabs)/review.tsx` | 審核頁 | 退回備註儲存、KAV |
| `src/app/parent/(tabs)/rewards.tsx` | 家長獎勵 | 訂單顯示品名/孩子名、拒絕訂單 |
| `src/app/child/(tabs)/tasks.tsx` | 孩子任務 | pending stars ☆、退回備註、截止日期、useAuth 修正 |
| `src/app/child/(tabs)/rewards.tsx` | 孩子獎勵 | 訂單歷史、取消訂單、確認收貨、兌換確認 |
| `src/app/child/(tabs)/points.tsx` | 孩子點數 | useAuth 修正（用 user doc ID 而非 auth UID） |
| `src/lib/inviteCode.ts` | 邀請碼系統 | 支援家長邀請碼、membership 用固定 ID 格式 |
| `functions/src/grantPoints.ts` | 直接給點 Cloud Function | **新增**，已部署 |
| `firestore.rules` | Firestore 安全規則 | **收緊**：tasks/rewardItems/rewardOrders 加 family-scoped 檢查 |
| `storage.rules` | Storage 安全規則 | isFamilyMember 用 `userId_familyId` doc ID 格式 |

## Work Completed

### Tasks Finished

- [x] P0：KeyboardAvoidingView — 所有有 TextInput 的頁面
- [x] P0：登出按鈕 — 家長/孩子 tab header 右側
- [x] P1：邀請碼管理 — 顯示狀態、重新產生
- [x] P1：退回備註存到 DB — review.tsx 寫入 rejectNote
- [x] P2：任務多選指派
- [x] P2：任務範本（8 個預設）
- [x] 邀請家長功能 — createParentInviteCode
- [x] 任務週期選擇（單次/每天/每週/每月）
- [x] 任務截止天數選擇（1/2/3/7 天）
- [x] 任務審核模式選擇（半自動/人工）
- [x] 任務補交期 (grace period) 設定
- [x] 任務卡片顯示截止日期（家長+孩子）
- [x] 孩子端 pending stars（☆ submitted / ★ approved）
- [x] 孩子端顯示退回備註
- [x] 家長直接給點功能（via Cloud Function）
- [x] 獎勵訂單顯示品名和孩子名
- [x] 孩子訂單歷史 + 取消 + 確認收貨
- [x] 兌換確認對話框
- [x] 改善 empty states
- [x] Codex review P0：Firestore rules 收緊 family-scoped 存取
- [x] Codex review P1：familyMemberships doc ID 改固定格式 `userId_familyId`
- [x] Codex review P1：孩子端改用 useAuth().user.id（非 auth UID）
- [x] Codex review P2：給點改用 Cloud Function

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| membership doc ID 格式 | auto ID vs `userId_familyId` | Security rules 需要 exists() 查找，固定格式才能用 |
| 給點走 Cloud Function | 直接寫 vs callable function | pointWallets 設了 `allow write: if false`，只有 admin SDK 能寫 |
| 移除「指派給全部」按鈕 | 保留 vs 移除 | 使用者反饋：孩子通常不多，不需要 |
| 截止天數用按鈕選擇 | date picker vs 天數按鈕 | 簡單直覺，避免額外 UI library |

## Pending Work

### Immediate Next Steps

1. **確認 TypeError 來源** — 模擬器底部的 `TypeError: Can...` 紅條，疑似 deep link handler 問題。手動點「取消」關掉 dialog 後看是否還出現
2. **孩子端邀請碼加入 flow 完整測試** — 透過邀請碼加入的孩子，確認用 useAuth 的 user.id 能正確查到 tasks/rewards/points
3. **部署 grantPoints Cloud Function 的 Eventarc 權限** — 新 callable function 可能需要 IAM 設定
4. **設計文件中仍未實作的功能**：
   - AI 半自動審核 flow（AI 初審 → 家長 48hr 覆審窗口 → 自動核准）
   - 週期任務自動建立下一期 instance（需 Cloud Function）
   - Grace period 到期自動標記 missed（需 scheduled function）
   - 照片 90 天自動清理
   - Push notifications（每日 23:59 批次通知）
   - Wishlist 功能（孩子收藏獎勵）
   - 孩子端 hero card 佈局（設計文件指定 60% 螢幕的大卡片）
   - 慶祝動畫的聲音效果
   - 頭像選擇器 + 個人化歡迎頁
   - 家長 Settings tab
   - 多孩子 profile 切換 + PIN

### Blockers/Open Questions

- [ ] OpenAI API key 需要更換（舊 key 在對話中暴露過）
- [ ] Google Sign-In 需要找與 Firebase 12 相容的方案
- [ ] Apple Sign-In 等 Apple Developer 驗證
- [ ] `docs/postmortem-eas-build-hell.md` 檔名/路徑命名規範未定
- [ ] Firestore composite indexes 可能需要額外建立（taskSubmissions 的 where + orderBy）

## Context for Resuming Agent

### Important Context

1. **Build 配置已鎖定，不要動：** RNFB v24 + Firebase iOS SDK 12.10.0 / `useFrameworks: "static"` + `forceStaticLinking` / EAS image Xcode 16.3
2. **familyMemberships 的 doc ID 現在是 `userId_familyId` 格式** — 這是 security rules 能正常運作的前提。如果已有舊的 auto-ID membership docs，它們不會被 security rules 識別
3. **pointWallets 和 pointTransactions 只能透過 Cloud Functions 寫入** — client 端 `allow write: if false`
4. **孩子端用 `useAuth().user.id` 而非 `auth().currentUser?.uid`** — 因為邀請碼孩子的 Firestore user doc ID 跟 auth UID 不同
5. **taskSubmissions 的 update 被允許** — 為了讓家長寫 rejectNote（之前是 immutable）

### Potential Gotchas

- 舊的 familyMemberships（auto ID）在新的 security rules 下無法通過 `isFamilyMember()` 檢查。如果測試出問題，可能需要重建 membership docs
- Dev mode 建的帳號（doc ID == auth UID）不受影響，但真正的邀請碼 flow 需要額外測試
- Expo dev server 需要用 `PATH="/opt/homebrew/opt/node@22/bin:$PATH"` 確保用 node@22
- 模擬器可能殘留 deep link URL state，重啟 app 時會跳 dialog

## Environment State

### Tools/Services Used

- Expo dev server: port 8081
- iPhone 17 Pro simulator (B4436202-581F-4922-8D3A-B2CAA91273DE)
- Firebase project: mission-for-kids
- EAS project ID: 569558f4-09ae-440f-b5d6-e6592d94b972

### Active Processes

- Expo dev server 可能還在 port 8081 跑
- 模擬器可能還開著

### Environment Variables

- OPENAI_API_KEY（在 Firebase Secret Manager 中）

## Related Resources

- 設計文件：`docs/design-core-loop-ai-demo.md`、`docs/design-office-hours-v1.md`
- 任務系統決策文件：`docs/任務系統模組決策文件_v1.0.md`
- EAS Build 踩坑紀錄：`docs/postmortem-eas-build-hell.md`
- 前次 handoff：`handoffs/2026-04-13-session2-ui-fixes.md`

## 關鍵指令

```bash
# Dev server
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx expo start --dev-client

# EAS Build（不要改配置）
PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build --profile development --platform ios --clear-cache

# 安裝到模擬器
xcrun simctl install booted /tmp/MissionforKids.app

# 部署 Cloud Functions
cd functions && npm run build && cd .. && firebase deploy --only functions

# 部署 Security Rules
firebase deploy --only firestore:rules,storage

# TypeScript 檢查
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx tsc --noEmit
```
