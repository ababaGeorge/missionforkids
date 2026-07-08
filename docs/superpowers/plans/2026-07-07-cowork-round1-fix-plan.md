# 改善輪 R1 — Cowork 實測分診修復計畫與規格

> 狀態：**APPROVED**（2026-07-07，方案 B：逐項收割＋自寫補齊）
> 輸入：`docs/testing/results/2026-07-06-test-run-01.md`（Cowork 實測 Run 01）＋ `docs/testing/2026-07-06-ux-recommendations.md` 測試員補充區 ＋ 三路程式碼根因調查（本檔各項已內嵌結論）
> 參考修法來源：已關閉 PR #8（本地分支 `pr8-audit-reference`，核心 commit `8c14fa7`、`74ce556`）——**逐項取 diff、逐項驗證，不整包 merge**

---

## 0. 一頁摘要

Run 01 結論：核心閉環全通、點數帳全對。本輪修 **8 個確認項＋1 行加固**，不做新功能。

| # | 項目 | 嚴重度 | 修法來源 | 動哪裡 |
|---|---|---|---|---|
| P1 | BUG-01 我拿到了後按鈕死鎖 | 🔴 | 收割 `8c14fa7` | `src/app/child/order/[id].tsx` |
| P2 | BUG-02 指派顯示/不預填/重複 instance | 🟠 | 收割 `8c14fa7`（僅 tasks.tsx 訂閱重構段） | `src/app/parent/(tabs)/tasks.tsx` |
| P3 | BUG-05 家長通知漏最新 | 🟡 | 收割 `8c14fa7` | `src/app/parent/(tabs)/notif.tsx` |
| P4 | UX-08 假徽章/連續天數 | 🟢 | cherry-pick `74ce556`（單檔） | `src/app/child/(tabs)/me.tsx` |
| P5 | BUG-03 商城鎖無說明 | 🟡 | 自寫 | `src/app/child/(tabs)/rewards.tsx` |
| P6 | BUG-04 取消退點無過渡提示 | 🟡 | 自寫（採「處理中」提示，**不做**樂觀加點） | `src/app/child/order/[id].tsx` |
| P7 | UX-06 登入無錯誤回饋 | 🟡 | 自寫 | `src/app/auth/sign-in.tsx` |
| P8 | BUG-06 兌換前餘額用回推非快照 | 🟢 | 自寫（動 1 個 CF＋需部署） | `functions/src/onRewardOrderCreated.ts`＋`src/app/parent/(tabs)/review.tsx` |
| P9 | 發點入口加固（重點② 判定為假後的防未來） | 🟢 | 自寫（1 行） | `src/app/parent/(tabs)/family.tsx` |

規模聲明：**約 9 個檔案**（超過 8 檔門檻，明示）。每項獨立 commit、獨立可回退。

**重點② 判定結論（本輪重要反轉）**：「對受邀綁定小孩發點失敗」經整條鏈追查為**假**——
`family.tsx:320-323` 傳 `m.user.id` → `acceptFamilyInvite.ts:51-73` 建的小孩 users doc id＝uid＝membership.userId＝childId → `grantPoints.ts:52-64` 解析命中 → 錢包 `{familyId}_{uid}` 正對上。唯一理論斷點（doc id≠userId 的 placeholder）在現行三條帳號建立路徑都不會出現，屬防禦性 dead code。故從「🔴 待補測」降級為 P9 一行加固＋回測項。

---

## 1. 範圍

### 做（本輪）
上表 P1–P9，加一個資料清理小項（見 §4 批次 D）。

### 不做（明確出界）
- **B2 推播、B3 週期任務、B10 孩子提議任務**等新功能（PR #8 的 `fa6ec6f`/`039e123` 不收）。
- **PR #8 其餘 14 項修復**——含「扣款-取消競態遺失點數」「重複接受邀請歸零錢包」「核准過期訂單重複領獎」等資料完整性修復。分級：🟡 潛在正確性——平常沒事，特定併發時序（如取消瞬間同時核准）才會咬人。**列入下輪候選**（見 §6），不會丟失。
- i18n 全面化、A4/A5 OAuth。

