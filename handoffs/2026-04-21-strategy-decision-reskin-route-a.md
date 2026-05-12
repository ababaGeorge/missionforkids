# Handoff: mfk 路線決策 — 選 A（iOS + 重刻 UI 對齊 Claude Design 設計稿）

## Session Metadata
- Created: 2026-04-21
- Project: /Users/ababa_george/conductor/workspaces/missionforkids/manado（manado workspace）
- Session 實際執行目錄: `/Users/ababa_george/`（純策略盤點，沒有改任何程式碼）
- Session duration: 約 45 分鐘

## Handoff Chain

- **Continues from**: `manado/handoffs/2026-04-17-181620-ui-fixes-and-codex-review.md`（iOS app 最新狀態）
- **Related**: `~/Desktop/missionforkids project/missionforkids/handoffs/2026-04-22-161504-push-to-github-and-vercel-deploy.md`（Claude Design prototype 部署到 Vercel）
- **Supersedes**: None

> 使用者在上一個 session 把 Claude Design 產出的 web prototype 部署到 Vercel 給同事試玩。本 session 做策略盤點，釐清 prototype 與既有 iOS app 的關係，並決定下一階段開發路線。

## Current State Summary

使用者原本不清楚：
- 既有後端還能不能用
- prototype 跟 iOS app 怎麼接
- 要不要開 Conductor 繼續

本 session 完成的事：
1. 確認 **manado workspace 的後端完整且全部已部署**（Firebase 專案、7 個 Cloud Functions、Firestore rules、Storage rules、資料模型、Auth 系統）
2. 確認 **prototype（core_loop）是 web，manado 是 iOS App**，兩邊前端不能共用
3. 使用者**決定走路線 A**：保留既有 iOS App 框架與後端 → 把 Claude Design prototype 當設計稿 → **重刻 React Native UI** 對齊新設計
4. 產出螢幕對照表（下方「Pending Work」）

## Codebase Understanding

### Architecture Overview

- **Client**: Expo 54 + React Native + TypeScript（iOS App，bundle ID `com.missionforkids.app`）
- **Backend**: Firebase（Firestore + Auth + Storage + Cloud Functions）
  - Firebase 專案：`mission-for-kids`（專案編號 369701963332）
  - Firestore：asia-east1
  - Cloud Functions：us-central1
- **Build**: EAS Build 雲端建置（Xcode 26 相容性問題讓本機 build 不可行）

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `src/app/child/(tabs)/tasks.tsx` | 孩子任務主畫面 | 🔴 重刻優先：Claude Design 01 Home（hero card 60% 螢幕） |
| `src/app/child/(tabs)/ai.tsx` | AI Playground | 🔴 重刻：對應 prototype 03/04（camera + AI owl） |
| `src/app/child/(tabs)/rewards.tsx` | 孩子獎勵店 | 🟡 改 UI：對應 prototype 07/08 |
| `src/app/parent/(tabs)/review.tsx` | 家長審核 | 🟡 改 UI：對應 prototype 10 |
| `src/app/parent/(tabs)/tasks.tsx` | 家長派任務 | 🟡 改 UI：對應 prototype 09 |
| `src/components/CelebrationOverlay.tsx` | 慶祝動畫 | 🔴 重刻：對應 prototype 06（全螢幕 indigo 星空） |
| `functions/src/*.ts` | 7 個 Cloud Functions | ⚪ **不動**（後端邏輯保留） |
| `firestore.rules`、`storage.rules`、`firestore.indexes.json` | 安全規則與索引 | ⚪ **不動** |

### Key Patterns Discovered

- **新 UI 的設計來源**：Claude Design prototype，位於 `~/Desktop/missionforkids project/missionforkids/core_loop/`（GitHub 上 `ababaGeorge/missionforkids` master 分支）
- **可參考的線上 prototype**：
  - 三方向瀏覽：https://missionforkids.vercel.app/
  - 互動版：https://missionforkids.vercel.app/prototype.html
- **prototype 的 10 個螢幕地圖**在 `core_loop/PLAN.md`（3 個方向 A/B/C，使用者選 A · Warm Flat textbook — 遵循 DESIGN.md）

## Work Completed

### Tasks Finished（本 session 都是決策，不是實作）

- [x] 盤點 manado workspace 發現完整後端與 iOS app 已建置
- [x] 盤點 Claude Design prototype 為 web-only，與 iOS 前端不能共用
- [x] 使用者決策：走路線 A — 重刻 iOS UI 對齊 prototype 設計，保留後端
- [x] 產出螢幕對照表（iOS 現有 9 個 tab vs prototype 10 個螢幕）
- [x] 釐清架構文件哪些是根本（資料模型、產品決策、任務系統模組 → 🟢 根本；舊設計文件 → 🔴 過期被取代）

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| 選路線 A（iOS + 重刻 UI） | B (Web app)、C (雙軌) | 使用者本來就要做 iOS（從 bundle ID 可看出），後端已全部對準 iOS 情境 |
| Claude Design prototype 的定位 | 變成真產品、當設計稿 | 當設計稿——可互動的規格書 |
| 是否開 Conductor 新 workspace | 開 / 不開 | 不開，單線工作直接在 manado 跑 |
| 架構文件權威性 | 新舊並存 / 汰換 | 🟢 資料模型 v1、決策文件 v1.1、任務系統模組 v1.0 為根本；🔴 `design-core-loop-ai-demo.md` 已被 Claude Design 取代 |

## Pending Work

### Immediate Next Steps（依重要性排序）

