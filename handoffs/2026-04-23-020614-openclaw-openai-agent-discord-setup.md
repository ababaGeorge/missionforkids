# Handoff: OpenClaw openai agent 全面接 OpenAI + 雙 Discord bot 串接

## Session Metadata
- Created: 2026-04-23 02:06:14
- Project: /Users/ababa_george/Desktop/missionforkids project/missionforkids（本 session **沒有**修改此 repo 任何檔案，工作目標是 OpenClaw 全域設定 `~/.openclaw/openclaw.json`）
- Branch: chore/add-claude-md
- Session duration: 約 3 小時（含等 OpenAI organization verification 的 15 分鐘）

### Recent Commits (for context)
  - 9bba272 Add rule file documenting CLAUDE.md workspace sync policy
  - 6c662c2 Add CLAUDE.md with project stack and Firebase config
  - 052c175 Add EAS Build postmortem: 15 pitfalls across 20+ failed builds
  - 40ebbd6 Merge pull request #3 from ababaGeorge/chore/vercel-config
  - b733ab6 Add vercel.json to serve core_loop/ as site root

## Handoff Chain

- **Continues from**: 無（本 session 跟前一個 missionforkids repo sync handoff 不相關，純 OpenClaw 設定工作）
- **Supersedes**: None

> 注意：前一個 handoff (2026-04-22-235121-repo-sync-and-postmortem-cherrypick.md) 是 missionforkids repo 同步，跟這份無關聯。create_handoff.py 自動連了 `Continues from`，但實際話題不同。

## Current State Summary

把 OpenClaw 的 `openai` agent 從預設的 ollama/gemma4:26b 全面換成 OpenAI：文字 `openai/gpt-5-mini`、圖像 `openai/gpt-image-2`（OpenAI 於 4/21 發表的新模型，需 org verify 才能用）。同時為這個 agent 新建獨立 Discord bot `@BatbyClaude`，釘在使用者指定頻道 `1496564556514857043`；原有 `@AlfredbyClaude`（main agent / ollama）重新釘在頻道 `1485709619560190085`。兩個 bot 彼此隔離、不互相干擾。全部設定驗證通過，文字推論與生圖皆實測成功。Session 結束時使用者已回報「搞定了，結案吧」。

## Codebase Understanding

### Architecture Overview

本 session 工作的不是 missionforkids 程式碼，而是 OpenClaw 的全域設定系統。重點架構：

- OpenClaw 有「agent」概念（workspace + 模型 + routing），本機目前兩個：`main`（default）與 `openai`
- 每個 agent 有自己的文字模型（`defaultModel`）與圖像模型（`imageModel`），可以跨 provider（ollama / openai）
- Discord 在 OpenClaw 裡是 channel provider，一個 channel 可掛多個 account（每個 account 一個 bot token）
- Routing bindings 決定「哪個 Discord account 的訊息 → 哪個 agent」，用 `openclaw agents bind --agent <id> --bind discord:<accountId>`
- Gateway 是一個 LaunchAgent（`gui/501/ai.openclaw.gateway`），config 變更後要用 `openclaw gateway restart` 才生效

### Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `~/.openclaw/openclaw.json` | OpenClaw 主 config，本 session 幾乎所有改動都在這 | 核心 |
| `~/.openclaw/agents/main/agent/auth-profiles.json` | OpenAI API key 實際存放位置（共用 store） | key 機敏 |
| `/opt/homebrew/bin/openclaw` | CLI symlink → `/opt/homebrew/lib/node_modules/openclaw/openclaw.mjs`（npm 全域裝） | 升級用 `npm install -g openclaw@latest` |
| `/opt/homebrew/lib/node_modules/openclaw/dist/extensions/discord/allow-list-MMNtJoJ7.js` | Discord channel allowlist 實作，除錯用 | 源碼參考 |
| `/opt/homebrew/lib/node_modules/openclaw/dist/runtime-group-policy-Bx0H7Kp6.js` | groupPolicy runtime fallback 邏輯（default 是 "open"！） | 踩坑關鍵 |

### Key Patterns Discovered

- OpenClaw config 編輯後一律用 `openclaw config validate` 驗證，再 `openclaw gateway restart` 生效
- Discord bot 的 channel allowlist 三層：top-level `channels.discord.guilds` / per-account `accounts.<id>.guilds` / channel-level `channels.<id>` — per-account 覆蓋 top-level
- 敏感操作（如 paste-token）由使用者在獨立 Terminal 執行，key 不經過 Claude Code transcript

## Work Completed

### Tasks Finished

