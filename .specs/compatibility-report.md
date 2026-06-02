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

---

## 修正（實裝後，2026-05-26）

實際安裝時發現本報告原本對 react-server-dom-webpack 的建議有誤，已更正並驗證：

- **原誤判**：建議補裝 `react-server-dom-webpack@~19.1.5` 滿足 jest-expo 54 的 peer。實際上 rsdw 19.1.5 要求 `react ^19.1.5`，與 App 鎖的 `react 19.1.0` 衝突 → 嚴格 `npm ci` 失敗。
- **正解（已採用並驗證）**：
  - **pin `jest-expo@54.0.13`**（54.x 線最後一個搭配時 npm 會把 rsdw 自動解到相容版本的；不要用 `npx expo install`，它抓 54.0.17）。
  - **不手動安裝 react-server-dom-webpack** —— 它是 expo-router 的 *peerOptional*，npm 會自動解到 **19.0.6**（相容 react 19.1.0）。
  - **不使用 `.npmrc legacy-peer-deps=true`** —— 保持專案嚴格 peer 檢查。
- **驗證**：移除 .npmrc + rsdw 手動 pin、清 lock 重裝後，`npm ci`（= EAS Build 指令）**EXIT 0**、RN smoke test 通過。EAS 安全。
- Plan A Task 0.3 安裝指令已同步更新為上述正解。

---

# Plan B 相容性附錄（2026-05-26）

範圍：Plan B 新增的兩塊外部串接 —— **Resend 交易寄信** 與 **Expo deep link**。Plan A 既有依賴不重驗。結論：**核心後端（邀請函式 + 資料模型 + 接受流程）可立即用 emulator + TDD 開發，零新增執行期阻擋**；真正寄信與「未裝 App 落地」需要使用者層級的外部設定，但**不擋後端開發**。

## Plan B Dependency Map（新增）

| 類別 | 項目 | 角色 | 驗證後結論 |
|---|---|---|---|
| 交易寄信 | Resend API | Cloud Function 寄邀請信 | 用 **raw fetch**（node 22 內建）打 `https://api.resend.com/emails`，零新增 dep；或選裝 `resend@^6.12.3` SDK（見 Decision B1） |
| 密鑰管理 | `RESEND_API_KEY` | Resend 金鑰 | `defineSecret('RESEND_API_KEY')`，**與既有 `OPENAI_API_KEY`（`functions/src/analyzePhoto.ts`）完全同一模式** |
| Deep link（scheme） | `missionforkids://` | 接住邀請連結 | **app.json 已設 `scheme: "missionforkids"`**；`expo-linking ~8.0.11` + `expo-router ~6.0.23` 已裝 → Phase 1 測試免新增安裝/build |
| Deep link（universal） | iOS Universal Link / Android App Link | 「未裝 App 先到下載頁」 | 需 hosted AASA/assetlinks + 原生設定 + 新 EAS build → **延後到上線前**，Phase 1 不需要 |

## Local / 現況查證

| 項目 | 需求 | 現況 | 狀態 |
|---|---|---|---|
| functions node engine | 22 | `functions/package.json` engines.node = "22" | ✅ |
| firebase-functions | v2 secrets API | ^6.3.0（`defineSecret` 已實際使用中） | ✅ |
| Functions 寄信前例 | 外部 API + secret | `analyzePhoto.ts` 用 `defineSecret('OPENAI_API_KEY')` + `secrets:[...]` + `.value()` | ✅ 直接照抄 |
| node 22 global fetch | raw 呼叫 Resend | node 22 內建 `fetch` | ✅ 免裝 SDK |
| app scheme | 自訂 scheme | app.json `scheme: "missionforkids"` | ✅ 已設 |
| expo-linking / expo-router | deep link 路由 | `~8.0.11` / `~6.0.23` 已裝 | ✅ |

## Service Specifications

### Resend（交易寄信）
- 官方 SDK：`resend`，最新 `6.12.3`（fetch-based，node 18+，node 22 OK）。
- 寄信（SDK 寫法）：`new Resend(key).emails.send({ from, to, subject, html })`。
- 寄信（raw，無 dep）：`POST https://api.resend.com/emails`，`Authorization: Bearer <key>`，JSON body 同上欄位。
- **測試免驗證網域**：`from: 'onboarding@resend.dev'` 官方允許測試用（不需驗證自有網域）。上線前才需驗證自有寄件網域。
- 免費額度 3000/月、100/天。
- 來源：https://resend.com/docs/send-with-nodejs

### Firebase Functions Secret（金鑰）
- v2 模式：`import { defineSecret } from 'firebase-functions/params'` → `const key = defineSecret('RESEND_API_KEY')` → onCall `{ secrets: [key] }` → 函式內 `key.value()`。
- **本專案已在用**（`analyzePhoto.ts`），無新機制風險。
- 本機 emulator 測試：functions 目錄放 `.secret.local`（或 `.env`）提供 `RESEND_API_KEY`；**不進 git**。
- 上線設定：`firebase functions:secrets:set RESEND_API_KEY`（使用者層級，需登入，走 `!` 前綴）。
- 來源：https://firebase.google.com/docs/functions/config-env