**Phase 1 — 核心迴圈重刻（優先）**
1. `src/app/child/(tabs)/tasks.tsx` → 對齊 prototype 01 Home（hero task card 60% 螢幕）
2. Camera 流程 → 對齊 prototype 03（加入 owl mascot "Pip"）
3. `src/app/child/(tabs)/ai.tsx` → 對齊 prototype 04 AI reviewing
4. `src/components/CelebrationOverlay.tsx` → 對齊 prototype 06（全螢幕慶祝）

**Phase 2 — 兌換迴圈**
5. `src/app/child/(tabs)/rewards.tsx` → 對齊 prototype 07 Reward store + 08 Order progress

**Phase 3 — 家長端**
6. `src/app/parent/(tabs)/review.tsx` → 對齊 prototype 10 Review queue
7. `src/app/parent/(tabs)/tasks.tsx` → 對齊 prototype 09 Assign task

**Phase 4 — 之前未實作的功能**（前一個 handoff 留下）
- AI 半自動審核 flow（AI 初審 → 家長 48hr 覆審窗口 → 自動核准）
- 週期任務自動建下一期 instance（需 Cloud Function）
- Grace period 到期自動標記 missed（需 scheduled function）
- 照片 90 天自動清理
- Push notifications（每日 23:59 批次通知）
- 模擬器底部 TypeError 紅條確認

**保留不重刻的螢幕**（prototype 沒畫到）：
- `child/(tabs)/points.tsx`
- `parent/(tabs)/family.tsx`
- `parent/(tabs)/rewards.tsx`

### Blockers/Open Questions

- [ ] OpenAI API key 仍需更換（前 handoff 留下的）
- [ ] Google Sign-In 需要找與 Firebase 12 相容的方案
- [ ] Apple Sign-In 等 Apple Developer 驗證
- [ ] 模擬器底部 TypeError 紅條根因未確認（可能是 deep link handler）

## Context for Resuming Agent

### Important Context

**最關鍵四件事**：

1. **後端完全不要動**。Firebase 專案、7 個 Cloud Functions、Firestore rules、Storage rules、資料模型全部已上線運作。重刻只改 `src/app/**` 跟 `src/components/**` 的 React Native UI。

2. **設計稿來源是 Vercel 上的 prototype**（不是舊的 `docs/design-core-loop-ai-demo.md` — 那份已被取代）：
   - 三方向瀏覽：https://missionforkids.vercel.app/
   - 互動版：https://missionforkids.vercel.app/prototype.html
   - 本機檔案：`~/Desktop/missionforkids project/missionforkids/core_loop/`
   - 使用者選定**方向 A · Warm Flat textbook**（遵循 DESIGN.md 的保守版）

3. **Build 配置已鎖定**（`manado/CLAUDE.md` 和 `manado/.claude/rules/expo-rn-firebase.md` 有紀錄）：
   - RNFB v24 + Firebase iOS SDK 12.10.0 + `useFrameworks: "static"` + `forceStaticLinking`
   - EAS image Xcode 16.3
   - 不要升級或調整這些

4. **pointWallets 和 pointTransactions 禁止 client 寫入**，所有點數操作走 Cloud Functions。重刻 UI 時要保留現有的 Cloud Function 呼叫邏輯，不要改成 client 端直接寫。

### Assumptions Made

- 使用者是產品決策者不寫 code，所有程式碼變更由 AI 執行，只在需要時請使用者看模擬器結果或 GitHub 點 merge
- 使用者會 `cd` 到 manado workspace 開新 Claude Code session（不用 Conductor UI）

### Potential Gotchas

- **manado workspace 最後 commit 時間是 2026-04-17**，距今幾天，先 `git status` + `git pull` 確認乾淨
- **手動 TypeError 紅條**：上 session 留下的，可能重開 app 就消失。先測試看狀況再決定要不要修
- **重刻策略**：Claude Design prototype 是 web + 虛擬資料（localStorage），重刻到 iOS 時要把它接到真正的 Firestore query（既有 hook 如 `useAuth`、`useFamily` 保留）
- **Node 版本**：PATH 要包 `/opt/homebrew/opt/node@22/bin`，不能用系統預設（可能是 25）

## Environment State

### Tools/Services Used

- **Firebase**：`mission-for-kids` 專案，所有服務運作中
- **EAS Build**：project ID `569558f4-09ae-440f-b5d6-e6592d94b972`
- **Expo**：帳號 `ababa_george`
- **模擬器**：iPhone 17 Pro (B4436202-581F-4922-8D3A-B2CAA91273DE)
- **GitHub**：既有後端 commits 在 manado workspace；前端 prototype 在 `ababaGeorge/missionforkids` repo

### Active Processes

- 無（需要時重新啟動 Expo dev server）

### Environment Variables

- `OPENAI_API_KEY`（Firebase Secret Manager）

## Related Resources

- Prototype（設計稿）：https://missionforkids.vercel.app/prototype.html
- Prototype 10 螢幕地圖：`~/Desktop/missionforkids project/missionforkids/core_loop/PLAN.md`
- 產品決策（根本）：`docs/任務獎勵App_決策文件.md`
- 資料模型（根本）：`docs/資料模型_v1.md`
- 任務系統模組（根本）：`docs/任務系統模組決策文件_v1.0.md`
- 上一個 iOS app handoff：`handoffs/2026-04-17-181620-ui-fixes-and-codex-review.md`
- Web prototype 部署 handoff：`~/Desktop/missionforkids project/missionforkids/handoffs/2026-04-22-161504-push-to-github-and-vercel-deploy.md`

---

**Security Reminder**: 本 session 沒有產出程式碼，也沒碰 secrets。無需 `validate_handoff.py`。