- [x] OpenClaw CLI 從 `2026.4.15` 升級到 `2026.4.21`（為了 gpt-image-2）
- [x] OpenAI API key 經使用者手動 `paste-token` 存入（auth-profiles.json，openai:manual profile）
- [x] 設定 `openai` agent 的 `imageModel` = `openai/gpt-image-2`
- [x] OpenAI org verification 完成（使用者在 platform.openai.com 側操作）
- [x] 實測 gpt-image-2 生圖成功：產出 1024x1024 PNG 195KB
- [x] 設定 `openai` agent 的 `defaultModel` = `openai/gpt-5-mini`（直接改 `agents.list[].model`）
- [x] 實測 gpt-5-mini 文字推論成功
- [x] 新增 Discord bot `@BatbyClaude`（account id = `openai-bot`），使用者在 Discord Developer Portal 側自建
- [x] 加 routing binding：`discord:openai-bot` → `openai` agent
- [x] 設定 `accounts.openai-bot` 的 channel allowlist = `1496564556514857043`
- [x] 設定 `accounts.default`（Alfred）的 channel allowlist = `1485709619560190085`
- [x] 兩個 bot 都 `requireMention: false`、都 `allowFrom: ["1251231866242076866"]`
- [x] 加全域 `channels.discord.groupPolicy: "allowlist"`（這是讓 channel allowlist 真正生效的關鍵）
- [x] 重啟 gateway，`openclaw doctor` 全綠，兩個 bot 都 connected

### Files Modified

| File | Changes | Rationale |
|------|---------|-----------|
| `~/.openclaw/openclaw.json` | 多處（agents / channels / bindings / auth） | OpenClaw 全部設定入口 |
| `~/.openclaw/agents/main/agent/auth-profiles.json` | OpenAI key 寫入 | paste-token 自動建立 |
| 全域 npm 套件 `openclaw` | 2026.4.15 → 2026.4.21 | 需要 gpt-image-2 支援 |

本 session 完全沒修改 missionforkids repo 任何檔案。

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| 文字模型選 `gpt-5-mini` | gpt-5 / gpt-5-mini / gpt-5-codex / gpt-4o-mini | CP 值高、起手合適；需要時再升 |
| 圖像模型選 `gpt-image-2` | dall-e-3 / gpt-image-1（OpenRouter）/ gpt-image-2 | 使用者指定要「昨天剛發的」，且不想用 OpenRouter |
| 加新 Discord bot 而非重用 Alfred | 重用 Alfred / 新 bot | 使用者明確要求「不要動到 main」 |
| API key paste-token 方式 | 使用者貼給我 / 使用者自己跑 | 保護 key，不進 transcript |
| OpenClaw config 手動編輯 `agents.list[].model` | `models set --agent` / `config set` / 直接編輯 | `models set --agent` 有 bug（見 Gotchas），只能編輯 |
| channel allowlist 放 per-account | top-level / per-account | 兩個 bot 限制不同頻道，必須分開 |
| 加 `groupPolicy: "allowlist"` 到全域 | per-account / 全域 | 兩個 bot 都要 allowlist，全域一次搞定 |

## Pending Work

### Immediate Next Steps

1. 使用者可實測在 Discord 兩個頻道外的訊息，確認 bot 真的不會回（已設定，尚未跨頻道人工驗證每個頻道）
2. 視 OpenAI 用量決定是否把 `openai` agent 的文字模型從 `gpt-5-mini` 升到更強的（例如 `gpt-5`）
3. 若將來想讓 `@BatbyClaude` 也在其他頻道工作，在 `~/.openclaw/openclaw.json` 的 `accounts.openai-bot.guilds.1483372765821014037.channels` 加 channelId 即可（值給 `{}`）

### Blockers/Open Questions

- [ ] 使用者提到 Alfred「不小心被我踢了」，不確定是指踢出 server 還是只踢出頻道。如果是整個 server 被踢，OpenClaw config 改不回來，使用者要在 Discord Developer Portal 重新拿 Alfred 的 OAuth 邀請連結重邀。（尚未確認 Alfred 在 Discord 側的實際狀態）

### Deferred Items

- 文字模型未升級到 gpt-5 或 gpt-5-codex（等用量 / 需求出現再決定）
- 沒設 model fallbacks（`openai` agent 的 `fallbacks: []`），API 掛掉時無備援
- 沒改 main agent 的模型（仍是 ollama/gemma4:26b），使用者明確說「不要動到 main」

## Context for Resuming Agent

### Important Context

**本 session 工作跟 missionforkids 專案無關**。使用者在 missionforkids 目錄下開 Claude Code，但要求處理的是 OpenClaw 全域設定。**不要**誤以為要動 missionforkids 程式碼。

