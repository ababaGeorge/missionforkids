---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-04-24T14:57:59+08:00
files_modified:
  - app.json
  - eas.json
  - HANDOFF.md
  - firestore.rules
  - functions/src/index.ts
  - package.json
  - package-lock.json
  - src/app/_layout.tsx
  - src/app/auth/sign-in.tsx
  - src/app/child/(tabs)/_layout.tsx
  - src/app/child/(tabs)/rewards.tsx
  - src/app/child/(tabs)/tasks.tsx
  - src/app/child/(tabs)/me.tsx
  - src/app/child/(tabs)/notif.tsx
  - src/app/parent/(tabs)/_layout.tsx
  - src/app/parent/(tabs)/family.tsx
  - src/app/parent/(tabs)/notif.tsx
  - src/app/parent/(tabs)/review.tsx
  - src/app/parent/(tabs)/rewards.tsx
  - src/app/parent/(tabs)/tasks.tsx
  - src/types/models.ts
  - src/i18n/en.json
  - src/i18n/zh-TW.json
  - src/lib/inviteCode.ts
  - tsconfig.json
---

## Working on: Night Sky UI complete — TestFlight shipped

### Summary

Direction C "Night Sky" UI reskin (Phases 1–8) 全部完成並送出 TestFlight。深藍底色 `#1E2547` + 金色 primary `#FFD966` 設計語言已覆蓋所有主要頁面。EAS Build preview profile 已從 internal 改為 store distribution 並成功 build（build ID: 63c1c4ac，9 分鐘完成），並送出 TestFlight。此外 OPENAI_API_KEY 已輪換，Codex CLI 已升級，app.json 補上 ITSAppUsesNonExemptEncryption: false。

### Decisions Made

- Child tabs: 4 tabs（tasks / rewards / me / notif），已刪除 ai.tsx 和 points.tsx
- Parent tabs: 5 tabs（tasks / review / rewards / notif / family）
- Child notif: 從 taskInstances（approved/rejected）派生，local Set 讀取狀態（MVP，無 Firestore 持久化）
- Parent notif: 目前是 placeholder，待後續實作
- Weekly bar chart: 依 reviewedAt 日期計算當週已核准任務數（不用 periodStart）
- EAS preview profile: distribution 從 "internal" 改為 "store"（為了 TestFlight）
- app.json: 補上 `ITSAppUsesNonExemptEncryption: false`（不使用自訂加密）
- Badge 未達成樣式: `borderStyle: 'dashed'`, `opacity: 0.5`
- 點數操作仍走 Cloud Functions，client 不碰 wallet

### Remaining Work

1. **TestFlight 測試** — 裝到手機跑一遍主流程，確認沒有 regression（最優先）
2. **Parent 通知實作** — 目前是 placeholder，需要像 child notif 一樣從 taskInstances 派生真實資料
3. **`child/order/[id].tsx`「我拿到了」按鈕** — 按下後邏輯尚未接好
4. **Firestore 安全規則** — `isFamilyMember` 應加 `status == 'active'` 檢查
5. **型別補齊** — `Task` 缺 `graceDays`、`RewardItem` 缺 `emoji`

### Notes

- 所有 TypeScript 檔案 `npx tsc --noEmit` exit 0（本 session 確認）
- Branch 自 commit 3edf124 後無新 commit，所有變更仍在 working tree（unstaged/untracked）
- EAS Build 在 Claude Code bash 環境（無 TTY）無法互動式設定憑證，須在 Terminal.app 跑
- gstack 本 session 自動升級 1.10.1.0 → 1.11.0.0
- `src/app/parent/(tabs)/notif.tsx` 是本 batch 新建的 placeholder 檔案