---

## 2. 各項規格（根因 → 修法 → 驗收）

### P1 🔴 BUG-01：「我拿到了」後底部按鈕死鎖
- **根因**：`src/app/child/order/[id].tsx:78-90` `handleReceived` 只有 catch 分支呼叫 `setSubmitting(false)`，成功路徑不重設；底部兩鈕掛 `disabled={submitting}`（:250、:264）→ 成功後永久 disabled。
- **修法**：改 `try/finally`，`finally { setSubmitting(false); }`（同 `8c14fa7` 修法）。
- **驗收**：
  - happy：模擬器完整走 兌換→核准→交付→「我拿到了」→ 訂單完成後「回到主頁」「回到任務」都能導覽。
  - error：中斷網路按「我拿到了」→ 失敗 alert 後按鈕恢復可按。
  - 回歸：不重複扣點（K6 對帳不變）。

### P2 🟠 BUG-02：指派顯示延遲＋編輯不預填＋重複 instance（三症狀同源）
- **根因**：`src/app/parent/(tabs)/tasks.tsx:111-136` 在 tasks onSnapshot 內對 `taskInstances` 做**一次性 `.get()`**。(a) 建立時 instances 未寫完就快照→「未指派・0/0」且不再刷新；(b) 編輯 modal 初始 `selectedChildren`（:536-541）吃同一份 stale 資料→永遠空白；(c) 編輯儲存的去重表 `existingByUser`（:650-652）基於 stale 快照→把既有指派誤判為新指派再 `add()`（:654-671）→ 每編輯一次長一個 instance。instance 生成純 client 直寫（:656、:701），無 CF 參與。
- **修法**（收割 `8c14fa7` 的 tasks.tsx 段，**只取這段、不整檔覆蓋**）：拆 `taskDocs`／`instByTask` 兩個 state；`taskInstances` 依 `familyId` 獨立 onSnapshot 即時訂閱、依 taskId 分組；`tasks` 改 `useMemo` join；加 `saving` 防連點鎖。編輯 modal 與去重表改吃即時資料。
- **驗收**：
  - happy：建任務指派小安 → 卡片**立即**顯示「小安・0/1」（不用重登）；開編輯 modal「指派給」預填小安。
  - 重複防護：同一任務連續編輯儲存 2 次 → 用 Firebase MCP 查 `taskInstances`，該 task 每個 child 僅 1 份 instance；小孩端無重複卡。
  - 防連點：儲存中再點儲存無第二次寫入。
  - 回歸：App jest 13/13；歷程分頁（B15）統計不變。

### P3 🟡 BUG-05：家長通知漏最新事件
- **根因**：`src/app/parent/(tabs)/notif.tsx` 兩條查詢 `.limit(20)` 且無 `orderBy`（:69、:107），符合條件文件 >20 筆時新事件可能不在回傳集；且 :87 排序用 `periodEnd`（截止日）非 `submittedAt`。審核頁同查詢無 limit 所以看得到（「佇列有、通知沒有」的成因）。
- **修法**（收割 `8c14fa7`）：移除兩處 `.limit(20)`；sortDate 改 `submittedAt ?? periodEnd`。家庭級資料量小，全量查詢可接受。
- **驗收**：小孩提交任務＋兌換 → 家長通知頁**立即**在頂部出現這兩筆；舊事件仍在、按時間正序排列。

