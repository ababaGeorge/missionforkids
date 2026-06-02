# 設計：真實使用者帳號系統（取代全匿名登入）

- **日期**：2026-05-26
- **狀態**：設計定案，待寫實作計畫
- **分支**：`feat/real-user-accounts`（從 `main` 分出）

## 問題

App 目前**只有匿名登入**（`signInAnonymously()` 是唯一登入方式，家長和小孩都是）。匿名 uid 綁的是「這台裝置這次安裝」，不是「人」：重裝 App、清資料、換手機、或 dev 反覆重登，都會拿到全新 uid。這一個根因衍生三個問題：

1. **測試卡關**：dev 每次重登拿到新 uid，身分對不起來，難以連續測試。
2. **點數身分碎片化**（長期 bug「點數不同步」）：一個小孩的點數散在 placeholder id + 多個歷史 auth uid 的錢包，系統從沒有「這個小孩的單一錢包」。實測 dev-family-001 的 QQ：103 分散在 4 個身分、6 個錢包，且原始 placeholder 已被標 removed、53 分被孤立。
3. **家長重裝 App 整個家庭消失**：家長也是匿名，重裝就找不回家庭。

## 目標

用真帳號取代匿名登入，一次解掉上述三個問題。匿名登入是 demo 階段的捷徑，App 要推出就必須補上真帳號。

## 鎖定的決策

1. **小孩有自己的真帳號**（一等公民，不是家長底下的 profile）。
2. **登入方式**：Phase 1 做 email/密碼；Phase 2 補 Google / Apple。
3. **分層模型**：「登入方式（門）」與「家庭歸屬（邀請）」解耦。Firebase Auth 是中央身分庫，一個帳號可掛多扇登入門；家庭歸屬由邀請決定，與用哪扇門無關。這讓「未來只留 OAuth」只是關掉一扇門，不動家庭/點數。
4. **加入家庭走 email 邀請**：家長輸入小孩 email → 真寄一封邀請信 → 小孩點連結 → 設定帳號 → 自動綁進邀請者的家庭。
5. **帳號連結（Phase 2）**：onboarding 主動鼓勵連結 Google/Apple；email 碰撞時引導救援。讓同一個人用不同門進來都解析到同一個 uid。
6. **childId 點數保險絲**：小孩有一個永久 `childId`，**點數釘在 childId、不是 uid**。錢包 doc id 改成確定性的 `{familyId}_{childId}`，保證一個小孩在一個家庭只有一個錢包。即使未來冒出意外新 uid，只要把它指回原 childId，點數一分不散。
7. **資料遷移**：現有資料全是測試資料，**直接清空、不遷移**，往前建新架構。
8. **分階段**：Phase 1 先把 email/密碼的完整真帳號 App 做出來（零外部阻擋、馬上能推進）；Google/Apple 等外部設定就緒後在 Phase 2 補。
9. **無「家長重設小孩密碼」功能**：小孩用 Firebase 內建的標準「忘記密碼」自助重設（免費、內建寄信）。太小的小孩由家長用其 email 代為操作同一流程，家長端不需特殊功能。
10. **邀請信寄送**：Cloud Function 直接呼叫 **Resend API** 寄品牌邀請信。測試階段用 `onboarding@resend.dev` 免驗證網域；上線前再驗證自有寄件網域。

## 資料模型

**Firebase Auth = 中央身分庫**。家長、小孩各一筆真帳號、永久 uid。

**Firestore：**

| Collection | Doc id | 主要欄位 |
|---|---|---|
| `users/{uid}` | = auth uid | `roleType`(parent/child)、`displayName`、`email`、`childId`(小孩專用)、`createdAt` |
| `families/{familyId}` | auto | `name`、`createdBy`、`createdAt` |
| `familyMemberships/{uid}_{familyId}` | 確定性 | `userId`(uid)、`childId`、`familyId`、`role`、`status`(active/removed)、`nickname`、`avatarEmoji`、`joinedAt` |
| `pointWallets/{familyId}_{childId}` | **確定性** | `childId`、`familyId`、`balance`、`updatedAt` |
| `familyInvites/{inviteId}` | auto | `email`、`familyId`、`role`、`invitedBy`、`status`(pending/accepted/expired)、`childProfile`(暱稱/頭像)、`createdAt`、`expiresAt` |

**childId 規則**：小孩建帳號時產生 `childId`（值預設 = 當下 uid，但獨立成欄位）。點數一律釘 childId。`taskInstances` 與 `rewardOrders` 寫入時帶上 `childId`（由小孩端 context 的 `users/{uid}.childId` 解析）。讀取錢包：`my uid → users/{uid}.childId → pointWallets/{familyId}_{childId}`。

**`useAuth` 簡化**：真帳號後，家長與小孩的 `users` doc id 都 == uid，直接 `users/{uid}` 一次查到，退掉舊的 `authProviderId` 反查（placeholder 模型遺留）。