核心產出：`openai` agent 現在完整能用 OpenAI 文字 + 圖像，Discord 裡有獨立 bot `@BatbyClaude` 負責，跟原本 `@AlfredbyClaude` 走不同模型（Alfred 仍是 ollama）。

**兩個 bot 的工作區（絕對不要搞混）**：
- `@AlfredbyClaude`（account id `default`）→ `main` agent → ollama/gemma4:26b → 頻道 `1485709619560190085`
- `@BatbyClaude`（account id `openai-bot`）→ `openai` agent → gpt-5-mini + gpt-image-2 → 頻道 `1496564556514857043`

同一個 Discord server（guild id `1483372765821014037`），同一個允許的使用者（Discord user id `1251231866242076866`）。

### Assumptions Made

- 使用者 Discord 新建的頻道跟 Alfred 在同一個 server（`1483372765821014037`）—— 使用者只給了 channel ID，沒特別說 server，我推斷為同 server
- 使用者希望 `@BatbyClaude` 只允許自己觸發（跟 Alfred 一致的 allowFrom 做法）—— 我主動做了，使用者沒反對
- 使用者的 Discord user ID `1251231866242076866` 跟 Alfred 現有 `allowFrom` 相同—— 直接沿用，沒再問

### Potential Gotchas

1. **`openclaw models --agent <id> set <model>` 有 bug**：它只改 `agents.defaults.model.primary`，不會動 `agents.list[].model` 的 per-agent override。要改 per-agent 文字模型**必須直接編輯 `~/.openclaw/openclaw.json`** 的 `agents.list` 條目。`set-image` 不受此影響。

2. **Discord `groupPolicy` 的 runtime 預設是 `"open"` 不是 `"allowlist"`**：Config schema 文件寫 default 是 allowlist，但實際 runtime fallback 在 `runtime-group-policy-Bx0H7Kp6.js` 的 `resolveOpenProviderRuntimeGroupPolicy` 裡，當 provider 有設定時 `configuredFallbackPolicy: "open"`。所以即使你以為「allowlist 是預設，channels 白名單會生效」，實際上 bot 在整個 server 所有頻道都會回應。**必須在 `channels.discord.groupPolicy` 明確寫 `"allowlist"`**。

3. **OpenClaw CLI 是 npm 全域裝，不是 Homebrew cask**。升級用 `npm install -g openclaw@latest`。Homebrew cask 版本會落後 npm registry。

4. **OpenAI `gpt-image-2` 需要 organization verify**：在 platform.openai.com/settings/organization/general 點 Verify Organization，等最多 15 分鐘才能用。之前使用者已完成，不用再做，但換 OpenAI 帳號時要重新驗證。

5. **config validate 成功不代表 runtime 正確**：schema validation 只檢查型別，runtime 語義（例如 groupPolicy fallback）可能跟 schema default 不同。實測才是真的。

6. **Gateway restart 必須**：config 改完沒 `openclaw gateway restart` 的話 Discord bot 還是跑舊設定。

### Environment State

#### Tools/Services Used

- OpenClaw CLI `2026.4.21`（升級自 `2026.4.15`）
- Node.js v22.22.2（session-start rule 要求）
- OpenAI API（org 已 verify，可用 gpt-image-2 + gpt-5 系列）
- Discord Developer Portal（使用者側 @BatbyClaude application）
- Gateway 跑在 macOS LaunchAgent `gui/501/ai.openclaw.gateway`

#### Active Processes

- `openclaw gateway`（LaunchAgent，自動重啟），負責 Discord WebSocket + routing
- Discord 兩個 bot 都 `running, connected`
- Ollama 在 `http://localhost:11434`（main agent 還在用，沒動）

#### Environment Variables

- `OPENAI_API_KEY`：**沒**使用 env var 方式，key 存在 `auth-profiles.json` 裡（paste-token mode）
- `DISCORD_BOT_TOKEN`：兩個 bot token 都存在 config 的 `channels.discord.accounts.<id>.token`（明碼 JSON，這是 OpenClaw 預設做法，不建議改）

## Related Resources

- OpenClaw 官方 docs：https://docs.openclaw.ai/
- OpenAI gpt-image-2 文件：https://openai.com/index/introducing-chatgpt-images-2-0/
- 本 session 存的 context-save：`~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260423-020526-openclaw-openai-agent--discord-setup.md`
- OpenClaw 源碼路徑（除錯時參考）：`/opt/homebrew/lib/node_modules/openclaw/dist/`

---

**Security Reminder**: 本 handoff 沒有貼 API key 或 bot token 明碼。存 config 的檔案路徑有提到但值都沒複製進來。