### P4 🟢 UX-08：假徽章／連續天數
- **根因**：`src/app/child/(tabs)/me.tsx:73` `const streak = 0;` 硬寫；:99 讀書蟲 `got: true` 寫死（另 :96、:98 同批假徽章）。
- **修法**：cherry-pick `74ce556`（單檔 +36/−6、純 client、無新欄位無後端）：streak 用既有 instances 訂閱從 `approved`＋`reviewedAt` 以 useMemo 回推；徽章改資料驅動里程碑（第一次完成／連3天／連7天／100星光／完成10／完成25）。
- **驗收**：`git cherry-pick 74ce556` 乾淨無衝突（其 diff base 即現行 main 的 pre-state）；模擬器看小安「我的」頁 streak 為真實天數、讀書蟲消失、已達成里程碑正確亮起；jest 13/13。

### P5 🟡 BUG-03：商城被訂單鎖住時無說明
- **根因**：`src/app/child/(tabs)/rewards.tsx:230` `can = balance >= cost && !activeOrder` 一刀切；:267-271 的「還差 N」在買得起時 short=0 不顯示 → 鎖卡零文案。
- **修法**（自寫）：拆兩旗標 `affordable`／`blockedByActiveOrder`；被訂單鎖住的卡顯示「先完成上一個兌換喔」；買不起維持「還差 N」。頂部 banner 不動。
- **驗收**：有進行中訂單＋餘額足 → 卡片灰＋顯示「先完成上一個兌換喔」；無訂單＋餘額不足 → 顯示「還差 N」；無訂單＋餘額足 → 可點。

### P6 🟡 BUG-04：取消兌換退點無過渡提示
- **根因**：`handleCancel`（`src/app/child/order/[id].tsx:94-116`）只改訂單 status 即關頁；退點由 CF trigger（`onRewardOrderCancelledOrRejected.ts:33-77`）async 完成，秒級延遲；全專案無任何過渡提示。
- **修法**（自寫；**設計決策：不做樂觀加點**——CF 萬一失敗會顯示假餘額）：取消成功後顯示明確回饋「已取消，★會在幾秒內退回」（toast 或關頁前 alert 的文案強化），讓延遲被預期。
- **驗收**：取消訂單 → 立即看到「退回中」訊息；數秒後餘額自動更新（K5 對帳不變）；CF 失敗情境下不顯示錯誤餘額。

### P7 🟡 UX-06：登入無錯誤回饋
- **根因**：`src/app/auth/sign-in.tsx:59`（登入）/:72（註冊）空欄位靜默 `return`，無提示；:64-65/:83-84 錯誤走 `Alert.alert(..., e?.message)` 帶 Firebase 原始英文訊息。按鈕 :169-176 只 `disabled={loading}`。
- **修法**（自寫）：(a) 空欄位時 submit 鈕 disable（`disabled={loading || !email.trim() || !password}`）並降低視覺亮度；(b) 錯誤依 `e.code` 對映友善中文（`auth/invalid-credential`、`auth/wrong-password`、`auth/user-not-found`、`auth/too-many-requests`、`auth/network-request-failed`；未知碼 fallback「登入失敗，請再試一次」），以欄位下方 inline 錯誤顯示，持續可見。
- **驗收**：空欄位 → 按鈕明顯不可按；錯密碼 → 欄位下方出現中文錯誤且不消失；正確帳密 → 正常登入；dev 快速登入鈕不受影響。

### P8 🟢 BUG-06：兌換審核 sheet「兌換前」餘額失真
- **根因**：`review.tsx:557-561` 開 sheet 時一次性讀**目前**錢包餘額，:604-608 用「目前餘額＋cost」回推「兌換前」；下單到審核之間有其他異動就整組偏移。資料模型無下單當時快照（`models.ts:191-205` 只有 `pointCostSnapshot`；`onRewardOrderCreated.ts:76-91` 扣款時讀到權威餘額但沒寫回）。
- **修法**（自寫）：CF `onRewardOrderCreated` 扣款 transaction 內把 `balanceBeforeSnapshot`（扣款前）／`balanceAfterSnapshot`（扣款後）寫入該 `rewardOrders` doc；`review.tsx` 優先讀快照，**舊訂單無快照欄位 → fallback 現行回推**（向下相容，不遷移資料）。
- **驗收**：functions jest 全綠（含新欄位斷言）；部署後新下單的訂單，審核 sheet 顯示下單當時前後值（實測：下單→再賺點→開 sheet，數字不漂移）；舊訂單開 sheet 不壞。
- **部署**：`firebase deploy --only functions`，走使用者 `!` 前綴。

