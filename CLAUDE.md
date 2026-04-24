# Mission for Kids

家庭任務獎勵 App — 讓孩子透過遊戲化完成自理工作，取代嘮叨。

## 技術棧
- Expo 54 + React Native + TypeScript
- Firebase: Firestore, Auth, Storage, Cloud Functions
- @react-native-firebase v24, firebase-functions v6 (v2 API)
- 版本組合：Expo 54 + expo-router ~6.0.23 + react 19.2.5 + react-native 0.81.5

## Firebase 專案
| 項目 | 值 |
|------|---|
| Firebase 專案 ID | `mission-for-kids` |
| Firebase 專案編號 | `369701963332` |
| Firestore 區域 | asia-east1（台灣） |
| Cloud Functions 區域 | us-central1（預設） |

## App 設定
| 項目 | 值 |
|------|---|
| iOS Bundle ID | `com.missionforkids.app` |
| Android Package | `com.missionforkids.app` |
| Expo 帳號 | `ababa_george` |
| EAS Project ID | `569558f4-09ae-440f-b5d6-e6592d94b972` |

## 核心原則
- 所有點數操作走 Cloud Functions，client 端不碰 wallet

## 開發資訊
- 設計文件：`docs/design-core-loop-ai-demo.md`
- 測試方式：iOS 模擬器
- 進度狀態見 `handoffs/` 下最新的 handoff 檔案

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Skills like /qa, /ship, /review, /investigate, and /browse become available after install.
Use /browse for all web browsing. Use ~/.claude/skills/gstack/... for gstack file paths.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. The
skill has multi-step workflows, checklists, and quality gates that produce better
results than an ad-hoc answer. When in doubt, invoke the skill. A false positive is
cheaper than a false negative.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke /office-hours
- Strategy, scope, "think bigger", "what should we build" → invoke /plan-ceo-review
- Architecture, "does this design make sense" → invoke /plan-eng-review
- Design system, brand, "how should this look" → invoke /design-consultation
- Design review of a plan → invoke /plan-design-review
- Developer experience of a plan → invoke /plan-devex-review
- "Review everything", full review pipeline → invoke /autoplan
- Bugs, errors, "why is this broken", "wtf", "this doesn't work" → invoke /investigate
- Test the site, find bugs, "does this work" → invoke /qa (or /qa-only for report only)
- Code review, check the diff, "look at my changes" → invoke /review
- Visual polish, design audit, "this looks off" → invoke /design-review
- Developer experience audit, try onboarding → invoke /devex-review
- Ship, deploy, create a PR, "send it" → invoke /ship
- Merge + deploy + verify → invoke /land-and-deploy
- Configure deployment → invoke /setup-deploy
- Post-deploy monitoring → invoke /canary
- Update docs after shipping → invoke /document-release
- Weekly retro, "how'd we do" → invoke /retro
- Second opinion, codex review → invoke /codex
- Safety mode, careful mode, lock it down → invoke /careful or /guard
- Restrict edits to a directory → invoke /freeze or /unfreeze
- Upgrade gstack → invoke /gstack-upgrade
- Save progress, "save my work" → invoke /context-save
- Resume, restore, "where was I" → invoke /context-restore
- Security audit, OWASP, "is this secure" → invoke /cso
- Make a PDF, document, publication → invoke /make-pdf
- Launch real browser for QA → invoke /open-gstack-browser
- Import cookies for authenticated testing → invoke /setup-browser-cookies
- Performance regression, page speed, benchmarks → invoke /benchmark
- Review what gstack has learned → invoke /learn
- Tune question sensitivity → invoke /plan-tune
- Code quality dashboard → invoke /health
