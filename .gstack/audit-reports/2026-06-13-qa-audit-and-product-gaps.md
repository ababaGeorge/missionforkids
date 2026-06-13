# missionforkids QA 審查 + 產品缺口報告

> 產出：2026-06-13｜方法：6 維度並行審查 + 對抗驗證（skeptic 推翻）+ 設計文件比對
> 基線測試：RN jest 13/13、Functions jest 51/51、tsc 0 錯誤（皆綠）
> 工程審查：20 個經對抗驗證「確認屬實」、2 個判定誤報、56 個「已發現但驗證階段中途撞額度未二次驗證」

---

## 列表 A：工程問題（已對抗驗證確認）

### 🔴 CRITICAL — 點數經濟可被擊穿（上線前絕對必修）

**A1. 小孩可自批任務 → 無限發點**（`firestore.rules:76` + `functions/src/onTaskInstanceApproved.ts:22`）
- rules 對 taskInstances 的 update 只要求「是家庭成員」，小孩本身就是成員 → 可把自己的 taskInstance 從 submitted 直接改成 `approved`。
- 後端 trigger 只看「狀態變成 approved」就發點，完全不檢查是誰改的。
- 小孩還能自建任務 + 自建 instance + 自批，攻擊閉環完整。**整個任務獎勵核心機制形同虛設。**

**A2. 兌換金額由 client 決定 → 1 點換走貴重獎勵**（`functions/src/onRewardOrderCreated.ts:25`）
- 扣點金額直接取訂單上的 `pointCostSnapshot`（client 寫的），CF 只驗「是正整數」，**從不讀 rewardItems 比對真實售價**。
- 建一筆 itemId 指向 1000 點獎勵、pointCostSnapshot=1 的訂單 → 1 點換走。點數經濟崩潰。

**A3. 任何人可自升 parent → 跨家庭完全接管**（`firestore.rules:42`）
- familyMemberships 的 create 只要登入就放行，不驗 doc id、不驗 userId 是不是自己、不限 role。
- 任何登入者可建 `{自己uid}_{任意familyId}` 且 role=parent；小孩也能把自己 child membership 改成 parent。
- 升 parent 後可呼叫 grantPoints 對自己無限發點、刪別人任務、改家庭資料。**權限模型的根鑰匙交給了 client。**

### 🟠 HIGH — 兒童 PII 外洩 / 上架阻斷 / 功能壞掉

**A4. 全平台兒童照片可被任意帳號列舉下載**（`firestore.rules:82`）
- taskSubmissions 的 read 只要登入，無家庭隔離 → 任一帳號可 `collection().get()` 撈出全 App 所有家庭的提交（含 photoUrls / childNote）。照片 URL 帶 token、繞過 storage.rules 直接可下載。**兒童影像大規模外洩，法遵風險極高。**

**A5. 全平台 email / 個資可被任意帳號讀取**（`firestore.rules:28`）
- users 的 read 只要登入 → 可枚舉所有使用者 email、displayName、childId。

**A6. 小孩可自批兌換訂單 → 繞過家長同意**（`firestore.rules:120`）
- rewardOrders 的 update 只要是家庭成員，小孩可把訂單從 pending 改 approved，繞過「爸媽要先答應」的核心關卡，也能亂改手足訂單。

**A7. 公開 repo 硬編 production 測試帳號密碼**（`src/app/auth/sign-in.tsx:25` + `functions/scripts/seed-dev-family.ts:37`）
- `DEV_PASSWORD = 'mfk-dev-2026!'` 明文 commit 進 **PUBLIC** GitHub repo，三個 @mfk.test 帳號在 production 專案真實存在、啟用中。
- 任何看到 repo 的人可登入 prod，以家長身分呼叫會燒 OpenAI 配額的 analyzePhoto、會發信的 createFamilyInvite。`__DEV__` 只隱藏按鈕，密碼字串本身公開。

**A8. 家長「兌換訂單歷史」在 production 永遠空白且無聲失敗**（`src/app/parent/(tabs)/rewards.tsx:111`）
- 查詢用 `where(familyId)+orderBy(createdAt)` 需要 `(familyId ASC, createdAt DESC)` 複合索引，但 prod 沒這條（已用 Admin API 確認）。
- 該 listener 還少傳 error callback，FAILED_PRECONDITION 被吞掉，console 也沒痕跡 → 家長以為「沒有訂單」。

