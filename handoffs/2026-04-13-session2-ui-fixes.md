# Handoff: UI/UX 修復 — 家長端測試回饋

## Session Metadata
- Created: 2026-04-13
- Project: ~/conductor/workspaces/missionforkids/manado
- Branch: ababaGeorge/office-hours
- Continues from: handoffs/2026-04-13-002526-eas-build-firebase-compat.md

## Current State Summary

EAS Build 終於成功（經過 20+ 次嘗試）。App 已安裝到 iPhone 17 Pro 模擬器並可啟動。家長端首次測試發現多個 UI 阻塞問題和功能缺口。孩子端尚未測試。

## Build 成功的關鍵配置

**這組配置是唯一能 build 的，不要改動：**

- RNFB v24.0.0 + Firebase iOS SDK 12.10.0
- `expo-build-properties`: `useFrameworks: "static"` + `forceStaticLinking` for RN/RNFB pods
- `$RNFirebaseAsStaticFramework = true`（via plugins/withModularHeaders.js）
- EAS image: `macos-sequoia-15.4-xcode-16.3`（**不能用 Xcode 26**）
- 不需要 modular headers、post_install hacks、C++ flag overrides
- `@react-native-google-signin` 已移除（與 Firebase 12 不相容，待找替代方案）

## 測試發現的問題

### P0 — 阻塞（必須先修）

1. **鍵盤蓋住畫面按鈕 → 死局**
   - 所有有 TextInput 的頁面都沒有 `KeyboardAvoidingView`
   - 鍵盤彈出後蓋住確認/取消按鈕，無法操作也無法關閉
   - 影響：sign-in（邀請碼）、建立家庭、建立任務、建立獎勵
   - 修法：所有表單頁面加 `KeyboardAvoidingView` + `ScrollView` + `keyboardDismissMode`

2. **無法返回登入頁（無登出按鈕）**
   - 進入家長/孩子端後沒有登出功能
   - 無法切換角色測試
   - 修法：在家長/孩子的 tab layout 或 settings 加登出按鈕

### P1 — 重要

3. **邀請碼產生後消失，無法重新查看**
   - `family.tsx` 產生邀請碼後只顯示一次
   - 需要在家庭頁面列出所有已產生的邀請碼及狀態
   - 修法：查詢 `inviteCodes` collection，顯示在家庭成員列表下方

4. **只能邀請孩子，不能邀請家長**
   - 設計文件寫了「Parent creates family, invites other parents (via Apple/Google auth) or kids」
   - 目前只實作了邀請孩子的邀請碼
   - 修法：加入邀請家長的 flow（可能是分享連結 + Google/Apple sign-in）

### P2 — 功能增強

5. **任務只能指派一個孩子**
   - 設計文件寫 `assigneeType: 'individual' | 'family'`，但 UI 只有單選
   - 修法：加入多選 UI + 「指派給全家」選項

6. **任務沒有範本**
   - 使用者希望有預設任務範本（整理書桌、刷牙、做功課等）
   - 設計文件沒提到但是好功能
   - 修法：建立 `taskTemplates` 常量，在建立任務時可選用

## 設計文件 vs 實作差距

上一個 session 的重心是技術基礎建設（Firebase、Cloud Functions、Security Rules），UI 只做了最低限度的 skeleton。本 session 幾乎全花在修 EAS Build。以下是設計文件中有寫但還沒認真實作的功能：

- [ ] 完整的 task creation UI（多選指派、due date picker）
- [ ] Pending Reviews 畫面（有照片預覽、approve/reject）
- [ ] Reward store 的完整 order flow（pending → approved → delivered → completed）
- [ ] 孩子端的 resubmission flow（3 次上限的 UI 提示）
- [ ] 慶祝動畫觸發（程式碼有但需要真實環境測試）
- [ ] 離線模式提示
- [ ] i18n 語言切換

## Immediate Next Steps

1. **修 P0：鍵盤問題** — 所有表單頁面加 KeyboardAvoidingView
2. **修 P0：登出按鈕** — 在 tab layout 加登出功能
3. **修 P1：邀請碼管理** — 家庭頁面顯示已產生的邀請碼
4. **修 P1：邀請家長** — 實作邀請其他家長的 flow
5. **完善 UI** — 對照設計文件逐項補齊

## 關鍵指令

```bash
# Dev server（App 已安裝在模擬器，只需啟動 dev server）
cd ~/conductor/workspaces/missionforkids/manado
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx expo start --dev-client

# EAS Build（已成功的配置，不要改）
PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build --profile development --platform ios --clear-cache

# 安裝到模擬器
xcrun simctl install booted /tmp/MissionforKids.app
xcrun simctl launch booted com.missionforkids.app

# 部署 Cloud Functions
cd functions && npm run build && cd .. && firebase deploy --only functions
```

## 待處理事項（非 UI）

- [ ] OpenAI API key 需要更換（舊 key 暴露在對話紀錄）
- [ ] Google Sign-In 需要找與 Firebase 12 相容的方案
- [ ] Apple Sign-In 等 Apple Developer 驗證
