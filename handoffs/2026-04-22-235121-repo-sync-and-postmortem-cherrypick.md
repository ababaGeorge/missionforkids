# Handoff: missionforkids repo 三邊同步檢查 + EAS postmortem 備份與 cherry-pick 到 master

## Session Metadata
- Created: 2026-04-22 23:51:21
- Project: /Users/ababa_george/Desktop/missionforkids project/missionforkids
- Branch: master
- Session duration: ~40 分鐘

### Recent Commits (for context)
  - 052c175 Add EAS Build postmortem: 15 pitfalls across 20+ failed builds
  - 40ebbd6 Merge pull request #3 from ababaGeorge/chore/vercel-config
  - b733ab6 Add vercel.json to serve core_loop/ as site root
  - 98adc21 Merge pull request #2 from ababaGeorge/feat/core-loop-css-fix
  - d24e661 Add colors_and_type.css and fix stylesheet paths

## Handoff Chain

- **Continues from**: [2026-04-22-161504-push-to-github-and-vercel-deploy.md](./2026-04-22-161504-push-to-github-and-vercel-deploy.md)
  - Previous title: 把 Claude Design 產出的前端 prototype 上 GitHub + 部署 Vercel
- **Supersedes**: None

> Review the previous handoff for full context before filling this one.

## Current State Summary

使用者不確定桌面 missionforkids 專案跟 GitHub 是否一致，要求檢查。本 session 完成了三邊（桌面本地 / GitHub / Conductor workspaces）對照，找到兩個差異並全部處理：(1) 本地 master 落後 origin/master 兩個 commit（已 fast-forward）、(2) manado workspace 有一份價值高的 EAS Build postmortem 只存在該 worktree 沒備份到 GitHub（已 push 分支備份 + cherry-pick 到 master）。三邊狀態全部對齊，無 pending 工作。順便設定了 git global user.name / user.email。

## Codebase Understanding

### Architecture Overview

- 主幹分支是 `master`（不是 `main`）
- Conductor workspaces 位於 `~/conductor/workspaces/missionforkids/`，每個 worktree 分一個分支（marseille/muscat/manado/kathmandu 等），平行實驗用，**本來就該跟 master 分歧**
- 桌面 repo 跟 Conductor worktrees 共用同一個 `.git` 物件庫（所以 3edf124 這個 commit 即使沒 push 也能在桌面 repo cherry-pick）
- iOS app 實作在 manado workspace，桌面 repo 主要是 `core_loop/` 前端 prototype

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `docs/postmortem-eas-build-hell.md` | EAS Build 20+ 次失敗的完整踩坑紀錄（Expo 54 + RNFB + Firebase iOS SDK） | 下次遇 iOS build 問題先翻這份，157 行 |
| `vercel.json` | core_loop/ 當 site root 的部署設定 | Vercel 部署同事試玩用的前端 prototype |
| `~/conductor/workspaces/missionforkids/manado/` | 主要 iOS app 實作地點 | 後端整合 / React Native UI 重刻 |

### Key Patterns Discovered

- Conductor workspace 有未追蹤變更跟未 commit 的 working state 是常態，不等於遺失工作
- `git branch -vv` 輸出中 `+` 前綴 + 路徑括號代表「其他 worktree 檢出的分支」— 共享 .git，不會衝突

## Work Completed

### Tasks Finished

- [x] 三邊對照（桌面 / GitHub / 4 個 Conductor workspaces）
- [x] Fast-forward 本地 master 到 origin/master（拉到 vercel-config PR #3 合併結果）
- [x] 在 manado workspace push `ababaGeorge/office-hours` 分支到 GitHub 備份
- [x] Cherry-pick 3edf124（EAS postmortem）到桌面 repo 的 master 並 push
- [x] 設定 git global user.name=ababaGeorge / user.email=ababaplanet@gmail.com

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `docs/postmortem-eas-build-hell.md` | 新增（cherry-pick 自 3edf124） | 讓主幹也有這份踩坑紀錄，未來搜尋查閱最快 |
| `~/.gitconfig` (global) | 加 user.name / user.email | 之前是 hostname 預設，每 commit 都跳警告 |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| 採用 A + cherry-pick 雙軌備份 | A: 只 push 分支到 GitHub / B: 只複製文件到 master / A+B | 單做 A 未來要找文件得記得在 office-hours 分支；單做 B 失去 commit 時間脈絡。雙軌讓備份與主幹都有 |
| Conductor 其他分支不 push | 全部 push 備份 / 全不動 / 選擇性 push | `design-consult` `eng-review-plan` `plan-design-rev` 都只有 initial commit 沒實質內容，push 沒意義；`office-hours` 有 157 行實質 postmortem 才值得 |
| 不透過 PR 合併到 master | 開 PR / 直接 cherry-pick push | 純文件、不動程式碼、單人專案，PR 是多餘流程 |

## Pending Work

### Immediate Next Steps

1. 無 — 本 session 任務已完整收尾，三邊狀態一致
2. 若要繼續前一 handoff（Claude Design prototype 上 Vercel），接續那邊的 pending 項目
3. 若要繼續 iOS 重刻工作，在 manado workspace 跑 Claude Code 接續 session-20260421-evening 的路線 A

### Blockers/Open Questions

- [ ] 無

### Deferred Items

- 無

## Context for Resuming Agent

### Important Context

**最關鍵的一個認知**：Claude Code 的 shell 環境**無法存取使用者 Terminal.app 的 macOS Keychain**（沙箱隔離 + Claude Code 本身 credential guardrail 雙重阻擋）。這代表任何需要 GitHub HTTPS 認證的 git push 操作都**必須請使用者在他自己的 Terminal 執行**，不要浪費時間嘗試 gh auth login、credential helper 重設等流程。給使用者的指令要用**單行形式**，不要用多行反斜線（會讓他的 zsh 卡在 `cmdand>` continuation prompt）。

本地操作（checkout、merge --ff-only、cherry-pick、fetch public repo）都可以 AI 直接做，不需要認證。

### Assumptions Made

- Public repo 的 `git fetch` 不需要認證（驗證為真，之前 fetch 有跑過）
- Conductor workspaces 跟桌面 repo 共享同一個 .git 物件庫（驗證為真，cherry-pick 3edf124 找得到 commit）
- Cherry-pick 純文件 commit 到 master 不會影響 build / Vercel 部署

### Potential Gotchas

- 桌面 repo 位置是 `~/Desktop/missionforkids project/missionforkids/`（中間有空格的 `missionforkids project` 子資料夾），不在 Desktop 根目錄
- 專案用 `master` 不是 `main`
- 給使用者的 shell 指令不要有反斜線換行
- `gh auth status` 可能顯示「Failed to log in / token invalid」但其實使用者當下的 Terminal 認證是有效的 — 不要被這個訊息誤導反覆叫使用者重登

## Environment State

### Tools/Services Used

- gh CLI（使用者端有效，Claude shell 端無效 — 參考 Important Context）
- git worktree（Conductor 底層使用）

### Active Processes

- 無長駐進程需要交接

### Environment Variables

- 無相關 env var

## Related Resources

- 前一個 handoff：[2026-04-22-161504-push-to-github-and-vercel-deploy.md](./2026-04-22-161504-push-to-github-and-vercel-deploy.md)
- EAS postmortem 文件：`docs/postmortem-eas-build-hell.md`（本次 cherry-pick 進 master）
- Conductor workspace：`~/conductor/workspaces/missionforkids/manado/`（iOS app 實作主地點）

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
