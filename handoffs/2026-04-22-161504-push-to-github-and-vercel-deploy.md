# Handoff: 把 Claude Design 產出的前端 prototype 上 GitHub + 部署 Vercel

## Session Metadata
- Created: 2026-04-22 16:15:04
- Project: /Users/ababa_george/Desktop/missionforkids project/missionforkids
- Branch: master（session 結束時 checkout 在 master，最新 commit 98adc21；額外還有未合併的 chore/vercel-config 分支對應 PR #3 已合併）
- Session duration: 約 30 分鐘

### Recent Commits (for context)
  - 98adc21 Merge pull request #2 from ababaGeorge/feat/core-loop-css-fix
  - d24e661 Add colors_and_type.css and fix stylesheet paths
  - 78c56bf Merge pull request #1 from ababaGeorge/feat/core-loop-frontend
  - 6681450 Add core_loop frontend prototype and .gitignore
  - b733ab6 Add vercel.json to serve core_loop/ as site root（PR #3，使用者合併後本機尚未 pull）

## Handoff Chain

- **Continues from**: None (fresh start)
- **Supersedes**: None

> 這是這個任務的第一份 handoff。前次 missionforkids session（2026-04-21 01:00）結束於「把輸入包 + prompt 丟進 Claude Design 跑第一輪」的 pending 狀態——這個 session 就是接續：使用者在 Claude Design 拿到前端產出後，要把結果 repo 上 GitHub 並部署給同事試玩。

## Current State Summary

使用者用 Claude Design 產出 mission for kids 的前端 prototype（`core_loop/` 目錄，17 個檔案、約 4,754 行），想 push 上 GitHub 讓同事試用。Session 結尾：前端已在 GitHub（`ababaGeorge/missionforkids`），Vercel 也部署成功，URL = **https://missionforkids.vercel.app/**，13 個關鍵資源全部 200 OK 驗證完畢。可直接分享網址給同事。

## Codebase Understanding

### Architecture Overview

- `core_loop/` 是**純前端可點擊 prototype**——沒有後端、沒有 build step
- 用 Tailwind CDN + esm.sh 載 React + Babel standalone 即時轉譯 JSX（每個 screens_*.jsx 都是 `<script type="text/babel" src="...">`）
- 兩個入口：
  - `index.html`：三方向 (A/B/C) 併排瀏覽頁（10 個螢幕 × 3 方向）
  - `prototype.html`：可互動 prototype，兩個 iPhone 框用 `BroadcastChannel` + `localStorage` 同步 parent/child 狀態
- `prototype_store.js` **不是後端** store，是前端 state（localStorage-based）
- 依賴一個共用樣式 `colors_and_type.css`（設計 tokens：顏色、字型、間距、motion），初版被放在 repo 外層，後來修好

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `core_loop/index.html` | 三方向瀏覽頁入口 | 同事看設計就是開這個 |
| `core_loop/prototype.html` | 可互動 prototype | 同事玩互動就是開這個 |
| `core_loop/colors_and_type.css` | 設計 tokens（顏色/字型/間距） | 所有 screens 都依賴 |
| `core_loop/PLAN.md` | 描述 A/B/C 三方向 + 10 個螢幕 | 理解設計意圖 |
| `vercel.json`（repo 根目錄） | `outputDirectory: "core_loop"` 讓網站根目錄 = `core_loop/` | 以後改 Vercel 部署行為要看這 |
| `.gitignore` | 排除 `.DS_Store`、`node_modules`、`.env`、`.vercel/` | 新增時記得保留這幾條 |

### Key Patterns Discovered

- **Git 政策**：這個 repo 有 branch protection，**禁止直接 push 到 master**，必須走 `feature branch → PR → merge`。連 `git commit && git push` 的組合都會被擋（Claude Code 權限規則）。每次改動都要：`git checkout -b <branch> → commit → push -u → gh pr create → 使用者去 GitHub 點 merge`。
- **CSS 相對路徑**：Claude Design 有時會輸出 `../colors_and_type.css`（預期 CSS 在 repo 外層），要改成同層引用並把檔案放進 `core_loop/`，不然 Vercel 上 404。
- **Vercel 子目錄部署**：用 `vercel.json` 的 `outputDirectory: "core_loop"` 把子資料夾當網站根目錄，省掉在 Vercel Web UI 裡手動設 Root Directory。

