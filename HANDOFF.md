# Mission for Kids — Session 交接文件

> 建立時間：2026-04-12
> 上一個 Session 完成了 Phase 1 的程式碼撰寫 + Firebase 基礎建設

---

## 專案路徑

```
~/conductor/workspaces/missionforkids/manado/
```

## 設計文件

- 批准的設計：`docs/design-core-loop-ai-demo.md`（APPROVED）
- 開發計畫：`.claude/plans/zesty-toasting-nebula.md`

## 已完成的步驟

### Step 0: Firebase 專案 ✅
- 專案 ID: `mission-for-kids`
- Firestore、Auth（Anonymous + Google）、Storage 已啟用
- `GoogleService-Info.plist` + `google-services.json` 已下載
- Apple Auth 待 Apple Developer 付費驗證通過

### Step 2: Auth 系統 ✅（程式碼完成，未測試）
- `src/app/auth/sign-in.tsx` — Google Sign-In + 孩子邀請碼 + Dev 模式
- `src/lib/inviteCode.ts` — 6 位邀請碼生成/驗證
- `src/hooks/useAuth.ts` — 修復身份模型（支援 authProviderId 查詢）
- `src/app/parent/(tabs)/family.tsx` — 新增孩子 → 產生邀請碼
- **Google Sign-In 的 webClientId 還沒設定**（需從 Firebase Console 取得）

### Step 3: Cloud Functions ✅（已部署）
- `functions/src/onTaskInstanceApproved.ts` — 審核通過 → 發點
- `functions/src/onRewardOrderCreated.ts` — 兌換 → 扣點
- `functions/src/onRewardOrderCancelledOrRejected.ts` — 取消/拒絕 → 退點
- `functions/src/autoCompleteDeliveredOrders.ts` — 72hr 自動完成
- 全部已部署到 `us-central1`

### Step 4: Security Rules + Indexes ✅（已部署）
- `firestore.rules` — pointWallets/pointTransactions 禁止 client 寫入
- `firestore.indexes.json` — 9 個複合索引
- `storage.rules` — 暫時 placeholder（Step 8 會寫正式版）

### Step 5: 相機 + 照片上傳 ✅（程式碼完成，未測試）
- `src/lib/photoUpload.ts` — pickPhoto() + uploadPhoto()
- `src/app/child/(tabs)/tasks.tsx` — 真實相機、上傳進度、3 次上限

### Step 6: 畫面修復 ✅
- `review.tsx` — 修復 nested listener 洩漏，改用 useFamily hook
- `child/rewards.tsx` — 移除 client 端點數操作（改由 Cloud Function 處理）
- `child/points.tsx` — 修復硬編碼英文 → i18n

### Step 7: 慶祝動畫 ✅
- `src/components/CelebrationOverlay.tsx` — confetti + 點數動畫
- 整合到 `child/tasks.tsx`，偵測 approved 狀態觸發

---

## 待完成的步驟

### Step 1: Build（進行中）
- EAS Build ID: `9cbac2df-7068-4dc9-bc83-b7e201352082`
- 檢查狀態：`PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build:list --limit 1`
- 如果成功：下載 .app 安裝到模擬器
  ```
  # 取得下載 URL
  PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build:view BUILD_ID --json | python3 -c "import sys,json; print(json.load(sys.stdin)['artifacts']['applicationArchiveUrl'])"
  ```
- 如果失敗：看 EAS Console 的 build logs 找錯誤

### Step 8: Storage Rules + 部署
- 寫正式的 Storage 安全規則（家庭層級存取控制）
- `firebase deploy --only storage`

### Step 9: AI Playground（Phase 2）
- Cloud Function `analyzePhoto`（呼叫 OpenAI Vision API）
- `src/app/child/ai-playground.tsx`
- `src/components/AIThinkingAnimation.tsx`
- 需要 OpenAI API key

### 未完成的設定
- [ ] Google Sign-In webClientId（Firebase Console → Authentication → Sign-in method → Google → Web client ID）
- [ ] Apple Sign-In（等 Apple Developer 驗證通過）
- [ ] Google Sign-In 在 Firebase Console 啟用後，設定到 sign-in.tsx 的 GoogleSignin.configure()

---

## 關鍵指令速查

```bash
# 所有 Expo/EAS 指令都要加這個 prefix（Node 25 不相容）
PATH="/opt/homebrew/opt/node@22/bin:$PATH"

# 啟動開發伺服器
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx expo start

# EAS Build（模擬器）
PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build --profile development --platform ios

# 部署 Cloud Functions
cd functions && npm run build && cd .. && firebase deploy --only functions

# 部署 Firestore Rules
firebase deploy --only firestore

# 查看 build 狀態
PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build:list --limit 1
```

---

## 檔案結構（新增/修改的檔案）

```
manado/
├── firebase.json              # Firebase 設定
├── .firebaserc                # Firebase 專案連結
├── firestore.rules            # Firestore 安全規則
├── firestore.indexes.json     # 複合索引
├── storage.rules              # Storage 安全規則（placeholder）
├── eas.json                   # EAS Build 設定
├── GoogleService-Info.plist   # iOS Firebase 設定
├── google-services.json       # Android Firebase 設定
├── plugins/
│   └── withModularHeaders.js  # 自訂 Expo plugin（全域 modular headers）
├── functions/
│   └── src/
│       ├── index.ts
│       ├── onTaskInstanceApproved.ts
│       ├── onRewardOrderCreated.ts
│       ├── onRewardOrderCancelledOrRejected.ts
│       └── autoCompleteDeliveredOrders.ts
└── src/
    ├── lib/
    │   ├── inviteCode.ts      # 新增：邀請碼系統
    │   └── photoUpload.ts     # 新增：相機 + Storage 上傳
    ├── components/
    │   └── CelebrationOverlay.tsx  # 新增：慶祝動畫
    ├── hooks/
    │   └── useAuth.ts         # 修改：支援 authProviderId 查詢
    └── app/
        ├── auth/sign-in.tsx   # 重寫：Google OAuth + 邀請碼
        ├── parent/(tabs)/
        │   ├── family.tsx     # 修改：邀請碼生成
        │   ├── review.tsx     # 重寫：修復 listener 洩漏
        │   └── rewards.tsx    # 未改（useFamily 替換可選做）
        └── child/(tabs)/
            ├── tasks.tsx      # 重寫：真實相機 + 慶祝動畫
            ├── rewards.tsx    # 修改：移除 client 端點數操作
            └── points.tsx     # 修改：i18n 修正
```
