# 改善輪 R2 — Cowork 分診修復計畫與規格

> 狀態：**APPROVED**（2026-07-09，權威文件；批次一已落地並回填結果）
> 分支：`fix/cowork-round2`（基於 main `fcb0e0d`）
> 輸入：scope workflow 五讀取器＋合成產出的 R2 backlog（28 項＋7 排除）
> 參考修法來源：已關閉 PR #8（本地分支 `pr8-audit-reference`）——**只當語意參考，一律以現行程式碼為底自寫**（該分支 base 早於 R1，直接搬會蓋掉 R1 修復）

---

## 0. 一頁摘要

R2 backlog 收 **28 項**（code-fix 21、test-only 6、data-cleanup 1）。嚴重度分佈：critical 1、high 6、medium 9、low/cosmetic 12。審查另新增 2 項後續（R2-29/30，見 §5）。

| # | 標題（短） | 嚴重度 | kind | 主要檔案 | 狀態 |
|---|---|---|---|---|---|
| R2-01 | CF FieldValue/Timestamp 改官方模組匯入 | 🟢 low | code-fix | functions/src/*（9 支 CF） | ✅ `f2da500` |
| R2-02 | acceptFamilyInvite 重複接受邀請歸零錢包 | 🔴 critical | code-fix | functions/src/acceptFamilyInvite.ts | ✅ `566cc15` |
| R2-03 | 扣款-取消競態點數遺失 | 🟠 high | code-fix | functions/src/onRewardOrderCreated.ts | ✅ `b91fc47` |
| R2-04 | 核准/婉拒無狀態守衛（重複領獎） | 🟠 high | code-fix | src/app/parent/(tabs)/review.tsx | 待做 |
| R2-05 | 兩步註冊無失敗恢復（帳號卡死） | 🟠 high | code-fix | src/lib/auth/register*.ts | 待做 |
| R2-06 | useAuth 一次性 get() 永久卡轉圈 | 🟠 high | code-fix | src/hooks/useAuth.ts、src/app/index.tsx | 待做 |
| R2-07 | 小孩清單未過濾 archived 任務 | 🟠 high | code-fix | src/app/child/(tabs)/tasks.tsx | 待做 |
| R2-08 | 家長編輯任務四個狀態機 bug | 🟠 high | code-fix | src/app/parent/(tabs)/tasks.tsx | 待做 |
| R2-09 | 審核/獎勵頁 snapshot 組裝脆弱 | 🟡 medium | code-fix | review.tsx、parent rewards.tsx | 待做 |
| R2-10 | 品項封存後商城鎖死無法取消 | 🟡 medium | code-fix | src/app/child/(tabs)/rewards.tsx | 待做 |
| R2-11 | 小孩通知頁 limit(20) 無 orderBy | 🟡 medium | code-fix | src/app/child/(tabs)/notif.tsx | 待做 |
| R2-12 | storage 上傳上限 5MB 過低 | 🟡 medium | code-fix | storage.rules | 待做（裁決：12MB） |
| R2-13 | 扣點 clamp 提示顯示請求值非實際值 | 🟡 medium | code-fix | grantPoints.ts、family.tsx | ✅ `8695dc6` |
| R2-14 | 邀請入口 FAB 無文字不可發現 | 🟡 medium | code-fix | src/app/parent/(tabs)/family.tsx | 待做 |
| R2-15 | 通知點擊導覽＋已讀持久化 | 🟡 medium | code-fix | src/app/parent/(tabs)/notif.tsx | 待做（裁決：拆半） |
| R2-16 | memberName fallback 未捕捉 permission-denied | 🟢 low | code-fix | src/lib/memberName.ts | 待做 |
| R2-17 | 慶祝動畫閃「+0」 | 🟢 low | code-fix | src/app/child/(tabs)/tasks.tsx | 待做 |
| R2-18 | 小孩詳情頁卡 loading 無出口 | 🟢 low | code-fix | child task/[id].tsx、order/[id].tsx | 待做 |
| R2-19 | 剛加入即顯示「加入 1 個月」 | ⚪ cosmetic | code-fix | src/app/child/(tabs)/me.tsx | 待做 |
| R2-20 | 設定頁死元件/佔位無回饋 | ⚪ cosmetic | code-fix | me.tsx、family.tsx | 待做 |
| R2-21 | SDD ledger Minor 收尾包（六組） | 🟢 low | code-fix | models.ts 等 6 檔 | 待做 |
| R2-22 | 收割核心迴圈 E2E 腳本 | 🟡 medium | test-only | functions/scripts/core-loop-e2e.cjs | ✅ `f5a784a` |
| R2-23 | jest 白名單補 @expo-google-fonts | 🟢 low | test-only | jest.config.js | ✅ `0b728fb` |
| R2-24 | 補測：家長完整註冊實際送出 | 🟡 medium | test-only | —（實測） | 待做 |
| R2-25 | 補測：退回 3 次變 missed 門檻 | 🟡 medium | test-only | —（實測） | 待做 |
| R2-26 | 補測：通知 >20 筆不漏最新 | 🟢 low | test-only | —（實測） | 待做 |
| R2-27 | 低優先回歸池（視成本挑做） | 🟢 low | test-only | —（實測） | 待做 |
| R2-28 | prod 測試資料清理批次 | 🟢 low | data-cleanup | Firestore（dev-family-seed） | 待做（🔴 需授權） |

規模聲明：**28 項、約 20+ 個檔案**（遠超 8 檔門檻，明示）。每項獨立 commit、獨立可回退，批間跑測試閘門。

測試基線（批次一結束時）：**functions tests 65 全綠、App jest 13 全綠、`tsc --noEmit` 0 錯、E2E 59/59**。

---

## 1. 來源與方法

本 backlog 由 scope workflow 的**五個讀取器＋一個合成器**產出：

1. **測試報告讀取器**：Run 01（`docs/testing/results/2026-07-06-test-run-01.md`）＋ Run 02 回測報告＋ ux-recommendations 測試員補充區。
2. **Run 02 報告讀取器**：Run 02 殘留缺陷（DEFECT-R2-01）與未測項。
3. **fix plan 讀取器**：R1 計畫 §6「下輪候選（不丟失清單）」逐項對帳。
4. **PR8-diff 讀取器**：`git diff main...pr8-audit-reference` 全 7 commits / 33 檔逐 hunk 歸類——這是 R1 承諾「PR #8 其餘 14 修不丟失」的兌現。
5. **程式定位讀取器**：對 UX 觀察項給出現行碼精確行號與最小修法。

合成器把五路共 47 個原始項目**語意比對合併去重**為 28 項（例：兩個讀取器各自用「R2-U6」指不同問題，已拆為 R2-13 與 R2-07），輸入每項均有歸屬、零遺漏。**PR #8 語意比對原則**：判定 main 是否已有等效實作看語意不看行號；已收割的（如 R1 的 83f0545/c2260f4/25b4a48/6d213b3）列排除，未收割的立項且一律以現行碼為底自寫。

---

## 2. 指揮官裁決（三項，動手前定案）

| 項 | 裁決 | 理由 |
|---|---|---|
| **R2-12** | 採 **12MB storage rules**（PR8 現成解），client 壓縮（expo-image-manipulator）列未來優化 | 零新增依賴、PR8 驗過；流量成本上升輕微，換來旗艦機拍照不被拒。部署需 `firebase deploy --only storage`（使用者 `!`） |
| **R2-15** | **拆半**：導覽（點通知 → router.push 到對應審核項/訂單）本輪做；**已讀持久化延 R3** | 導覽是純 client 小改、Run 01 實證痛點；已讀持久化涉及資料模型選擇（readBy 欄位 vs 獨立 collection），需過 /think，不在修復輪倉促定 schema |
| **R2-28** | **需使用者授權才執行**（🔴 prod 寫入） | 清理前先列出將刪除的 doc 清單給使用者過目，確認不動錢包/pointTransactions；建議排在 Run 03 回測前做，避免殘影干擾判讀 |

---

## 3. 各項規格（id → 根因/修法 → 驗收）

### 批次一（已完成，規格留存備查）

#### R2-01 🟢 low｜code-fix｜S — 9 支 CF 的 FieldValue/Timestamp 改官方模組匯入 ✅ `f2da500`
- **檔案**：functions/src/ 下 9 支 CF 共 21 處。
- **根因/修法**：firebase-admin v13 頂層 `admin.firestore` 無 prototype，emulator 的 proxy bind() 丟失靜態屬性 → emulator 內 CF 全滅（prod 不受影響）。機械改 `import { FieldValue, Timestamp } from 'firebase-admin/firestore'`。R2-22 的硬前置。
- **驗收**：functions build 通過；`grep 'admin.firestore.FieldValue\|admin.firestore.Timestamp' functions/src` 零命中；emulator 冒煙無 TypeError。
- **來源**：PR8 讀取器 R2-U15（PR #8 `c5e15b2`）。

#### R2-02 🔴 critical｜code-fix｜M — acceptFamilyInvite 無條件覆寫 user/membership/錢包 ✅ `566cc15`
- **檔案**：`functions/src/acceptFamilyInvite.ts`。
- **根因/修法**：原對 users/membership/pointWallets 一律 `tx.set` 整份覆寫：同 email 第二張邀請接受後錢包歸零（點數永久遺失）、家長帳號接受 child 邀請被降級。修法：read 全移 write 前；`userSnap.exists && roleType==='parent'` 丟 `ALREADY_PARENT`；user/membership/wallet 改「不存在才建」。
- **驗收**：E2E step 12——錢包有 20 點接受第二張邀請餘額仍 20、暱稱不變；家長接受 child 邀請回 ALREADY_PARENT、user doc 不變。
- **來源**：PR8 R2-U1＋fix plan §6＋測試報告讀取器。審查衍生後續項 R2-29（見 §5）。

#### R2-03 🟠 high｜code-fix｜S — 扣款-取消競態點數遺失 ✅ `b91fc47`
- **檔案**：`functions/src/onRewardOrderCreated.ts`。
- **根因/修法**：扣款 transaction 只有重放保護、不重讀訂單現況；訂單在 trigger 執行前已取消時，退款 trigger 找不到扣款紀錄跳過、扣款稍後仍照扣 → 無帳可對。修法：交易內 `tx.get(snap.ref)` 重讀，`status !== 'pending'` 直接 return 不扣＋log skip。
- **驗收**：emulator 重現「建單→立即取消→trigger 執行」錢包不變；E2E 下單→取消→對帳點數守恆。
- **來源**：PR8 R2-U2＋fix plan §6。審查衍生後續項 R2-30（見 §5）。

#### R2-13 🟡 medium｜code-fix｜S — 扣點 clamp 提示顯示實際扣除值（DEFECT-R2-01） ✅ `8695dc6`
- **檔案**：`functions/src/grantPoints.ts`、`src/app/parent/(tabs)/family.tsx`。
- **根因/修法**：後端 clamp 正確但 CF 只回 `{success:true}`，client 成功 Alert 用家長輸入的請求值 → 餘額 40 扣 999 顯示「-999 ★」。修法：CF 回傳 `{ success, delta }`（冪等重放路徑 delta 回 null，client fallback 用 signed）；client 依 delta 組文案，`delta !== signed` 加註「已依餘額調整」。
- **驗收**：餘額 40 扣 999 → 提示「-40 ★（已依餘額調整）」；同 idempotencyKey 重放不 crash。
- **來源**：Run 02 DEFECT-R2-01（四路讀取器交叉確認）。

#### R2-22 🟡 medium｜test-only｜M — 收割核心迴圈 E2E 腳本 ✅ `f5a784a`
- **檔案**：`functions/scripts/core-loop-e2e.cjs`（新檔）。
- **修法**：收割 PR8 腳本並對齊 R2 實際範圍（移除 B10 step、B3 段；相容 R1 的 balanceBeforeSnapshot 欄位），firebase web SDK 模擬家長/小孩/訪客三真實 client（帶 auth token、受 rules 約束）打 emulator。落地版 **59 步**。
- **驗收**：`firebase emulators:exec --only firestore,auth,functions` 跑腳本全步通過（含重複邀請錢包不歸零、下單取消點數守恆）。
- **來源**：PR8 R2-U18。硬依賴 R2-01。

#### R2-23 🟢 low｜test-only｜XS — jest transformIgnorePatterns 補 @expo-google-fonts ✅ `0b728fb`
- **檔案**：`jest.config.js`。
- **修法**：白名單加 `|@expo-google-fonts/.*`，避免 RN 測試 import 字型模組 SyntaxError。
- **驗收**：既有測試套件全綠；import 字型模組的測試不再 SyntaxError。
- **來源**：PR8 R2-U19。

### 批次二：帳號穩定性

#### R2-05 🟠 high｜code-fix｜S — 兩步註冊無失敗恢復（孤兒 Auth 帳號卡死 email）
- **檔案**：`src/lib/auth/registerParent.ts:14`、`src/lib/auth/registerChild.ts:13`。
- **根因/修法**：createUser 成功但第二步 CF（bootstrapParentAccount / acceptFamilyInvite）失敗 → Auth 孤兒帳號，重試永遠 `email-already-in-use`。修法：catch 該錯誤 → `signInWithEmailAndPassword` 取回 session 再補跑 CF（兩支 CF 皆冪等，安全）。
- **驗收**：emulator 模擬第二步失敗後重試同 email → 成功登入並補跑 CF，進入正確角色首頁。
- **來源**：PR8 R2-U4（CRITICAL 帳號卡死群）。與 R2-06 同批。

#### R2-06 🟠 high｜code-fix｜M — useAuth 一次性 get() ＋ index.tsx 無逃生出口
- **檔案**：`src/hooks/useAuth.ts:30`、`src/app/index.tsx`。
- **根因/修法**：onAuthStateChanged 內對 users/{uid} 一次性 get()：CF 稍後補建 doc 時讀空即停 → 首頁永久轉圈；且無帳號切換世代守衛。修法兩半：(1) useAuth 改 onSnapshot 監聽＋世代守衛＋unsubUser 清理；(2) index.tsx 加 8 秒 stuck 偵測顯示「重新登入」逃生按鈕。R1 動過 useAuth 周邊，以現行碼為底自寫。
- **驗收**：doc 補建後首頁自動解鎖（不重啟 App）；讀取失敗 8 秒後出現可用的「重新登入」按鈕。
- **來源**：PR8 R2-U5。depends_on R2-05（同批建議非硬依賴）。

#### R2-29 🟡 medium｜code-fix｜XS — membership status='removed' 接受邀請不 reactivate（審查新增，詳見 §5）

### 批次三：任務／商城狀態機

#### R2-04 🟠 high｜code-fix｜S — 核准/婉拒兌換訂單無狀態守衛（重複領獎）
- **檔案**：`src/app/parent/(tabs)/review.tsx:568`、`:589`。
- **根因/修法**：handleApprove/handleReject 裸 `update({status:'approved'})` 不檢查當下是否仍 pending：小孩已取消（點數已退）的殘留卡片仍可核准 → 退了點還領獎。rules 層擋不了（家長本有權改 status）。修法：改 runTransaction 重讀，非 pending 丟 ORDER_NOT_PENDING/ORDER_GONE＋友善訊息。與 R1 P8 快照欄位相鄰，做相容確認。
- **驗收**：小孩取消後家長按「同意」→ 友善錯誤、Firestore status 仍 cancelled、錢包不變。
- **來源**：PR8 R2-U3＋fix plan §6。同檔順序：04 → 09 → 21。

#### R2-09 🟡 medium｜code-fix｜M — 審核/獎勵頁 snapshot 組裝脆弱
- **檔案**：`src/app/parent/(tabs)/review.tsx:109`、`:155`、`src/app/parent/(tabs)/rewards.tsx:113`。
- **根因/修法**：async 組裝迴圈無 per-item try/catch（單筆失敗炸全頁）、無世代守衛（慢快照覆蓋新結果、已審卡片回彈）、無 error callback（錯誤被吞）。修法：per-item try/catch＋useRef 世代守衛＋error callback（R1 已在 child notif/tasks 加過同款，此為 parent 端收割）。
- **驗收**：造一筆缺關聯 doc 的 instance → 其餘卡片正常＋console error log；連續快速審核兩筆不回彈。
- **來源**：PR8 R2-U9。depends_on R2-04（同檔）。

#### R2-07 🟠 high｜code-fix｜XS — 小孩清單未過濾 archived 任務
- **檔案**：`src/app/child/(tabs)/tasks.tsx:124`。
- **根因/修法**：家長刪任務是 soft delete（status='archived'），child 清單組裝只檢查 taskData 存在就 push → 已刪任務仍可見、可提交、核准照發點。修法一行：`if (taskData && taskData.status !== 'archived')` 才 push。
- **驗收**：家長封存有 pending instance 的任務 → 小孩清單即時消失、無法進詳情提交。
- **來源**：PR8 R2-U6。同檔順序：07 → 17。

#### R2-17 🟢 low｜code-fix｜S — 慶祝動畫閃「+0」
- **檔案**：`src/app/child/(tabs)/tasks.tsx:130`。
- **根因/修法**：instance 轉 approved 當下就 setCelebration，但 pointsAwarded 由 CF trigger 稍後補寫，快照先到顯示「+0」。修法：`status==='approved' && pointsAwarded != null` 才觸發；未到位前不推進 prevStatuses，補到時仍算一次轉換。
- **驗收**：核准 30 點任務 → 動畫顯示 +30，多次重試無 +0。
- **來源**：PR8 R2-U13。depends_on R2-07（同檔）。

#### R2-08 🟠 high｜code-fix｜M — 家長編輯任務四個狀態機 bug
- **檔案**：`src/app/parent/(tabs)/tasks.tsx:657`、`:692`、`:121`。
- **根因/修法**：(1) 任何編輯都重算覆寫 dueDate → 截止日後漂；(2) 移除孩子時 approved 的歷史 instance 也被標 missed → 毀點數帳本對應；(3) missed 孩子重加被 existingByUser 跳過 → 永卡 missed；(4) 查詢只抓 active，封存任務歷程消失。修法：freqChanged 才重算 dueDate；只把 pending/submitted/rejected 標 missed；missed 重加復活成 pending 並重設期限；查詢改 `status in ['active','archived']` 且 manage 分頁再過濾；歷程 approved 顯示 pointsAwarded 非任務現值。R1 `6d213b3` 動過此檔，以現行碼為底逐項自寫。
- **驗收**：只改標題 → dueDate 不變；移除 approved 孩子 → 其 instance 不變；missed 孩子加回 → 回 pending 且小孩端可見；封存後歷程仍顯示完成紀錄。
- **來源**：PR8 R2-U7。同檔順序：08 → 21。

#### R2-10 🟡 medium｜code-fix｜S — 品項封存後商城鎖死無法取消
- **檔案**：`src/app/child/(tabs)/rewards.tsx:104`、`:115`、`:131`。
- **根因/修法**：用 `items.find()` 從 active 清單找進行中訂單的品項；品項被封存後找不到 → 橫幅不顯示但 shop 鎖住，永久卡死（R1 `c31ec34` 灰卡文案是不同修復）。修法：品項不在清單時直接 get 該 doc 作 fallback。同檔一併修：訂單查詢 `.limit(20)` 無 orderBy、洩漏訂單內容的 console.log。
- **驗收**：下單後家長封存品項 → 小孩仍見訂單橫幅並可取消；grep 該檔 `limit(20)`/敏感 console.log 零命中。
- **來源**：PR8 R2-U8。

#### R2-11 🟡 medium｜code-fix｜XS — 小孩通知頁 limit(20) 無 orderBy
- **檔案**：`src/app/child/(tabs)/notif.tsx:72`。
- **根因/修法**：R1 `c2260f4` 只修家長頁；小孩頁仍 `.limit(20)` 無 orderBy，>20 筆後最新通知可能被截斷（client 排序救不回）。修法：移除 limit(20)。
- **驗收**：grep 該檔 `limit(20)` 零命中；配合 R2-26 灌 21+ 事件後最新事件在頂部。
- **來源**：PR8 R2-U11。修完 R2-26 一併覆蓋兩頁。

#### R2-12 🟡 medium｜code-fix｜XS — storage 上傳上限 5MB → 12MB（裁決定案）
- **檔案**：`storage.rules:22`、`:37`（參照 `src/lib/photoUpload.ts:15`）。
- **根因/修法**：rules 限 5MB，App 拍照只設 quality 0.7 無 resize，高畫素 JPEG 可超限 → 提交直接被拒。依 §2 裁決採 12MB（零依賴）；client 壓縮列未來優化。
- **驗收**：兩處均為 `12 * 1024 * 1024`；deploy 後 6MB 左右照片提交成功。部署 `firebase deploy --only storage`（使用者 `!`）。
- **來源**：PR8 R2-U10。

#### R2-16 🟢 low｜code-fix｜XS — memberName fallback 未捕捉 permission-denied
- **檔案**：`src/lib/memberName.ts:30`（參照 `firestore.rules:48`）。
- **根因/修法**：users list 規則只放行查自己，doc id ≠ uid 的舊資料走 authProviderId fallback 查詢會 permission-denied，錯誤沿 Promise.all 炸到呼叫端（與 R2-09 疊加成整頁消失）。修法：fallback 查詢包 try/catch 降級回 null 用 fallback 顯示名。
- **驗收**：emulator 造 doc id ≠ uid 成員 → 清單完整渲染、該成員顯示 fallback 名、console warn 而非整頁空白。
- **來源**：PR8 R2-U12。

#### R2-18 🟢 low｜code-fix｜S — 小孩詳情頁卡 loading 無出口
- **檔案**：`src/app/child/task/[id].tsx:85`、`src/app/child/order/[id].tsx:55`。
- **根因/修法**：task/[id] 內嵌 task get 失敗或 tData 空時不設 notFound → 永久轉圈；兩頁 onSnapshot 無 error callback（order 的 finally 半 R1 `25b4a48` 已收割）。修法：get 包 try/catch、空 → setNotFound(true)；兩頁補 error callback。
- **驗收**：開不存在的 task id → 顯示「找不到」；模擬讀取失敗 → 有出口不卡死。
- **來源**：PR8 R2-U14。同檔順序（order/[id].tsx）：18 → 21。

#### R2-30 🟢 low｜code-fix｜S — tx 外 reject 競態窗口＋退款 log 雜訊（審查新增，詳見 §5）

### 批次四：UI 提示與 minors 收尾

#### R2-14 🟡 medium｜code-fix｜XS — 邀請入口 FAB 改 extended（＋文字＋accessibilityLabel）
- **檔案**：`src/app/parent/(tabs)/family.tsx:382`（JSX）、`:744`（styles.fab）。
- **根因/修法**：邀請功能在（P9 補驗走通）但入口是 56x56 圓形 FAB 只有「+」，Run 01/02 代理與新用戶都找不到。修法：styles.fab 改 `flexDirection:'row'`＋paddingHorizontal，「+」旁加「邀請小孩」文字（顏色 P.bg、borderRadius 28），補 `accessibilityLabel="邀請小孩"`。
- **驗收**：FAB 顯示「+ 邀請小孩」且有 a11y label；點擊正常開邀請 modal。
- **來源**：Run 02 INVITE-ENTRY＋程式定位讀取器（原評 high 是在「不確定功能是否存在」前提下，P9 已證功能在，降 medium）。

#### R2-15 🟡 medium｜code-fix｜M — 通知點擊導覽（依 §2 裁決只做導覽半；已讀持久化延 R3）
- **檔案**：`src/app/parent/(tabs)/notif.tsx:176`。
- **根因/修法**：點通知卡只 markOneRead 不導覽（Run 01 重點⑤，R1 §6 下輪候選）。本輪只做：onPress 依通知類型 `router.push` 到審核頁對應 tab/項目（或任務/訂單詳情）。**不做**已讀寫回 Firestore（資料模型選擇延 R3，過 /think 再定）。
- **驗收**：點審核類通知 → 導向審核頁對應項目；點兌換類通知 → 導向對應訂單。已讀重登重置屬 R3 範圍，本輪不驗。
- **來源**：Run 01 重點⑤＋fix plan §6＋ux U10。

#### R2-19 ⚪ cosmetic｜code-fix｜XS — 剛加入即顯示「加入 1 個月」
- **檔案**：`src/app/child/(tabs)/me.tsx:113`、`:189`。
- **根因/修法**：joinMonths 用 `Math.max(1, …)` 硬撐。修法：按天數分段——0 天「今天加入」；<30 天「加入 X 天」；否則「加入 X 個月」。字串硬寫在 me.tsx 不在 i18n，照檔案現狀。
- **驗收**：剛加入顯示「今天加入」；5 天前「加入 5 天」；35 天前「加入 1 個月」。
- **來源**：handoff 待辦池＋程式定位讀取器。同檔順序：19 → 20 → 21。

#### R2-20 ⚪ cosmetic｜code-fix｜S — 設定頁死元件/佔位無回饋（Run 01 I3 / UX U13）
- **檔案**：`src/app/child/(tabs)/me.tsx:296`、`src/app/parent/(tabs)/family.tsx:343`。
- **根因/修法**：小孩⚙「語言」點了無反應；家長設定多項佔位觀感像壞掉。修法：未實作項統一「尚未開放」提示（最小改動；隱藏 vs 提示屬輕微取捨，實作兵先用提示）。
- **驗收**：小孩⚙每列點擊都有可見回饋；家長設定頁無「點了無反應」的列。
- **來源**：Run 01 §2 I3＋ux U13。

#### R2-21 🟢 low｜code-fix｜M — SDD ledger Minor 收尾包（六組 pre-existing 小修）
- **檔案**：`src/types/models.ts:131`、`me.tsx`、`parent tasks.tsx`、`child order/[id].tsx`、`sign-in.tsx`、`review.tsx`。
- **修法**：(P3) TaskInstance 型別補 submittedAt 宣告；(P4) me.tsx instances 查詢加上限；(P2) 建立後 0/0 短暫閃現、saving async 縫隙改 useRef 封死、family-wide instances 訂閱過濾 archived task 的 instances（多裝置 dedup 邊緣記錄即可不強修）；(P6) handleCancel 成功路徑補 submitting 重設；(P7) signup 欄位 onChangeText 清 errorMsg、errorText literal 色改 tokens；(P8) review.tsx 兩處 guarded `!` 斷言改 inline 判斷＋補「rejected 不寫快照」「replay 不覆寫快照」兩個防禦性 functions 測試。
- **驗收**：tsc 通過；models.ts 有 submittedAt；review.tsx grep 無 guarded `!`；兩個新測試綠；signup 輸入時錯誤即時消失。
- **來源**：輸入 B SDD ledger 終審 Minor 清單。depends_on R2-04/08/09/18（刻意排同檔功能性修復之後，避免 rebase 摩擦）。

### 批次五：補測（test-only）

#### R2-24 🟡 medium｜test-only｜S — 家長完整註冊實際送出（A9–A11）
- **內容**：Run 01/02 都沒實際送出「註冊並建立家庭」（護欄禁區）；P9 補驗走的是 invite deep-link 小孩路徑。R2-05 修完後（同一路徑）實測送出一次，可一併驗失敗恢復。建立真帳號需使用者授權。
- **驗收**：實際送出 → 成功建帳號＋家庭並進家長首頁；Firestore 出現對應 users/families/familyMemberships doc。

#### R2-25 🟡 medium｜test-only｜S — 退回 3 次 → missed 門檻行為（C4）
- **內容**：單次退回已驗（Run 02 C3 ✅），3 輪成本高兩輪都沒跑滿。用種子腳本把 instance 造到已退回 2 次再實測第 3 次；或補單元/整合測試覆蓋計數邏輯。純驗收缺口，無已知 bug。
- **驗收**：第 3 次退回後 instance 變 missed、小孩端顯示錯過；前 2 次不觸發。

#### R2-26 🟢 low｜test-only｜S — 通知 >20 筆不漏最新（Run 01 重點⑨）
- **內容**：家長頁根因已由 R1 P3 修掉，但驗收時種子只有約 5 則，>20 門檻從未實測。種子灌 21+ 事件驗證；R2-11 修完後小孩頁一併驗。保留純為封驗收缺口，不重做修復。
- **驗收**：家長與小孩通知頁最新事件在頂部、總數不截斷在 20。depends_on R2-11。

#### R2-27 🟢 low｜test-only｜M — 低優先回歸池（視成本挑做）
- **內容**：G4/H8 每日上限與擋兌換、G5 退回後重拍提交、L1/L3/L4 週期顯示（L2 屬 B3 跳過）、M6–M12 非法輸入/鍵盤/橫豎屏/弱網/連切、D1–D4 禮物 CRUD（Run 02 D1 卡在測試工具軟鍵盤，判定工具側；再卡同 modal 則查 App 側 focus）、實體 kill 持久化。無已知 bug，純覆蓋率缺口。與 Run 03 合併執行，不單獨立測。
- **驗收**：回歸報告（docs/testing/results/）每項標 通過/失敗/跳過＋原因，失敗開新缺陷單。

### 批次六：prod 資料清理

#### R2-28 🟢 low｜data-cleanup｜S — prod 測試資料清理批次（🔴 需使用者授權）
- **內容**：dev-family-seed 測試家庭兩筆清理合併一次授權：(1) Run 01 BUG-02 修復前留下的「整理房間 ★30」重複 taskInstances（P2 已修生成邏輯、Run 02 證實不再新增，殘影對應 R1 fix plan 批次 D 未執行）；(2) `rewardOrders/dev-order-ice-dev-kid1`、`dev-order-ice-dev-kid2` 兩筆殘留 rejected doc。
- **程序**：先列出將刪 doc 清單給使用者過目 → 授權 → 執行 → 驗證。確認不動錢包/pointTransactions。建議排在 Run 03 前，避免殘影干擾判讀。
- **驗收**：「整理房間」僅剩應有單一 instance（卡片 ●●● 消失）；兩筆 dev-order-ice 查無；小孩錢包餘額與清理前一致。

---

## 4. 批次一結果（已落地，全過審）

六項六 commits，逐項獨立可回退，順序 R2-01 → 02 → 03 → 13 → 23 → 22：

| commit | 項 | 審查 |
|---|---|---|
| `f2da500` | R2-01 FieldValue 匯入（9 支 CF 機械替換） | 過 |
| `566cc15` | R2-02 acceptFamilyInvite 不覆寫 | 過（衍生 R2-29） |
| `b91fc47` | R2-03 扣款競態守衛 | 過（衍生 R2-30） |
| `8695dc6` | R2-13 grantPoints 回傳 delta＋client 顯示實際值 | 過 |
| `0b728fb` | R2-23 jest 白名單 | 過 |
| `f5a784a` | R2-22 E2E 腳本（59 步） | 過 |

閘門結果：`npx tsc --noEmit` 0 錯；App jest **13/13**；functions build＋test **65/65**；emulator E2E **59/59 全綠**（三真實 client，含重複邀請錢包不歸零、下單取消點數守恆）。此為後續批次的回歸基準。

---

## 5. 審查新增項（批次一 code review 衍生，納入 backlog）

### R2-29 🟡 medium｜code-fix｜XS — membership status='removed' 接受邀請不 reactivate
- **背景**：R2-02 把 membership 改「不存在才建」後，若既有 membership 是 `status:'removed'`（家長移除過該小孩），再接受新邀請時 membership 保持 removed、邀請卻被標 accepted——小孩以為加入成功，家長清單看不到人。**現行三條帳號路徑走不到此分支**（removed 小孩無法再登入接受邀請），但 **R2-05 落地後可達**（signIn 補跑 CF 的恢復路徑會讓既有帳號帶著舊 membership 接受新邀請）。
- **修法**：`acceptFamilyInvite.ts` membership 分支補：`memSnap.exists && status==='removed'` → `tx.update` 回 `status:'active'`＋重設 joinedAt（保留暱稱/頭像）。
- **驗收**：emulator：造 removed membership 後接受新邀請 → membership 回 active、家長清單看得到、錢包餘額不動；functions 測試補此 case。
- **排程**：批次二，緊跟 R2-05 之後做（R2-05 落地前屬防禦性）。

### R2-30 🟢 low｜code-fix｜S — tx 外 reject 競態窗口＋退款 log 雜訊
- **背景**：R2-03 守住了 transaction 內的扣款，但 `onRewardOrderCreated.ts:37/:43/:52` 三個早期 reject 路徑仍是**交易外**裸 `snap.ref.update({status:'rejected'})`：小孩在 trigger 啟動到 update 之間取消訂單，reject 會覆寫 cancelled（狀態語意錯亂）。另外這些 reject 會觸發退款 trigger `onRewardOrderCancelledOrRejected`，因從未扣款而找不到扣款紀錄，產生「找不到扣款紀錄跳過退款」的 warn 雜訊。
- **修法**：(1) 早期 reject 改交易內守衛式更新（重讀 status 仍 pending 才 reject）；(2) 退款 trigger 對「無扣款紀錄的 rejected 訂單」降噪為 info（此為正常路徑非異常）。
- **驗收**：emulator：品項無效＋同時取消的競態 → 訂單最終狀態為 cancelled 非 rejected；正常 reject 路徑 log 無 warn 級「找不到扣款紀錄」；E2E 59 步不退化。
- **排程**：批次三（與 R2-04 的訂單狀態機修復同主題）。

---

## 6. 排除清單與理由（7 項，輸入零遺漏的另一半）

| 排除項 | 理由 |
|---|---|
| P9 受邀小孩發點補驗 | 已閉環：`fcb0e0d` 補驗 session 以真流程（邀請→註冊→發點）實測通過，Run 01 重點②結案 |
| PR8 已收割清單（B6 我的頁統計、parent notif limit/sortDate、order finally、parent tasks 即時訂閱/防連點） | main 的 `83f0545`/`c2260f4`/`25b4a48`/`6d213b3` 已有逐行等效實作，不重做 |
| B3 週期任務自動排程 rollover（PR #8 `fa6ec6f`） | 新功能，使用者定不做。**產品缺口註記**：PR8 讀取器認定這是設計文件的核心產品缺口——週期任務只跑一輪就死掉（daily 任務隔天不重生）；PR8 有完整實作＋11 個單元測試可收割，若未來重啟 B3 可直接復活。指揮官應在產品層面知悉此缺口存在 |
| B10 孩子提議任務（PR #8 `039e123`） | 新功能，使用者定不做（R2-22 收割時已同步移除其 E2E assert） |
| 產品方向三選一（B2 推播／B3 週期任務／B4 OAuth） | 產品決策題非改善輪 backlog；B4 若要議應由使用者另行定案 |
| PR #8 其餘 14 修完整盤點 | 盤點已由 PR8-diff 讀取器完成（全 7 commits/33 檔逐 hunk 歸類），產出即本 backlog，「不丟失」承諾已兌現 |
| 終審 advisory（MEDIUM 渲染粒度、LOW 共用 hook） | ledger 原文明言「列參考不強制」，屬架構建議非缺陷；R2-09 實作時可自然帶到 |

---

## 7. 批次切法與順序（每項獨立 commit，批間跑閘門）

同檔衝突排序（硬約束，來自 file_conflicts）：
- `review.tsx`：R2-04 → 09 → 21（同一實作兵接續）
- `family.tsx`：R2-14、R2-20（R2-13 已落地；兩項小可併批）
- child `tasks.tsx`：R2-07 → 17
- `me.tsx`：R2-19 → 20 → 21
- parent `tasks.tsx`：R2-08 → 21
- child `order/[id].tsx`：R2-18 → 21
- child `notif.tsx`：R2-11（修）→ R2-26（測）
- functions/src：R2-01 先於一切語意修復（已滿足）

| 批次 | 內容 | 閘門 |
|---|---|---|
| 一（✅ 完成） | R2-01→02→03→13＋R2-23、R2-22 | tsc／jest 13／functions 65／E2E 59 全綠 |
| 二：帳號穩定性 | R2-05 → R2-29 → R2-06 | tsc＋jest＋functions test＋E2E（+R2-29 新 case） |
| 三：任務/商城狀態機 | R2-04 → 09、R2-07 → 17、R2-08、R2-10、R2-11、R2-12、R2-16、R2-18、R2-30 | tsc＋jest＋functions test＋E2E 不退化 |
| 四：UI 提示與 minors | R2-14、R2-15（導覽半）、R2-19、R2-20、R2-21 | tsc＋jest（含 R2-21 兩個新 functions 測試） |
| 五：補測 | R2-24～27，併入 Run 03 執行 | 回歸報告產出 |
| 六：prod 清理 | R2-28（🔴 先取得使用者授權；排 Run 03 前） | 清理後對帳（錢包不變） |

部署動作（皆走使用者 `!` 前綴）：批次二/三涉及 CF 改動 → `firebase deploy --only functions`；R2-12 → `firebase deploy --only storage`。

`/check` 審查節奏沿用批次一：每項 commit 後審，重大 diff 加 `/codex` 二審。

---

## 8. Run 03 回測計畫（佔位——批次二～四落地後回填細節）

- **時點**：批次四完成＋CF/storage 部署後、R2-28 清理後執行。
- **範圍（預定）**：
  - 批次二～四各項驗收條件逐項回測（本檔 §3 各項「驗收」即測項）。
  - 批次一線上驗證：R2-13 clamp 提示（prod 實測 -40 顯示）、R2-02/03 由 E2E 持續覆蓋。
  - 補測項 R2-24（家長註冊實際送出，需使用者授權）、R2-25（退回 3 次門檻）、R2-26（通知 >20 筆）、R2-27（低優先池視成本挑做）。
- **環境**：沿用 Run 02 教訓——模擬器關硬體鍵盤＋英文輸入法先驗一個輸入欄；Maestro 抓不到 RN 畫面（見 memory），用座標點擊＋截圖＋後端驗證。
- **產出**：`docs/testing/results/2026-07-XX-test-run-03.md`，格式比照 Run 01/02。
- **佔位待補**：具體測序、種子腳本清單、與 R2-27 挑測項的取捨——批次三收尾時回填。

---

## 9. 回退策略

- 全部 client 修改：單 commit `git revert`，不動資料。
- CF 修改（R2-02/03/13 已落地；R2-29/30 待做）：均為守衛式加固或回傳欄位新增，向下相容；revert 後舊行為完整恢復，已寫入欄位殘留無害。
- storage.rules（R2-12）：revert 後重 deploy 即回 5MB，無資料影響。
- R2-28 為刪除操作**不可逆**——故要求授權前先列清單過目，並以「錢包/pointTransactions 不動」為紅線。
