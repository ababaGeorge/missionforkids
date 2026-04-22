## CLAUDE.md 與 Conductor workspace 同步規則

### 背景
本專案採 Conductor 同時開多個 workspace（manado、marseille 等）。每個 workspace 是同一個 git repo 的獨立 clone。曾發生各 workspace 各自維護 untracked 的 `CLAUDE.md`，導致資訊分裂。

**決策（2026-04-23）**：CLAUDE.md 以 master 版本為單一來源，commit 進 git，所有 workspace 共用。

### 必須遵守

1. **編輯 CLAUDE.md 只能在 Desktop 主 repo（`~/Desktop/missionforkids project/missionforkids/`）做**，然後透過 PR 合回 master
2. **不要在 Conductor workspace 直接改 `CLAUDE.md` 留著不 commit**。改了就 commit 進 branch 或搬到主 repo

### 遇到這些情況要主動提醒使用者

**情況 A：使用者在 Conductor workspace（manado / marseille / 其他）要合併 master**
- 先跑 `git status`，如果看到 `?? CLAUDE.md`（untracked）
- **必提醒**：「這個 workspace 有一份 untracked CLAUDE.md，合併 master 會被覆蓋或衝突。內容跟 master 一樣 → 直接刪除 local 版；內容不同 → 先確認是要保留還是丟棄」

**情況 B：marseille workspace 特殊情況**
- marseille 的本地 CLAUDE.md 是 gstack workflow 的極簡版（只提 DESIGN.md）
- 跟 master 版（專案技術棧）定位完全不同
- 如果使用者要在 marseille 合併 master → 提醒：「marseille 的本地 CLAUDE.md 是 gstack 流程專用的極簡版，刪掉會失去那個流程脈絡。建議先備份到 `.claude/rules/` 或其他地方，再刪掉 untracked 版本跑合併」

**情況 C：使用者在某 workspace 改了 CLAUDE.md**
- 提醒：「改動 CLAUDE.md 建議在 Desktop 主 repo 做，走 PR 流程。在 workspace 改容易忘記 commit，下次就分裂了」

### PR 安全規則
本 repo 禁止直接 push 到 master（hook 擋）。CLAUDE.md 的改動也走 feature branch + PR。
