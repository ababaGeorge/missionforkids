---
status: in-progress
branch: feat/security-hardening
head: 600495e
timestamp: 2026-07-03T12:11:24+0800
files_modified:
  - handoffs/archive-gstack-checkpoints/（新增 27 份封存 checkpoint + README）
  - .claude/skills/（移除 gstack 本體 + gstack-upgrade + 40 個 vendored 複本）
  - CLAUDE.md（移除第 35 行後的 gstack 注入區塊）
---

## Working on: gstack 工具鏈完整移除 + security hardening 開成 PR #6

### Summary
本 session 主線是**完整移除 gstack 工具鏈**。起因：使用者盤點時發現一堆專案「不知不覺」被收進 `~/.gstack/projects/`，真正訴求是「不想專案在不知情下被 gstack 的 proactive 自動追蹤接管」，工具本身留不留其次。決定完整移除（工具在就有觸發風險，移除才一勞永逸；gstack 為公開工具可重裝）。收尾把當前 branch 上的 security hardening（之前 session 的工作）+ 本次 gstack 清理共 8 commit，**排除雙模擬器 demo commit 後**開成 PR #6，待使用者在 GitHub review + merge。

### Decisions Made
- **移除 gstack 而非只清資料**：使用者要的是「不再被自動接管專案」，只清 `~/.gstack/` 資料的話工具還會重建；完整移除才根治。
- **用官方卸載器 `gstack-uninstall`**：它靠「SKILL.md 是否 symlink 指向 gstack」判斷，天然保護使用者自製 skill（真實檔），比手列清單可靠（手判途中誤把 learn/setup-deploy 當自製，卸載器邏輯每次都對）。
- **MFK 27 份開發 checkpoint 無損搬進 repo 再刪 `~/.gstack`**：先建立後移除（結構性改動順序）。其中 5/18→6/2 真帳號工程（Plan A→D）是孤本，repo 原本沒有備份。
- **PR 排除 `19f416c`（雙模擬器 harness + emulator shim，僅 demo 用）**：用 `git rebase --onto 19f416c^ 19f416c` 在新 branch 精準抽掉，不動原 branch。已確認它與 security/gstack commit 無檔案重疊。
- **走 PR 不本地 merge**：security 敏感變更（改 prod firestore/storage rules、拔 prod 密碼）該有審查關卡 + 使用者自己 merge。

### Remaining Work / Next Steps
1. **【使用者動作】review + merge PR #6** → https://github.com/ababaGeorge/missionforkids/pull/6 （特別看 security diff）
2. **【merge 後必做】部署 firestore/storage rules 到 prod** — PR 改了 prod security rules，merge 進 main 不會自動生效，需另行部署。
3. **更新 `~/.claude/reports/data.json`**（handoff rule step 2，緊接本 skill 後做）。
4. 【低優先 🟢】`mfk-current-snapshot`（demo worktree）內 41 個斷連死 symlink 無害，日後 `git worktree remove` 一併清。
5. 【可選】原 `feat/security-hardening-demo` branch 保留著（含被排除的 demo commit）— 要不要留看使用者。

### Notes / Gotchas
- `functions/.secret.local` 是 untracked 本地 secret，未進 git、不在 PR（不記其值）。
- 桌面 gstack 備份已在確認無誤後刪除。
- 決策已記入全域決策日誌（`~/Desktop/George sub brain/06_執行日誌/全域決策日誌.md`，2026-07-03 條）。
- 自製 5 skill（context-save/restore/codex/relay/compat-check）SKILL.md 是真實檔，全程未受影響。

### Branch / PR / Commits
- **branch**：`feat/security-hardening`（本次新建，從 `feat/security-hardening-demo` 用 rebase --onto 抽掉 demo commit 而來）
- **base**：`main`（93a2575，PR #5 狀態）
- **HEAD**：600495e，已 `push -u origin`
- **PR #6**：open，8 commit（4 security/feature：352a983/1a458bc/a325bcb/f5754ac + 4 gstack：a58caa1/4e1e895/a073c7f/600495e）
- 原 `feat/security-hardening-demo` 保留不動（rebase 前完整狀態，含 19f416c）

### Validation
- 本 session **未跑 test/build** — 純 gstack 移除 + git 操作。security commit 的測試（f5754ac 攻擊腳本 runner）是之前 session 做的，本次未重跑。
- gstack 移除有逐步驗證：引擎清除（Claude/Codex/.agents 皆 0）、自製 5 skill 完好、殘留 0、git 內容完整。

### Data Safety
- 未碰 `.env` / prod 資料 / migration。
- 刪除操作：`~/.gstack`（備份後刪，備份確認後也刪）、gstack skill 複本（可重裝）— 皆可逆。
- `functions/.secret.local` untracked，未動、未記值。
- PR 內含改 prod firestore/storage rules + 拔 prod 密碼（branch 既有 commit，非本次新增），**merge 後需部署 rules**。

### Manual Acceptance Checklist
- [ ] 在 GitHub 逐一檢視 PR #6 的 security diff（rules / CF 金額守衛）
- [ ] merge 後部署 firestore + storage rules，確認 prod 生效
- [ ] 確認 app 功能正常（analyzePhoto 提交、點數流程）

### Rollback / Do-Not-Do
- gstack 可重裝：`git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`。
- 原 `feat/security-hardening-demo` branch 是 rebase 前完整狀態，可回溯。
- **不要**把 `functions/.secret.local` commit 進 git。

### Remaining Confirmations
- PR #6 是否 merge（使用者決定）。
- 原 `feat/security-hardening-demo` demo branch 要不要保留。
