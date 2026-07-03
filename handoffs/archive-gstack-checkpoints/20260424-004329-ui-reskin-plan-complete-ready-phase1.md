---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-04-24T00:43:29+08:00
files_modified:
  - src/design/tokens.ts
  - src/app/child/(tabs)/_layout.tsx
  - src/app/child/(tabs)/me.tsx
  - src/app/child/(tabs)/notif.tsx
  - src/app/child/(tabs)/tasks.tsx
  - src/app/child/(tabs)/rewards.tsx
  - src/app/parent/(tabs)/tasks.tsx
  - src/app/parent/(tabs)/review.tsx
  - src/app/parent/(tabs)/rewards.tsx
  - src/app/parent/(tabs)/family.tsx
  - src/app/child/task/[id].tsx
  - src/app/child/order/[id].tsx
  - src/app/child/reward/[id].tsx
  - docs/ui-spec-c2.md
  - firestore.rules
  - functions/src/index.ts
---

## Working on: UI Reskin — Plan Complete, Ready for Phase 1

### Summary

完成了整個 UI reskin 的計畫階段。問題根因已確認：實作時只讀了 `screens_c.jsx`（舊版），而最新設計規格在 `screens_c2.jsx`，且還有 `prototype_child2.jsx`、`prototype_parent2.jsx` 等互動流程檔案完全未讀。已產出完整的規格翻譯文件 `docs/ui-spec-c2.md`，並確認全站使用單一調色盤（深藍 `#1E2547`，無分主畫面/彈出畫面）。同時本 session 也修了多個 onSnapshot null crash、permission-denied、提交上限等 bug，新增了第 4 個通知 tab。

### Decisions Made

- **UI 規格來源**：`screens_c2.jsx` + `prototype_child2.jsx` + `prototype_parent2.jsx` 為唯一設計真相來源，舊版 `screens_c.jsx` 和 `prototype_shared.jsx` 廢棄
- **調色盤**：全站統一 `#1E2547` 深藍，已更新 `tokens.ts`（廢棄舊版 `#0B0E1A` 近黑色）
- **i18n**：v1.0 鎖定繁體中文，不做雙語
- **相機功能**：使用 `expo-image-picker`（已安裝），不需要另加 `expo-camera`
- **成就系統**：Phase 4 保留 placeholder UI，等後端 Cloud Function 完成再串
- **任務提交上限**：不設硬性次數上限，改為「新提交覆蓋舊的，父母只看最新一張」
- **第三審查**：使用 `/codex` skill（不需要使用者在場）
- **Codex 第三審**：每個 Phase 固定跑，流程：實作 → coderabbit → /codex → 使用者確認截圖
- **OPENAI_API_KEY**：昨天已設定到 Firebase Secrets，今天確認存在。使用者需換新 key（舊 key 在對話中暴露）

### Remaining Work

1. **[Phase 1 — 下一個 session 開始]** 執行 Design tokens 更新、字型 loading（useFonts + splash）、共用元件對齊、safe area 規則統一
2. **[Phase 2]** 孩子 Tab 結構（4 tabs 順序修正：任務→獎勵→通知→我的）+ Tasks + Rewards 畫面
3. **[Phase 3a]** Task Detail 畫面
4. **[Phase 3b]** 相機 + 上傳 Firebase Storage + 呼叫 analyzePhoto + 等待/結果畫面
5. **[Phase 4]** Celebrate + Me（placeholder 成就）+ Notif
6. **[Phase 5]** 家長端 Tasks + Review + 48h 倒數顯示
7. **[Phase 6]** 家長端 Rewards + Settings + Notif（家長端 5 個 tab）
8. **[Phase 7]** 整合測試 + EAS Build + TestFlight 真機測試
9. **[待辦]** 使用者需執行 `! firebase functions:secrets:set OPENAI_API_KEY` 更新被暴露的 key

### Notes

**每個 Phase 固定流程：**
實作 → `npx tsc --noEmit`（零錯誤）→ 模擬器截圖 → coderabbit → /codex → 使用者確認 → /context-save → 進下一 Phase

**規格文件位置：** `docs/ui-spec-c2.md`（每個 session 開始必讀對應章節）

**Tab 順序問題（已知待修）：**
- 孩子端規格：任務(✦) → 獎勵(♡) → 通知(◉) → 我的(☽)（現在 me 和 notif 順序互換）
- 家長端規格：5 個 tab，現在只有 4 個（缺通知）

**已修的 bugs（本 session）：**
- 所有 onSnapshot 加 null guard + error handler（23 處，10 個檔案）
- `me.tsx` taskInstances 查詢加 `familyId` filter（修 permission-denied）
- `child/tasks.tsx` taskInstances 同上（待修，下個 session）
- `parent/tasks.tsx` taskInstances sub-query 同上（待修）

**Codex 審查結果中確認要修的項目（下個 session 處理）：**
- `child/order/[id].tsx`：「我拿到了」按鈕只能在 `delivered` 顯示，現在 `approved` 也能點
- `Task` 型別缺 `graceDays: number`
- `RewardItem` 型別缺 `emoji: string | null`
- 審核頁 48h 自動通過倒數顯示

**Firebase Storage + analyzePhoto 後端狀態：**
- `storage.rules` 已完整設定（`families/{familyId}/submissions/`）
- `analyzePhoto` Cloud Function 完整實作（OpenAI gpt-4o-mini Vision）
- Phase 3b 純前端工作

**iOS 模擬器：** iPhone 17 Pro (B4436202-581F-4922-8D3A-B2CAA91273DE)，Metro 在 port 8081
