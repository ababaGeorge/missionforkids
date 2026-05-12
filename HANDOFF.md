# Mission for Kids — Session 交接文件

> 更新時間：2026-04-12
> 上一個 Session 完成了 Phase 1 + Phase 2 程式碼撰寫 + Firebase 建設

---

## 專案路徑

```
~/conductor/workspaces/missionforkids/manado/
```

## 設計文件

- 批准的設計：`docs/design-core-loop-ai-demo.md`（APPROVED）

## 已完成的步驟

### Step 0: Firebase 專案 ✅
- 專案 ID: `mission-for-kids`
- Firestore、Auth（Anonymous + Google）、Storage 已啟用
- `GoogleService-Info.plist` + `google-services.json` 已下載
- Apple Auth 待 Apple Developer 付費驗證通過
- Secret Manager API 已啟用（for OpenAI key）

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

### Step 8: Storage Rules ✅（已部署）
- `storage.rules` — 正式版安全規則
  - `families/{familyId}/submissions/` — 家庭成員讀寫，via `firestore.exists()` 跨服務查詢
  - `playground/{userId}/` — AI Playground 照片，僅本人可存取
  - 限制 5MB、僅限圖片、不可覆蓋或刪除
  - 其他路徑一律拒絕

### Step 9: AI Playground ✅（程式碼完成，待部署 Cloud Function）
- `functions/src/analyzePhoto.ts` — OpenAI Vision API callable function
  - 使用 `gpt-4o-mini`，JSON response format
  - 10 秒 timeout + fallback 訊息
  - 結果記錄到 `aiPlaygroundLogs`
  - **需要設定 OPENAI_API_KEY secret**：`firebase functions:secrets:set OPENAI_API_KEY`
- `src/app/child/(tabs)/ai.tsx` — AI Playground tab
  - 拍照 → 上傳到 `playground/{uid}/` → 呼叫 analyzePhoto → 顯示結果
- `src/components/AIThinkingAnimation.tsx` — 跳動圓點動畫
- i18n 已更新（en.json + zh-TW.json 加入 `ai.*` keys）

### 依賴修復 ✅
- `expo-build-properties` 從 55.0.13 降級到 ~1.0.10（SDK 54 相容）
- `react` 從 19.2.5 降級到 19.1.0（SDK 54 要求）
- `react-dom` override 到 19.1.0（避免 peer dep 衝突）
- 修復 Node 25 simdjson dylib 問題（symlink 4.4.2 的 libsimdjson.31.dylib）

---

## 待完成的事項

### Step 1: Build（進行中）
- 最新 Build：正在跑中（修好依賴版本後）
- 檢查狀態：`PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build:list --limit 1`
- 之前三個 build 都因依賴問題失敗，已修復

### 待部署：analyzePhoto Cloud Function
- 需先設定 OpenAI API key：
  ```bash
  firebase functions:secrets:set OPENAI_API_KEY
  ```
- 設定完後部署：
  ```bash
  cd functions && npm run build && cd .. && firebase deploy --only functions
  ```

### 未完成的設定
- [ ] Google Sign-In webClientId（Firebase Console → Authentication → Sign-in method → Google → Web client ID）
- [ ] Apple Sign-In（等 Apple Developer 驗證通過）
- [ ] Google Sign-In 在 Firebase Console 啟用後，設定到 sign-in.tsx 的 GoogleSignin.configure()
- [ ] `@react-native-firebase/functions` 已安裝但需要新 build 才能使用

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

# 部署 Storage Rules
firebase deploy --only storage

# 查看 build 狀態
PATH="/opt/homebrew/opt/node@22/bin:$PATH" eas build:list --limit 1

# 設定 Secret（for Cloud Functions）
firebase functions:secrets:set OPENAI_API_KEY
```

---

## 新增/修改的檔案（本次 Session）

```
manado/
├── storage.rules              # 正式版 Storage 安全規則
├── .gitignore                 # 加入 functions/lib/
├── package.json               # 依賴修復 + react-dom override
├── functions/
│   └── src/
│       ├── index.ts           # 加入 analyzePhoto export
│       └── analyzePhoto.ts    # 新增：AI 照片分析 Cloud Function
└── src/
    ├── components/
    │   └── AIThinkingAnimation.tsx  # 新增：AI 思考動畫
    ├── i18n/
    │   ├── en.json            # 新增 ai.* keys
    │   └── zh-TW.json         # 新增 ai.* keys
    └── app/child/(tabs)/
        ├── _layout.tsx        # 新增 AI tab
        └── ai.tsx             # 新增：AI Playground 畫面
```
