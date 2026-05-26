# Compatibility Report

Generated: 2026-05-26
Tech spec: docs/superpowers/specs/2026-05-26-real-user-accounts-design.md（.specs/tech-spec.md 為入口指標）
Project: missionforkids — 帳號系統 Plan A 測試依賴相容性

## Summary

可以開始實作。範圍是「Plan A 新增的測試依賴」與現有 Expo 54 / React 19.1 / RN 0.81 / firebase-functions v6 的相容性。找到 **3 個需要處理的點**，全部有明確解法：(1) `@testing-library/jest-native` 已棄用要移除、(2) RNTL 需 v13 且仍需 `react-test-renderer@19.1.0`、(3) jest-expo 54.0.14+ 新增 `react-server-dom-webpack` peer，對本專案 EAS `npm ci` 嚴格性是真風險，需補裝。現有 App/Functions 既有套件不變動。

## Dependency Map（本次新增）

| 類別 | 套件 | 角色 | 驗證後版本 |
|---|---|---|---|
| RN 測試 preset | `jest-expo` | Expo SDK mock + jest preset | `~54.0.17`（SDK 54 線最新；`npx expo install`） |
| 測試框架 | `jest` | test runner（RN + Functions 兩邊） | `~29`（SDK 54 對應） |
| RN 元件測試 | `@testing-library/react-native` | 渲染/互動斷言 | `^13.3.3`（v13 才支援 React 19） |
| RN 測試 renderer | `react-test-renderer` | RNTL 13 的 peer（仍需要） | `19.1.0`（對齊 react） |
| RN 測試 peer | `react-server-dom-webpack` | jest-expo 54.0.14+ 的 peer | `~19.1.5`（對齊 react 19.1） |
| Functions 測試 | `firebase-functions-test` | 包裝 v2 callable 測試 | `^3.5.0` |
| Functions TS 轉譯 | `ts-jest` | jest 跑 TS | `^29.4.11` |
| Functions 型別 | `@types/jest` | jest 型別 | `^29` |

**移除（原計畫誤列）：** `@testing-library/jest-native` —— 已棄用，RNTL v12.4+ 內建 matchers。

## Local Environment Status

| Item | Required | Installed | Status |
|---|---|---|---|
| node | 22 | v22.22.2 | ✅ ready |
| npm | — | 10.9.7 | ✅ ready |
| expo | ~54 | ~54.0.33 | ✅ ready |
| react | 19.1.0 | 19.1.0 | ✅ ready |
| react-native | 0.81 | 0.81.5 | ✅ ready |
| @react-native-firebase | v24 | ^24.0.0 | ✅ ready |
| firebase-functions | v6 | ^6.3.0 | ✅ ready |
| firebase-admin | v13 | ^13.0.0 | ✅ ready |
| typescript | — | ^5.9.2 | ✅ ready（ts-jest 接受 >=4.3 <7） |

## Service / Package Specifications

### jest-expo（SDK 54 線）
- 安裝：`npx expo install jest-expo jest`（Expo 解析 SDK-54 對應版本）。
- 54.0.13 之前無額外 peer；**54.0.14+ 新增 peer `react-server-dom-webpack: ~19.0.4 || ~19.1.5 || ~19.2.4`**。
- React 19.1 → 需 `react-server-dom-webpack@~19.1.5`（19.1.5/.6/.7 皆存在）。
- 來源：https://www.npmjs.com/package/jest-expo ；https://docs.expo.dev/develop/unit-testing/

### @testing-library/react-native（v13.3.3）
- peerDependencies：`jest >=29.0.0`、`react >=18.2.0`、`react-native >=0.71`、**`react-test-renderer >=18.2.0`**。
- v13 支援 React 19（async 渲染）；**仍把 `react-test-renderer` 列為 peer**，所以要裝 `react-test-renderer@19.1.0`（會出現 React 19 棄用警告，無害）。
- v12.4+ 起內建 jest matchers → **不需 `@testing-library/jest-native`**。
- 來源：https://github.com/callstack/react-native-testing-library ；https://react.dev/warnings/react-test-renderer

### firebase-functions-test（v3.5.0）
- peerDependencies：`firebase-functions >=4.9.0`（✓ 本專案 ^6.3.0）、`firebase-admin ^8..^13`（✓ ^13）、`jest >=28`（✓ 29）。
- 支援 v2 `onCall` 包裝：`wrap(fn)({ data, auth })`（單一 CallableRequest，無 data/context 對）—— 與 Plan A 測試寫法一致。
- 已知：v2 callable 型別偶有小問題，測試中用 `as any` 規避即可（Plan A 已採用）。
- 來源：https://github.com/firebase/firebase-functions-test/releases