## Work Completed

### Tasks Finished

- [x] PR #1：把 `core_loop/` 初版 17 個檔案 + `.gitignore` push 上 GitHub（`feat/core-loop-frontend`）
- [x] PR #2：新增 `colors_and_type.css`、修 `index.html` 與 `prototype.html` 的 CSS 引用路徑（`feat/core-loop-css-fix`）
- [x] PR #3：新增 `vercel.json`，設 `outputDirectory: "core_loop"` 讓 `/` 直接是 prototype 而不是 `/core_loop/index.html`（`chore/vercel-config`）
- [x] 使用者從 Vercel Web UI 匯入 `ababaGeorge/missionforkids` 部署，拿到 `https://missionforkids.vercel.app/`
- [x] 用 curl 驗證 13 個資源（主頁、prototype.html、CSS、data.js、所有 JSX）全部 200 OK

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `.gitignore`（新建） | 排除 .DS_Store、node_modules、.env、.vercel | 避免 macOS metadata 跟本地 Vercel link 進 repo |
| `core_loop/*`（17 個檔案） | 新建 | Claude Design 產出的前端 prototype |
| `core_loop/index.html` | `../colors_and_type.css` → `colors_and_type.css` | 原路徑指到 repo 外層的檔案，Vercel 會 404 |
| `core_loop/prototype.html` | `../colors_and_type.css` → `colors_and_type.css` | 同上 |
| `core_loop/colors_and_type.css`（新建） | 設計 tokens 完整樣式表（206 行） | 原先引用但缺檔 |
| `vercel.json`（新建） | `{ "outputDirectory": "core_loop" }` | 讓 Vercel 用 `core_loop/` 當網站根目錄，避免網址含 `/core_loop/` |

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| 走 feature branch + PR 流程 | 放寬權限直接 push master | 使用者主動選了走 PR 流程。雖然是個人 repo，但保留 review 記錄 |
| Vercel 部署走 Web UI 匯入 | CLI `vercel deploy` | `vercel login` 是瀏覽器認證，Claude Code shell 跑不起來（見 `~/.claude/rules/cli-interactive.md`）。Web UI 一次設好自動部署 |
| 用 `vercel.json` `outputDirectory` | 在 Vercel Web UI 手動填 Root Directory | `vercel.json` 進 git、可重現、未來重新匯入也不用再設 |
| 保留 repo 裡 `.claude/skills/gstack/...` | 清掉 | 暫時不動。那堆是舊 initial commit（`e8c56c0`）殘留的 gstack 工具原始碼，跟 app 無關但暫不緊急 |

## Pending Work

### Immediate Next Steps

1. 同事試玩後收集回饋（這是下 session 最可能的入口）
2. 根據回饋改 `core_loop/` 的任何檔案時，流程固定：新分支 → commit → push → PR → merge，Vercel 會在 30 秒內自動重新部署
3. 之後要做的（跨 session）：mfk 原 4 件 pending 仍在（模擬器 TypeError、孩子邀請碼 flow、AI 半自動審核、週期任務自動建下一期）——但那些跟後端有關，不是這次的 prototype 範圍

### Blockers/Open Questions

- [ ] 同事實際體驗網站還沒回報（這是等使用者拿到回饋才有下一步）
- [ ] Git commit 作者是 `李承謙 <ababa_george@lichengqiandeMac-mini.local>`（hostname email），沒連到 GitHub 頭像。使用者知道但決定這次先不改。下次如果在意可以：`git config --global user.email "ababaplanet@gmail.com"` + `git config --global user.name "ababaGeorge"`

### Deferred Items

