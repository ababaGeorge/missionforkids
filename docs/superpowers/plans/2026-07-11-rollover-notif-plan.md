# 週期任務自動排程（rollover）＋ 通知已讀持久化 — 設計定案

> 2026-07-11 · missionforkids 產品主線第一步 · 使用者選定範圍＝rollover ＋ 通知已讀（不含系統推播）

## Building（要做的）

兩個純後端／資料層功能，皆不碰 Apple 憑證、EAS build、系統推播：

1. **週期任務自動排程（rollover）**：一支每日 00:10（Asia/Taipei）執行的排程 Cloud Function。
   把已過補交期、仍 pending/rejected 的週期任務 instance 標成 `missed`，並建立下一期
   `pending` instance。收割 PR #8（分支 `pr8-audit-reference`，commit `fa6ec6f`）的 3 個
   additive 檔＋11 單元測試。

2. **通知已讀持久化**：現在通知的已讀狀態只存在 React 記憶體，重開 App 全變未讀。
   改成在 `users/{uid}` 存一個 `notifLastReadAt: Timestamp`，「全部標示已讀」寫回此值，
   未讀判斷改為「通知時間 > notifLastReadAt」。跨裝置一致、重開不忘。

## Not building（明確不做）

- **系統推播（FCM/APNs）**：獨立下一輪（需 Apple APNs 憑證 + 新 EAS build + 真機測 + token 註冊）。
- **Tab bar 未讀紅點**：現有未讀點只在通知頁內；抽 badge 到 tab bar 屬加值，本輪不做。
- **單則已讀的持久化**：lastReadAt 是時間戳模型，只精確表達「整頁看到哪」；單則點擊
  維持記憶體 UX（不持久化）。
- **一次補追多期**：CF 停擺多日的追趕，沿用 PR #8「每次每人推進一期」（正常每日觸發足夠）。

## Approach

### A. Rollover — 收割 PR #8，不整包 merge

**只 cherry-pick／手抄這 3 個 additive 檔 ＋ index.ts 一行 export：**
- `functions/src/lib/recurrence.ts`（143 行純函式核心：`computeNextDue` + `rolloverRecurringTasks`）
- `functions/src/rolloverRecurringTasks.ts`（20 行 onSchedule 殼，`every day 00:10` `Asia/Taipei`）
- `functions/src/__tests__/rolloverRecurringTasks.test.ts`（170 行 = 11 單元測試）
- `functions/src/index.ts`：新增一行 `export { rolloverRecurringTasksScheduled } from './rolloverRecurringTasks';`

**紅線**：`pr8-audit-reference` 比 main 舊（同 commit 刪了 main 已有的 `removeFamilyMember`、
`src/lib/instances.ts`、改了 `onTaskInstanceApproved`）。**絕不整支 merge**，只取上述 4 處。

**已驗可收割**（讀過原始碼）：
- `computeNextDue` daily/weekly 為純加天數（+1/+7），時刻不變、不受 CF 環境 UTC 時區影響；
  monthly 用 setDate 邊界處理，UTC 環境自洽。時區只在排程觸發時間需 Asia/Taipei（殼已設）。
- `rolloverRecurringTasks` 掃 `tasks where status=='active'`（單欄位）＋每 task `taskInstances
  where taskId==X`（單欄位）→ **不需複合索引**（比偵察預估省事）。
- 冪等：以下一期 periodEnd 1 秒容差比對現有 instance，重複執行不重生。
- status 機：latest 為 pending/rejected→missed；submitted→保留（續等審核，上一期存活）；
  approved→終結；四者都不阻擋建下一期。
- childId/欄位對得上 main（`latest.childId ?? userId` fallback、確定性錢包不受影響）。

### B. 通知已讀 — lastReadAt 時間戳模型

**為何用時間戳而非 readIds 陣列**：合成通知會隨底層 doc 狀態改變而消失（任務審核後
就不再是 submitted），readIds 陣列會累積孤兒 id、需清理；lastReadAt 時間戳零維護、不膨脹。