### Expo Deep Link（SDK 54）
- 自訂 scheme `missionforkids://` 已設 → expo-router 自動把 deep link 對應到路由（例如 `/invite/[inviteId]`）。
- 開發測試：`npx uri-scheme open missionforkids://invite/<id> --ios`（dev build 即可，免額外設定）。
- Universal/App Link（https、未裝落地）：需 iOS `associatedDomains` + 主機放 `apple-app-site-association`；Android `intentFilters` + 主機放 `assetlinks.json`。**改 app.json 原生設定 → 需重跑 EAS build**。→ 延後上線前。
- 來源：https://docs.expo.dev/linking/into-your-app/

## Cross-Compatibility

| A | B | 狀態 | Notes |
|---|---|---|---|
| Resend raw fetch | node 22 functions runtime | ✅ | 內建 fetch，零 dep |
| `resend` SDK 6.12.3 | node 22 | ✅ | fetch-based，無原生模組 |
| Resend 新增（若裝 SDK） | EAS Build | ✅ 無影響 | **functions 依賴與 RN bundle 分離**，EAS 只建 RN App，不碰 functions deps → 無 peer 風險 |
| `defineSecret` | firebase-functions ^6.3.0 | ✅ | 已實際運作 |
| 自訂 scheme deep link | expo-router ~6.0.23 | ✅ | 已裝，免新增 |
| Universal Link | 現有 EAS build | ⚠️ 需重 build | 改原生設定才生效；Phase 1 用 scheme 規避 |

## Decisions & Conflicts

### Decision B1：Resend 用 raw fetch 還是官方 SDK？（新依賴決策，待使用者定）
- **Problem**：寄信可用 node 22 內建 `fetch`（零新增 dep），或裝 `resend@^6.12.3` SDK（較順手、型別好）。
- **權衡**：raw fetch = 零依賴、符合 spec「直接呼叫 Resend API」字面、就一個 POST；SDK = 官方、ergonomic、與既有 `openai` dep 風格一致，但多一個 functions 依賴。
- **建議**：**raw fetch**（零新增依賴、符合使用者「避免不必要依賴」偏好、實作僅一個小 helper）。SDK 為備案。
- **Action**：寫 Plan B 計畫時把寄信封成 `functions/src/lib/sendInviteEmail.ts` 介面，內部 raw fetch；先以可注入 mock 的形式讓 `createFamilyInvite` 測試不需真網路。**此為新依賴方向，計畫定稿前向使用者確認。**

### Decision B2：Phase 1 deep link 只用自訂 scheme
- **Problem**：設計提到「未裝 App 先到下載頁」（universal link 行為），但 universal link 需 hosting + 原生設定 + 重 build。
- **建議**：**Phase 1 只用已設好的 `missionforkids://` 自訂 scheme**（接受流程測試足夠）；universal link 落地延後上線前。
- **Action**：Plan B 計畫的接受流程用 scheme 路由；universal link 列為上線前外部設定，不寫進 Plan B 程式任務。

### 無阻擋型衝突
Resend / deep link 皆無與既有依賴的版本衝突。

## Implementation Constraints（Plan B 實作硬性遵守）

- **寄信**：node 22 raw `fetch` 打 Resend REST（除非使用者選 SDK）。封成單一 `sendInviteEmail` 介面，可注入 mock；測試不打真網路。
- **金鑰**：`defineSecret('RESEND_API_KEY')` + onCall `secrets:[...]` + `.value()`，照 `analyzePhoto.ts`。本機 emulator 用 `functions/.secret.local`（git 忽略）。
- **寄信失敗不擋邀請**：依設計，`createFamilyInvite` 先建 `familyInvites` doc（transaction），再嘗試寄信；寄信 throw 不 rollback invite，回傳「可重寄」。
- **Deep link**：用既有 `missionforkids://` scheme + expo-router 路由（如 `/invite/[inviteId]`）。**不改 app.json 原生 linking 設定**（不觸發重 build）。universal link 延後。
- **資料模型**：新增 `familyInvites` collection + `FamilyInvite` type；`childId` 欄位（小孩帳號）依設計在 `acceptFamilyInvite` 產生並釘錢包 `{familyId}_{childId}`。
- **不變動**：Plan A 既有依賴與設定。

## 外部前置（使用者層級，不擋後端 TDD 開發）

| 項目 | 何時需要 | 誰做 |
|---|---|---|
| Resend 帳號 + API key | 真正寄信驗證前（後端 TDD 可先 mock） | 使用者註冊 resend.com 拿 key |
| `RESEND_API_KEY` secret 設定 | 部署寄信函式前 | `! firebase functions:secrets:set RESEND_API_KEY`（走 `!` 前綴） |
| Firebase 啟用 Email/Password | 真機端到端測試前 | 使用者在 Console 開 |
| 自有寄件網域驗證 | 上線前 | 使用者在 Resend 驗證 |
| Universal link hosting + 原生設定 | 上線前（未裝落地） | 需重 EAS build |
