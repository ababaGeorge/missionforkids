---
status: completed
branch: master
timestamp: 2026-04-23T02:37:39+08:00
files_modified: []
---

## Working on: CLAUDE.md 稽核與整合

### Summary

針對使用者全域與各專案的 CLAUDE.md 做全面稽核，修正冗餘與不一致，並把 missionforkids 的 CLAUDE.md 提升為 master 的 single source of truth（取代各 Conductor workspace 各自維護 untracked 檔的分裂現況）。本輪工作已全部完成並合併 PR #4。

### Decisions Made

- **_template/CLAUDE.md** 改寫為通用 placeholder 模板（原先跟 todo-cli 內容 100% 相同，名不符實）
- **marseille 的 gstack 極簡版 CLAUDE.md 不動**（使用者 B 決策：gstack 流程特性保留）
- **manado 版的完整 CLAUDE.md 升格為 master 單一來源**（使用者 C1 決策，理由：技術棧、Firebase ID 屬專案基本事實，不該是某 feature branch 的產物）
- **走 PR 流程而非直接 push master**（repo 有 hook 擋 direct-to-master push）
- **cli-interactive.md 全域規則更新**：`gh auth login` 不能靠另開 Terminal.app，必須用 `! 前綴` 在 Claude Code session 內跑（證實 Claude Code shell 與 Terminal.app 不共享 gh token）

### Remaining Work

1. **另一個 CLI session（跑 manado workspace，branch `ababaGeorge/office-hours`）** 告一段落時，ababaGeorge 要貼 relay 訊息給它，處理本地 untracked CLAUDE.md（見 notes）
2. **Worktree/branch 清理**：使用者決定「等專案完成再處理」，暫緩。目前 4 個可安全刪除的本地分支（`ababaGeorge/plan-design-review`、`chore/vercel-config`、`feat/core-loop-css-fix`、`feat/core-loop-frontend`）和對應 3 個 remote 分支
3. 「先記著」的 TDD 相關討論——使用者先前表示要記下後處理 Playwright 截圖，截圖完成後繼續 CLAUDE.md 稽核，TDD 尚未回訪

### Notes

- **Merged commit**：`81b566f Add CLAUDE.md and workspace sync rule (#4)`（含 root CLAUDE.md + `.claude/rules/claude-md-workspace-sync.md`）
- **所有 Conductor workspace 合併 master 前**，要檢查 `git status` 裡的 untracked CLAUDE.md：
  - manado（office-hours branch）：內容應與 master 一致，可 `rm CLAUDE.md && git pull`
  - marseille（design-consult branch）：是 gstack 流程的極簡版，**不能直接刪**，要先備份（建議移到 `.claude/rules/gstack-workspace-claude-md.md`）
  - muscat、kathmandu：按情境 A/B/C 邏輯處理（已寫在 relay 訊息裡）
- **使用者已同意 squash merge**，remote `chore/add-claude-md` 分支已自動刪除
- **相關檔案與規則**：
  - 專案 rule：`missionforkids/.claude/rules/claude-md-workspace-sync.md`（含 marseille 特例處理指示）
  - 全域 memory：`~/.claude/projects/-Users-ababa-george/memory/missionforkids_claude_md_sync.md`
  - MEMORY.md 索引已更新
- **gh auth login 細節**：使用者本機驗證過 token 是跟 Claude Code shell session 綁的，`cli-interactive.md` 已更新禁止建議另開 Terminal.app
- **本輪另有小事**：Playwright 截圖 missionforkids.vercel.app 首頁（`missionforkids-homepage.png`，9 支 iPhone 的 Core Loop mockup 展示頁，有 in-browser Babel 警告但不影響 mockup 用途）