**改動點**（每處已定位）：
- `src/types/models.ts` `User` interface：加 `notifLastReadAt?: FirebaseFirestoreTypes.Timestamp | null`。
- `src/app/child/(tabs)/notif.tsx`：`readIds` useState → 讀 `users/{uid}.notifLastReadAt` 初值；
  未讀 = `reviewedAt > notifLastReadAt`；「全部標示已讀」→ `users/{uid}` set `{notifLastReadAt:
  serverTimestamp()}` merge。（通知時間欄位＝`reviewedAt`，notif.tsx:82,91 已在讀）
- `src/app/parent/(tabs)/notif.tsx`：同上；通知時間＝`sortDate`（task 用 `submittedAt`、
  order 用 `createdAt`，notif.tsx:25,62 已在算）。
- **rules 不需改**：`users` 的 `allow update: if request.auth.uid == userId`（firestore.rules）
  本人已可寫自己的 doc。

## 資料流（組件少，無循環）

```
[每日 00:10 台北]
  rolloverRecurringTasksScheduled (CF, admin)
    ├─ 讀 tasks(status=active)
    ├─ 讀 taskInstances(taskId==X) → 每人最新一期
    ├─ 過補交期且 pending/rejected → update status=missed
    └─ 建下一期 taskInstances(status=pending)   ← 客戶端 onSnapshot 自動看到新任務

[通知頁]
  child/parent notif.tsx  ──讀初值/寫已讀──►  users/{uid}.notifLastReadAt
  未讀 = 通知時間戳 > notifLastReadAt
```

## 測試路徑

**Rollover**：
- 收割的 11 單元測試（`emulators:exec` 跑，核心純函式）：daily/weekly/monthly 推期、
  月底邊界、pending→missed、submitted 保留、冪等不重生、once 不重生。
- E2E 補一段（`core-loop-e2e.cjs`）：建一筆「昨天到期」的 daily instance → 跑
  `rolloverRecurringTasks(db, now)` → 斷言舊 instance=missed ＋ 出現今天的新 pending instance。
- 模擬器實測：造過期任務 → 手動觸發 CF（或 admin 呼叫核心）→ App 看到「錯過」＋新任務。

**通知已讀**：
- app jest（若 notif 有測試）＋型別編譯。
- 模擬器實測：通知頁按「全部標示已讀」→ 殺掉重開 App → 仍為已讀（跨 session 持久）。

## 依賴 / 憑證

- **無新外部依賴**：`onSchedule` 已用於 autoCompleteDeliveredOrders；Firestore 已用。
- **無新 API key / 憑證 / 帳號**。
- 部署：`firebase deploy --only functions,firestore:rules`（rules 本輪不變，可只部 functions）；
  排程 CF 落 us-central1，部署後於 GCP 確認 Cloud Scheduler job 已建立（emulator 不觸發排程）。

## 回滾

- Rollover CF 為 additive：`git revert` ＋ redeploy（或 GCP 刪 Scheduler job）即停，不動既有資料。
  已被錯標 missed 的 instance 可由家長端「復活」（missed→pending，rules 已支援）。
- `notifLastReadAt` 為 additive 欄位：不影響舊資料；移除只需還原 notif.tsx 兩檔。

## Unknowns（明確 defer）

- **追趕落差**（owner：未來，defer）：CF 停擺多日只每天補一期。首批小規模試用無感，
  規模化再評估「一次補多期」。
- **graceDays 來源對齊**（owner：不阻擋）：PR #8 用 `task.graceDays ?? 2`；main 的
  `Task.graceDays` 為必填，fallback 幾乎用不到。維持收割原樣。

## 閘門（實作後）

tsc 0、functions jest（含 +11 rollover）、app jest、E2E（+rollover 段）、模擬器雙項實測。
