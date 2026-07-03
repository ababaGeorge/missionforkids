---
status: completed
branch: main
timestamp: 2026-05-19T14:21:39+0800
session_duration_s: 61020
files_modified:
  - handoffs/ (4 個 dated handoff md，未追蹤，敘事備份用)
---

## Working on: missionforkids 主線切換 — office-hours → main

### Summary

把 `ababaGeorge/missionforkids` 的 GitHub 主線從過時的原型線（master，只有 core_loop 設計稿）
換成真正的 App 開發線。原工作在 Conductor worktree `manado`（branch `ababaGeorge/office-hours`，
HEAD `172749a`），含 4 個未 push 的真實成果。已完成 A 方案（不改寫歷史）：push → 改名 main →
設為 GitHub 預設分支 → 加輕量保護 → 退 manado worktree → 主資料夾對齊。三邊（GitHub / 主
資料夾 / origin）全部對齊在 `main` `172749a`。整個大任務乾淨結束。

### Decisions Made

- **A 方案（改 GitHub 預設分支，不改寫歷史）**：不 force-push、不刪舊 master，完全可逆。
  原因：使用者要安全、可反悔，舊 master 的 core_loop 隨時撈得回。
- **分支改名 `main`**：office-hours 名字跟內容（真 App）已對不上，改成業界慣例 main。
- **輕量分支保護**：擋 force-push + 擋刪除，但本人可直推（不強制 PR）。原因：單人開發，
  全走 PR 會拖慢，但防意外摸掉歷史有價值。
- **發現並澄清**：原 handoff 宣稱 master 有「branch protection」，查證 GitHub API 為
  404「Branch not protected」——那層其實是 Claude Code 本機權限規則，不是伺服器規則。
  所以步驟 4 是「新裝保護」不是「搬保護」。
- **core_loop/ 確認**：是 Claude Design 產出的設計稿 HTML（A/B/C 三方向），不是重要網站；
  Night Sky 方向 C 已做進真 App，原型任務已完成。Vercel 預覽頁會停可接受。
- **保留 manado 的 dated handoff 筆記**：退 worktree 前已複製到主資料夾 handoffs/。

### Remaining Work

1. **下次起點：使用者改在 `~/Desktop/missionforkids project/missionforkids` 直接開發**
   （已對齊 main，單一直觀，不再進 Conductor worktree 路徑）。
2. dev 捷徑（commit `172749a`：以現有小孩進入 / 假提交）正式上線前要加 `__DEV__` gate
   或移除。
3. 小孩端是否顯示家長設的暱稱 —— 產品決定，待使用者拍板。
4. auto-mode classifier 部署白名單需使用者本人加（/permissions 或編
   `.claude/settings.local.json`）—— 本 session 已遇到一次 classifier 擋刪遠端分支。
5. （可選改善）office-hours 版 `.gitignore` 沒擋裸 `.env`，建議補一行（目前無 .env，零風險）。

### Notes

- **三邊狀態**：GitHub 預設分支 = main；主資料夾 = main 172749a 與 origin 同步；
  origin/main = 172749a。
- **保留沒動**：遠端 master / feat/core-loop-* / chore/vercel-config（舊原型線備份）；
  Conductor worktree kathmandu / marseille / muscat（與本次無關，marseille 有 104 個
  gstack skill 檔改動是工具漂移非產品碼，沒碰）。
- **已刪**：遠端 `ababaGeorge/office-hours`（與 main 同 commit，重複，零損失）；
  manado worktree（工作 100% 已在 main，handoff 筆記已保留）。
- **副作用（預期）**：`missionforkids.vercel.app` 設計稿預覽頁之後會停（Vercel 改 build
  main，無 core_loop/），內容仍在舊 master 可撈。
- **Claude Code session cwd 是 `~/Desktop/glab`（非 git repo）**，本次工作全在
  missionforkids repo，slug 用 `ababaGeorge-missionforkids` 存對地方。
- 本 session 跑了 /context-restore（無 checkpoint）開場，使用者貼上一段舊結束狀態，
  經驗證後接手——驗證發現工作在 manado worktree 不在主 clone。