### P9 🟢 發點入口加固
- **背景**：重點② 判定為假，但 `family.tsx:321` 傳 `m.user.id`（users doc id）依賴「doc id＝membership.userId」這個現況恆等；未來若出現 doc id≠userId 的帳號路徑，`grantPoints.ts:57` 會查不到 membership 而發點失敗。
- **修法**：改傳 `m.membership.userId`（1 行）。
- **驗收**：模擬器對小安發點成功、餘額即時更新（E2 回歸）。

---

## 3. 相依與環境（實作前確認，不中途要東西）

- 無新依賴、無新憑證、無新服務。
- 唯一 prod 動作：P8 的 functions 部署（使用者 `!`；agent shell 會被 classifier 擋，不繞過）。
- 驗證工具：iOS 模擬器（iPhone 17 `C6986BCA-…`）＋ Metro（dev 密碼 env）＋ Firebase MCP（讀 prod 驗資料）。ADC 若過期先 `gcloud auth application-default login`＋`set-quota-project mission-for-kids`（過期會靜默 hang）。
- 測試基線（動手前先跑一次記錄）：App jest 13/13、functions jest 59/59、`tsc` 0 錯。

## 4. 批次與順序（每項獨立 commit，批間跑測試閘門）

- **批次 A（收割，先小後大）**：P1 → P3 → P4 → P2（P2 是本輪最大 diff，放批尾單獨驗）。
- **批次 B（自寫 client）**：P5 → P6 → P7 → P9。
- **批次 C（CF）**：P8（functions 測試 → 使用者 `!` 部署 → MCP 驗證新訂單快照欄位）。
- **批次 D（資料清理，小）**：清掉 Run 01 測出的重複「整理房間」instances（dev-family-seed 測試家庭、P2 修好後做，prod 寫入需使用者授權）。
- **批次 E（驗證）**：`/check` 審查整輪 diff（重大 diff 加 `/codex` 二審）→ Cowork Run 02 回測（見 §5）。

## 5. Cowork Run 02 回測計畫（修完後）

- **環境先修**：Run 01 最大限制是硬體鍵盤＋中文輸入法打不進輸入欄 → 模擬器關硬體鍵盤（I/O > Keyboard > Connect Hardware Keyboard 取消）＋切英文輸入，先驗一個文字欄可輸入再開測。
- **回測（本輪修復逐項）**：P1–P9 各自的驗收條件。
- **補測（Run 01 未測項）**：E3/E4/E5 扣點與 clamp 與冪等、E8/E9 Email 邀請全流程（含受邀小孩發點——驗證 P9 與重點②「假」的判定）、④ 連點建立壓測、⑧ once 反覆編輯截止日漂移、⑨ 通知 >20 筆、C3/C4 退回留言流程。

## 6. 下輪候選（不丟失清單）

- PR #8 其餘 14 修中的**資料完整性子集**（🟡 潛在正確性）：扣款-取消競態、重複接受邀請歸零錢包、核准過期訂單重複領獎。收割方式比照本輪：逐項取 diff＋逐項驗證。
- 產品方向三選一（B2 推播／B3 週期任務／B4 OAuth）——scoping 已在 2026-07-05 session 完成。
- 通知體驗整體改造（點通知導覽到對應項目＝重點⑤，Run 01 證實但屬功能增強非修 bug）。

## 7. 回退策略

- 全部 client 修改：單 commit `git revert`，不動資料。
- P8 CF：新增欄位向下相容（讀端有 fallback），revert 後舊行為完整恢復；已寫入的快照欄位殘留無害。
- P2 若翻車：revert 該 commit 即回到一次性 `.get()` 行為（已知 bug 但穩定），不影響資料。