## Cross-Compatibility Matrix

| A | B | Status | Notes |
|---|---|---|---|
| jest-expo ~54 | jest ~29 | ✅ | `expo install` 配對 |
| jest-expo 54.0.17 | react-server-dom-webpack | ⚠️ 需配置 | 補裝 ~19.1.5 滿足 peer（見 Conflict 1） |
| @testing-library/react-native 13 | react 19.1 / RN 0.81 | ✅ | v13 專為 React 19 |
| @testing-library/react-native 13 | react-test-renderer 19.1.0 | ✅（有警告） | peer 仍需；棄用警告無害 |
| firebase-functions-test 3.5 | firebase-functions 6.3 | ✅ | peer >=4.9 |
| ts-jest 29 | jest 29 / typescript 5.9 | ✅ | peer 符合 |
| RN 測試 devDeps | EAS Build (`npm ci --include=dev`) | ⚠️ | peer 不匹配會讓 EAS 失敗（見 Conflict 1） |

## Conflicts & Resolutions

### Conflict 1：jest-expo 54.0.14+ 的 react-server-dom-webpack peer vs EAS npm ci 嚴格性
- **Problem**：jest-expo 54.0.17 要求 peer `react-server-dom-webpack`。本專案 EAS Build 用 `npm ci --include=dev`，**不容忍未滿足的 peer dependency**（見 `.claude/rules/expo-rn-firebase.md`），未處理會讓雲端 build 掛掉。
- **Impact**：本機 `npm install` 可能過（legacy-peer-deps），但下一次 EAS Build 會 fail。
- **Solution**：補裝 `react-server-dom-webpack@~19.1.5`（對齊 react 19.1）為 devDependency。它只被 jest-expo 的 RSC preset 引用，不會進 Metro/App bundle。
- **Action**：`npm install -D react-server-dom-webpack@~19.1.5`（在 root）。
- **替代方案**：若不想多一個 dep，可改 pin `jest-expo@54.0.13`（無此 peer）；代價是少了 .14+ 的 SDK mock 修正（Plan A 測的元件用不到，可接受）。

### Conflict 2：@testing-library/jest-native 已棄用
- **Problem**：Plan A 原列 `@testing-library/jest-native`，已停止維護。
- **Impact**：裝了會多一個棄用套件；其 matchers 與 RNTL 13 內建重複。
- **Solution**：移除該套件；RNTL v13 任何 import 即自動載入內建 matchers。
- **Action**：Plan A 安裝指令移除 `@testing-library/jest-native`；`jest.config.js` 的 `setupFilesAfterEnv` 移除 `@testing-library/jest-native/extend-expect`，只留 `<rootDir>/jest.setup.js`。

### Conflict 3：react-test-renderer 在 React 19 已棄用
- **Problem**：React 19 棄用 `react-test-renderer`，呼叫時印警告。
- **Impact**：僅 console 警告，不影響測試結果。RNTL 13 仍把它列為 peer，故仍需安裝。
- **Solution**：安裝 `react-test-renderer@19.1.0`（精確對齊 react 19.1.0），接受警告。
- **Action**：`npm install -D react-test-renderer@19.1.0`。

## Implementation Constraints（實作時硬性遵守）

**RN 端（root package.json，devDependencies）：**
- 用 `npx expo install jest-expo jest`（讓 Expo 配 SDK-54 版本，勿手動裝 latest jest-expo 56）。
- `npm install -D @testing-library/react-native@^13.3.3 react-test-renderer@19.1.0 react-server-dom-webpack@~19.1.5`
- **不要**安裝 `@testing-library/jest-native`。
- `jest.config.js` 的 `setupFilesAfterEnv` 只放 `['<rootDir>/jest.setup.js']`（不要 jest-native/extend-expect）。
- 寫測試時遵循 RNTL v13 慣例（部分 API 為 async）；元件測試可 mock `Starfield` 等視覺元件。

**Functions 端（functions/package.json，devDependencies）：**
- `npm install -D jest@^29 ts-jest@^29 @types/jest@^29 firebase-functions-test@^3.5.0`
- v2 callable 測試用 `wrap(fn)({ data, auth })` 形狀；型別問題用 `as any` 規避。

**驗證關卡（安裝後必做）：**
- 在 root 跑 `npm ls react-server-dom-webpack` 確認 peer 已滿足（為 EAS 預先排雷）。
- 兩邊各跑一次 smoke test（Plan A Task 0.1 Step 6 / 0.3 Step 6）確認基建會動。

**不變動：** 現有 App 與 Functions 的執行期依賴（expo/react/RN/RNFB/firebase-functions/admin）皆已驗證就緒，本次不升不降。
