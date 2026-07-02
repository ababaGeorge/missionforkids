---
status: completed
branch: chore/add-claude-md
timestamp: 2026-04-23T02:05:26+08:00
files_modified:
  - ~/.openclaw/openclaw.json (OpenClaw 全域設定，非本 repo)
session_scope: OpenClaw configuration only — no missionforkids code changed
---

## Working on: OpenClaw openai agent + Discord 雙 bot 串接

### Summary

把 OpenClaw 的 `openai` agent 從 ollama 全面切換到 OpenAI：文字模型 `openai/gpt-5-mini`、圖像模型 `openai/gpt-image-2`（OpenAI 4/21 才發表的新模型）。同時為這個 agent 加一個獨立的 Discord bot `@BatbyClaude`，綁到指定頻道 `1496564556514857043`，跟原有 `@AlfredbyClaude`（main agent / ollama）完全隔離。所有設定完成並驗證通過。

### Decisions Made

- **OpenClaw 升級**：從 `2026.4.15` 升到 `2026.4.21`（`npm install -g openclaw@latest`），因為 4.21 當天才加入 gpt-image-2 支援。CLI 是 npm 全域安裝（`/opt/homebrew/lib/node_modules/openclaw`），不是 Homebrew cask。
- **OpenAI key 採用 paste-token 方式**：使用者另開 Terminal 跑 `openclaw models --agent openai auth paste-token --provider openai`，key 不經過 Claude Code transcript。
- **gpt-image-2 需 organization verify**：OpenAI 側要求，否則 HTTP 403。使用者在 platform.openai.com 完成驗證後才能用。
- **Discord 雙 bot 架構**：main agent 保留 @AlfredbyClaude（釘在頻道 `1485709619560190085`），openai agent 使用新建的 @BatbyClaude（釘在頻道 `1496564556514857043`）。兩個 bot 都不需要 @mention、都只限 user ID `1251231866242076866` 觸發。
- **用 allowlist 模式**：全域加 `groupPolicy: "allowlist"` + per-guild `channels` 白名單，才能真正把 bot 限制在單一頻道。

### Remaining Work

本 session 已全部完成，無 pending。使用者下一步可考慮：
1. 實際在 Discord 兩個頻道交叉測試、確認跨頻道無聲
2. 依 OpenAI 用量決定是否升級到 gpt-5 / gpt-5-codex
3. 將來加更多 channel 可在 `accounts.<id>.guilds.<guildId>.channels` 加新 channelId

### Notes

發現兩個 OpenClaw 坑點（下次使用時注意）：

1. **`openclaw models --agent <id> set <model>` 只動 `agents.defaults.model.primary`**，不會覆寫 `agents.list[].model` 的 per-agent override。要改 per-agent 文字模型必須直接編輯 `~/.openclaw/openclaw.json` 的 `agents.list` 條目。`set-image` 走不同路徑沒這問題。

2. **Discord `groupPolicy` 的 runtime 預設是 `"open"` 不是 `"allowlist"`**，即使 config schema 標 default 是 allowlist。只要沒明確在 config 寫 `groupPolicy: "allowlist"`，bot 會在整個 server 所有頻道都回應（只受 @mention gating 限制）。Schema 的 default 跟 runtime fallback 不一致，很容易誤判。`channels.discord.groupPolicy` 必須明確設定。

還有：

- `agents.list[].model` 的預設值在 agent 建立當下被硬寫入，不是 reference；之後改 defaults 對已存在 agent 無效。
- OpenClaw 的 channel-level 白名單語義：`guilds.<guildId>.channels: {}` 空物件等同「這個 guild 無允許頻道」（配合 allowlist policy），要放 `{ "<channelId>": {} }` 才算允許該頻道。Channel entry 的 `enabled: false` 是「停用」（legacy key 是 `allow`，會被 `openclaw doctor --fix` 自動遷移）。
- 升級 OpenClaw 要用 `npm install -g openclaw@latest`，不是 `brew upgrade`。Homebrew cask 版本會落後 npm registry。
- 本 session 沒有修改 missionforkids 專案任何檔案。`handoffs/` 是前一個 session 留下的空模板。
