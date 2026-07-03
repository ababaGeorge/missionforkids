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