- **清掉 `.claude/skills/gstack/...`**：這堆檔案跟 mission for kids app 無關（是 gstack 工具原始碼被誤 commit 進初始 commit），但清掉要動歷史不緊急，延後處理
- **git 作者 email 修正**：使用者這次先不改

## Context for Resuming Agent

### Important Context

**最重要的三件事**：

1. **這個 repo 沒有後端**。儘管 repo 根目錄看起來很雜（`.claude/skills/gstack/` 裡有 supabase/functions 目錄很像後端），但那是 gstack 工具庫的原始碼被誤 commit，**跟 mfk app 無關**。實質上整個 app 目前只有 `core_loop/` 這個純前端 prototype，沒有 server、沒有資料庫。

2. **Master 分支不能直接 push**。Claude Code 權限規則（或 GitHub branch protection）會擋下來。每次改都要開分支 + PR。使用者已習慣這個流程。

3. **Vercel 自動部署已經設好了**。只要 master 有新 commit，30 秒內 `https://missionforkids.vercel.app/` 會自動更新，PR 也會有 preview URL。不用再手動部署。

### Assumptions Made

- 使用者是產品決策者不寫 code，所有 git / deploy 動作都由我代跑，只在需要 GitHub UI 點擊（merge PR）或 Vercel UI 操作（匯入 repo）時請使用者動手
- 使用者的 GitHub CLI (`gh`) 已登入（session 開始時驗證為 `ababaGeorge`）
- 使用者 Vercel 帳號是 `ababageorge's projects`（team_oqZ3dHQ0Zc1Ub0zO5ArB6brc）

### Potential Gotchas

- **`&&` 鏈接 commit + push 會被權限規則一起擋下**：不要寫 `git commit ... && git push ...`。拆開兩步，或直接在 feature branch 上 commit，然後再 push（push 到非 master 分支是允許的）
- **`vercel login` 在 Claude Code shell 不能跑**：需要瀏覽器認證。以後如果真的要用 CLI 部署，使用者得在獨立 Terminal.app 跑一次 `vercel login`，之後 token 全域生效
- **`.DS_Store` 會被 macOS 自動產生**：已在 `.gitignore` 排除，但如果 session 開始 `git status` 看到它，不要急著 commit 進去
- **前端純靜態**：不能加 serverless function、Vercel functions、API routes，因為 `outputDirectory: "core_loop"` 讓 Vercel 把 `core_loop/` 當 static output，沒有 build step

## Environment State

### Tools/Services Used

- **GitHub**：`ababaGeorge/missionforkids` repo，branch protection 開啟
- **GitHub CLI (`gh`)**：已登入 `ababaGeorge`，scope 有 `gist, read:org, repo, workflow`
- **Vercel**：team `ababageorge's projects`、新建專案 `missionforkids`、部署 URL `https://missionforkids.vercel.app/`，GitHub 整合已啟用（master push 自動部署）
- **Vercel MCP**：`deploy_to_vercel`（zero-param tool）實際上會要求走 CLI 或 git push；`web_fetch_vercel_url` 可抓部署後的頁面驗證
- **Vercel CLI**：**未安裝**（不需要，Web UI 已搞定）

### Active Processes

- 無

### Environment Variables

- 無 session 相關的環境變數

## Related Resources

- GitHub repo：https://github.com/ababaGeorge/missionforkids
- PR #1（初版 push）：https://github.com/ababaGeorge/missionforkids/pull/1
- PR #2（CSS 修正）：https://github.com/ababaGeorge/missionforkids/pull/2
- PR #3（vercel.json）：https://github.com/ababaGeorge/missionforkids/pull/3
- 部署網址（三方向瀏覽頁）：https://missionforkids.vercel.app/
- 可互動 prototype：https://missionforkids.vercel.app/prototype.html
- Claude Design 輸入包：`~/Desktop/mfk-claude-design-input/`（前次 session 建立）
- 設計計畫：`core_loop/PLAN.md`

---

**Security Reminder**: Before finalizing, run `validate_handoff.py` to check for accidental secret exposure.