## 核心流程（Phase 1，email/密碼）

### 家長註冊
email/密碼註冊 → 建立 Firebase Auth 帳號(uid) → 建 `users/{uid}`(parent) + 建 `families/{familyId}` + 家長 membership → 進家長頁。

### 家長邀請小孩
家長輸入小孩姓名 + email（可選暱稱/頭像）→ Cloud Function `createFamilyInvite` 建 `familyInvites/{inviteId}` → 同一函式呼叫 Resend 寄出含 deep link 的邀請信（連結帶 `inviteId`）。

### 小孩接受邀請並註冊
小孩開信點連結 → App 開啟（未安裝先到下載頁，裝完回來）→ 讀 `inviteId` 顯示「你被邀請加入〔家庭〕為〔暱稱〕」→ 小孩設定 email/密碼（email 由邀請預填）→ 建立 Firebase Auth 帳號(child uid) → Cloud Function `acceptFamilyInvite(inviteId)`（transaction）：
- 產生 `childId`
- 建 `users/{uid}`(child, childId)
- 建 `familyMemberships/{uid}_{familyId}`(childId, active)
- 建 `pointWallets/{familyId}_{childId}`(balance 0)
- 標記 invite `accepted`
→ 進小孩頁。

### 點數（全部改用 childId）
- `grantPoints`：家長端傳 childId（家長 UI 由 membership 取得）→ 寫 `{familyId}_{childId}`。
- `onTaskInstanceApproved`：用 `taskInstance.childId` → 寫同一錢包。
- `onRewardOrderCreated` / 退款：用 `rewardOrder.childId` → 扣/退同一錢包。
- 各頁讀取：解析當前 uid → childId → 讀 `{familyId}_{childId}`。

### 密碼重設
小孩用 Firebase 內建 `sendPasswordResetEmail` 自助重設（免費內建寄信）。家長端無特殊功能。

### 清理 & dev
- 清空所有測試資料（dev-family-001、所有匿名帳號、散錢包、孤兒 membership）。
- 退掉匿名 dev 捷徑 + `bootstrapDevSession`，改成「用固定真 email 測試帳號 seed 一個測試家庭」的腳本。dev 測試固定登入同一組真帳號，不再每次拿新 uid → 卡關問題消失。

## 錯誤處理
- 邀請過期 / 已使用 / 無效 → 明確訊息。
- 註冊時 email 已存在 → 引導去登入（此處正是 Phase 2 OAuth 碰撞救援的掛點）。
- 所有 Cloud Function 驗證權限（建邀請/接受需檢查角色與家庭歸屬）。
- 錢包寫入走 transaction + 確定性 doc id → 防重複錢包。
- Resend 寄信失敗 → 邀請 doc 仍建立，回傳可重寄；不讓寄信失敗卡住整個邀請建立。

## 測試
- 真測試帳號：1 家長 + 2 小孩（email/密碼）。
- 驗證路徑：家長註冊→建家庭；邀請→小孩收信→註冊→綁定家庭；任務發點 / 家長給點 / 兌換扣點全部進同一個 `{familyId}_{childId}` 錢包；各頁餘額一致；小孩自助重設密碼。
- dev seed 腳本建立上述測試家庭（取代匿名 bootstrap）。

## Phase 1 範圍

**做：**
- email/密碼登入（家長 + 小孩）
- 建立家庭
- email 邀請（Resend）+ 接受綁定
- childId 點數重構（確定性單一錢包）
- 自助密碼重設（Firebase 內建）
- 清空測試資料
- 退匿名 dev、改真帳號測試 seed
- Firebase 啟用 Email/Password provider
- 邀請接受的 deep link 設定
- Resend 串接（API key 放 Functions secret）

**不做（Phase 2，架構預留）：**
- Google / Apple 登入接線
- 主動連結 provider + email 碰撞救援
- 自有寄件網域驗證（測試先用 resend.dev）

## 外部前置與依賴

- **新依賴：Resend**（交易寄信）。需建立帳號 + 取得 API key，存為 Firebase Functions secret，不進 git。免費額度 3000/月、100/天，足夠。
- Firebase Console 啟用 Email/Password 登入。
- App deep link / universal link 設定（接住邀請連結）。
- （Phase 2）Google OAuth client、Apple「Sign in with Apple」capability + Apple Developer 帳號、自有寄件網域。

## 非目標 / YAGNI

- 不做家長重設小孩密碼的專屬功能（用內建自助重設）。
- 不做混合身分模型（大孩子自帳號 / 小小孩掛家長）—— 統一「小孩有真帳號」。
- 不做現有資料遷移（全清）。
- Phase 1 不碰 Google/Apple 與連結邏輯（僅預留掛點）。
