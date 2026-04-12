# Handoff: EAS Build — Firebase iOS 相容性修復

## Session Metadata
- Created: 2026-04-13 00:25:26
- Project: /Users/ababa_george/conductor/workspaces/missionforkids/manado
- Branch: ababaGeorge/office-hours
- Session duration: ~6 hours
- Continues from: HANDOFF.md (root level, not in handoffs/)

## Current State Summary

Phase 1 + Phase 2 程式碼全部完成，Cloud Functions（含 analyzePhoto）已部署，Storage Rules 已部署。EAS Build 經歷了 15+ 次失敗，從依賴版本不匹配一路修到 Firebase iOS SDK Swift header 相容問題。最終方案是 RNFB v21 + $FirebaseSDKVersion = 10.29.0 + 精確的 modular headers。**最新 build（ID: b9z3ib63u）正在背景跑，還沒有結果。**

## Critical Files

| File | Purpose | Relevance |
|------|---------|-----------|
| `plugins/withModularHeaders.js` | 設定 $FirebaseSDKVersion + modular headers | build 成敗的關鍵 |
| `plugins/withFirebaseAppDelegate.js` | 手動注入 FirebaseApp.configure() | RNFB v21 無法自動注入 Expo 54 Swift AppDelegate |
| `app.json` | Expo plugins 設定 | expo-build-properties 用 useModularHeaders |
| `package.json` | RNFB v21.14.0, react 19.1.0 | 版本鎖定很重要 |
| `functions/src/analyzePhoto.ts` | AI Playground Cloud Function | 已部署，需要 OPENAI_API_KEY |
| `src/app/child/(tabs)/ai.tsx` | AI Playground UI | 程式碼完成 |
| `storage.rules` | Storage 安全規則 | 已部署 |

## Work Completed

### Tasks Finished
- [x] Step 8: Storage Rules — 已部署（family-scoped + playground）
- [x] Step 9: AI Playground — 程式碼 + Cloud Function 已部署
- [x] Node 25 simdjson 修復
- [x] 依賴版本修復（react, react-dom, expo-build-properties）
- [x] Cloud Functions 部署（含 analyzePhoto）
- [x] OPENAI_API_KEY 設定到 Secret Manager
- [x] Google Sign-In 暫時移除（Firebase 10 不相容）

### Decisions Made

| Decision | Options Considered | Rationale |
|----------|-------------------|-----------|
| RNFB v21 + Firebase 10.29 | v24(Firebase 12), v21(Firebase 11), v20(Firebase 10) | v24/v21 的 Firebase 11+ Swift headers 在 Expo 54 下無法解決；v20 不支援 Swift AppDelegate；v21 + 強制 Firebase 10 是最佳折衷 |
| 移除 google-signin | 降級 google-signin, 移除 | GoogleSignIn 9 需要 AppCheckCore 11 → GoogleUtilities 8，與 Firebase 10 的 GoogleUtilities 7 衝突；功能尚未啟用 |
| 手動 FirebaseApp.configure() | 等 RNFB 修復, 自訂 plugin | RNFB v21 auto-inject 不認識 Expo 54 的 AppDelegate.swift 格式 |

## Pending Work

### Immediate Next Steps

1. **檢查最新 build 結果**：
   ```bash
   PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build:list --limit 1
   ```
   - 如果成功：下載 .app 安裝到模擬器測試
   - 如果失敗：看 log 找新的錯誤

2. **如果 build 成功 — 模擬器測試**：
   ```bash
   # 取得下載 URL
   /opt/homebrew/opt/node@22/bin/node $(which eas) build:view BUILD_ID --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['artifacts']['applicationArchiveUrl'])"
   # 下載並解壓
   curl -L URL -o app.tar.gz && tar xzf app.tar.gz
   # 安裝到模擬器
   xcrun simctl install booted *.app
   ```

3. **換 OpenAI API key** — 舊 key 暴露在對話紀錄中，必須到 OpenAI Dashboard 撤銷並產生新 key：
   ```bash
   echo "新key" | gcloud secrets versions add OPENAI_API_KEY --project=mission-for-kids --data-file=-
   ```

### Blockers/Open Questions
- Build 結果未知（正在跑）
- OpenAI API key 需要更換
- Google Sign-In 需要找到與 Firebase 10 相容的版本（或等升級 Firebase）

### Deferred Items
- Google Sign-In（移除了，等 Firebase 版本升級再加回）
- Apple Sign-In（等 Apple Developer 驗證）
- COPPA 合規（TestFlight 測試不需要）

## Context for Resuming Agent

### Important Context

1. **Node 環境**：系統 Node 是 25，但 Expo/EAS 必須用 Node 22（`PATH="/opt/homebrew/opt/node@22/bin:$PATH"`）。firebase CLI 可用系統 Node（simdjson 已修復）。

2. **Firebase SDK 版本鎖定**：`$FirebaseSDKVersion = '10.29.0'` 在 Podfile 最上面。不要升級到 11+，會重新遇到 Swift header 問題。

3. **EAS Build 用 `npm ci`**：不容忍 peer dep 不匹配。`^` prefix 在 package.json 可能導致 EAS 拉到不同版本。

4. **modular headers 列表是精確的**：只列出 pod install 錯誤中要求的 pods。多加會拉錯版本造成衝突。

5. **RNFB v21 的 AppDelegate 注入**：RNFB 的 config plugin 不認識 Expo 54 的 Swift AppDelegate 格式，所以用自訂 `withFirebaseAppDelegate.js` 手動加 `FirebaseApp.configure()`。

### Potential Gotchas

- `pod 'X', :modular_headers => true` 不指定版本時，CocoaPods 會用依賴圖中解析的版本。但如果 pod 名稱不在依賴圖中（如 FirebaseStorageInternal），會拉最新版造成衝突。
- `use_frameworks! :linkage => :static` 會讓 RNFB ObjC 程式碼（RNFBStorageModule.m）出現 implicit-int 錯誤，不要用。
- 全域 `use_modular_headers!` 會破壞 gRPC-Core modulemap，不要用。
- Expo prebuild 會跳過 RNFB 的 Firebase auto-inject（warning: "Unable to determine correct Firebase insertion point"），這是正常的，由 withFirebaseAppDelegate.js 處理。

## Environment State

### Tools/Services Used
- EAS Build (cloud, free tier — 排隊較久)
- Firebase CLI (已登入 mission-for-kids)
- gcloud CLI (已登入)
- Secret Manager: OPENAI_API_KEY (版本 1，需要更換)

### Active Processes
- EAS Build `b9z3ib63u` 正在背景跑

### Environment Variables
- OPENAI_API_KEY (Secret Manager, 需要更換 — 舊 key 暴露了)

## Related Resources
- 設計文件：`docs/design-core-loop-ai-demo.md`
- Firebase 專案：mission-for-kids
- RNFB Swift header issue: https://github.com/invertase/react-native-firebase/issues/8271
- Expo 54 + Firebase 相容: https://github.com/expo/expo/issues/39607