### 🟡 MEDIUM

- **A9. grantPoints 無冪等鍵**（`grantPoints.ts:77`）：家長連點兩下重複發點，且 UI 按鈕沒防連點（同檔邀請按鈕反而有 `disabled`，是遺漏）。
- **A10. 家庭關係圖可被列舉**（`firestore.rules:43`）：familyMemberships read 只要登入，可撈全平台成員 uid/childId/暱稱/role（也是 A3 跨家庭攻擊的偵察入口）。
- **A11. 跨家庭注入垃圾資料**（`firestore.rules:64`）：多集合 create 不綁 familyId，可往別人家庭塞假任務/假兌換。
- **A12. 帳本與家庭名稱全表可讀**（`firestore.rules:102`）：pointTransactions / families read 只要登入。
- **A13. store build 未鎖 Xcode 版本**（`eas.json:14`）：只有 development profile 鎖了 Xcode 16.3，preview（送 TestFlight）/ production 沒鎖。EAS 哪天升 Xcode 26 → gRPC 不相容 build 直接失敗。
- **A14. 兒童 App 宣告用不到的麥克風權限**（`app.json:34`）：RECORD_AUDIO + 未設 microphonePermission=false。Google Play Families / App Store Kids 審查對此特別嚴，有退審風險。（修法需同時加 android.blockedPermissions，光移除陣列不夠。）
- **A15. jest 不 mock firestore → 核心畫面零測試**（`jest.setup.js`）：所有掛 Firestore listener 的畫面（tasks/rewards/review/notif/family）無單元測試。A8 那類「缺索引無聲失敗」正是這盲區會漏的 bug。

### 🟢 LOW

- **A16. 邀請連結外洩可讀到受邀 email**（`firestore.rules:54`）：familyInvites `get: if true`，未登入者拿到 inviteId 即可讀 email/暱稱；已接受/過期後仍恆真（invite 永不刪）。
- **A17. 停用成員仍可存取家庭照片**（`storage.rules:7`）：isFamilyMember 只檢查 membership 存在、不檢查 status==active。配合 family.tsx「移除成員」是 soft delete，被移除者在 Storage 層仍通過。
- **A18. withModularHeaders.js 名實不符**：實際只注入 static framework flag，跟 `.claude/rules/expo-rn-firebase.md` 描述的做法脫節（過期文件）。
- **A19. CLAUDE.md 寫 react 19.2.5、實際是 19.1.0**：照文件「修正」會打破 Expo 54 配對、觸發 EAS peer dep 失敗。

### ⚠️ 已發現但驗證階段撞額度、尚未二次確認（56 項，列高嫌疑者）

這些是審查者找到、但對抗驗證 agent 還沒驗就斷電的，**不是誤報，是待驗證**。看起來高度可信的：
- `getFamilyInvite` 用 `.exists` 屬性而非 `.exists()` 方法 → 判斷恆為 false（典型真 bug）
- parent 路由沒有角色守衛，小孩可經 deep link 進家長審核頁
- 訂單頁「取消訂單」按鈕是假的：只關畫面、不取消不退點
- 退款不檢查履約狀態：已交付/完成訂單仍可退款（領獎又退點）
- acceptFamilyInvite 未要求 email 已驗證 → 未驗證 email 可冒領邀請
- 「[dev] 假提交（跳過拍照）」按鈕沒 `__DEV__` gate，正式版對所有小孩可見
- registerChild/Parent 非原子：建完 Auth 才呼叫 function，失敗重試必爆 email-already-in-use
- useAuth/useFamily 的 onSnapshot 無 error handler、無 race guard → 換帳號殘留舊資料、出錯永久卡 loading
- 任務提交兩段非原子寫入；submissionCount 用 client 讀值 +1 而非 increment
- 新增任務/給點/審核按鈕普遍可連點重複送出
- models.ts 多個欄位（submittedAt/parentNote/rejectNote）型別缺漏但實際有寫入
- Timestamp 來源混用（client Timestamp.now() vs serverTimestamp）

### ✅ 判定為誤報（2 項，無需處理）
- pointWallets create 規則寬鬆 → 實際因「membership 與錢包同 atomic transaction 共建 + childId 不可猜 + userId 欄位非權威」攻擊不可達，頂多 defense-in-depth nit。
- firebase.json emulator 缺 storage → 實際頂層已有 storage 設定，emulator 可正常啟動（真缺口是沒有 storage rules 測試，屬另一維度）。

---

## 列表 B：產品缺口（離「成品」還差什麼）

對照設計文件 `docs/任務獎勵App_決策文件.md`（家庭版 MVP）。

### 設計過、但沒做 / 只做半套的核心功能

| # | 功能 | 設計意圖 | 現況 | 分級 |
|---|------|---------|------|------|
| B1 | **AI 照片審核** | 招牌功能：孩子拍照、AI 判斷「有沒有做」；三模式 AI/半自動/人工 | `analyzePhoto` CF 真接了 OpenAI，但 **src 完全沒呼叫它**（孤兒函式）。reviewMode 只有 `semi_auto`/`manual`，連 `ai` 選項都沒有，semi_auto 實際沒跑 AI。 | 🔴 招牌缺 |
| B2 | **推播通知** | 家長要知道小孩交任務、小孩要知道被核准 | **完全沒做**：零 FCM / 零 expo-notifications。只有開 App 才看得到的 in-app 列表。 | 🔴 體驗核心缺 |
| B3 | **週期任務** | 每日/每週/每月/每學期，自動結算進下一期 | 有 `frequency` 欄位，但**沒有任何排程 function 自動生成下一期 instance**；缺「每學期」型別。建了週期任務不會自動重生。 | 🔴 半套 |
| B4 | **Apple / Google 登入** | Sign in with Apple 為「必要」 | 兩顆按鈕都跳「尚未設定」alert，死路。目前只有 email/密碼 + dev mode。 | 🟠 上線必備 |
| B5 | **取消訂單** | 兌換流程含取消 | 小孩端「取消」只關畫面，不真的取消、不退點。 | 🟠 假按鈕 |
| B6 | **完成統計 / 成長數據** | 完成率、連續天數、點數趨勢（家長與孩子都可看） | 「我的」頁徽章寫死、連續天數永遠 0。統計未做。 | 🟡 假數據 |
| B7 | **通知已讀狀態** | — | 只存記憶體，重啟全變未讀；點卡片不導頁。 | 🟡 |
| B8 | **i18n（繁中+英文上線）** | 第一版上線雙語 | 翻譯檔完整但 95% 畫面硬編中文，鎖死 zh-TW。 | 🟡 |
| B9 | **離線能力** | 基本離線（任務查看/打卡） | snapshot 錯誤直接當「沒資料」，無離線處理。 | 🟡 |
| B10 | **孩子提議任務** | 第一版要（家長審核後開放） | 未見實作。 | 🟡 |
| B11 | **點數真實換算建議** | 100點≈NT$100 給家長參考 | 未見。 | 🟢 |

### 需「外部動作」才能上線（不是寫程式能解決的）

- 🔴 **Resend 自有寄件網域**：目前用 sandbox `onboarding@resend.dev`，對外開放前必換。
- 🔴 **COPPA / GDPR-K 兒童隱私法遵**：13 歲以下帳號由家長建立並同意的流程 + 隱私政策。
- 🔴 **App Store / Google Play Families 上架審核**：兒童類別審查嚴格（含 A14 麥克風權限）。
- 🟠 **Apple Developer 帳號驗證**：B4 的 Apple Sign-In 卡在這。

---

## 一句話總結

工程基線（測試、型別）是綠的，但 **firestore.rules 幾乎沒有真正的家庭隔離與角色權限**，導致「點數走 CF」這個專案核心原則在 client 直連 Firestore 的路徑上被整片繞過 —— 這是目前**最嚴重、且阻斷上線**的問題群（A1–A6）。產品面則是「招牌 AI 審核沒接線、推播沒做、週期任務半套」三個核心缺口（B1–B3）。
