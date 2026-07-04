# Handoff: 全功能審計 + 18 個真 bug 修正 + 52 步 E2E 綠

> 2026-07-04（remote session）分支 `claude/continue-afternoon-work-cfse3p`

## 本輪做了什麼

延續安全加固之後，做「全功能實測 + 找 bug + 修到能正常運作」：

1. **發現並修一個 emulator 全滅的 bug**（commit `c5e15b2`）：firebase-admin v13 頂層
   `admin.firestore` 無 prototype，functions emulator proxy 對它 bind() 會丟失
   FieldValue/Timestamp 靜態屬性 → CF 在 emulator 全 TypeError（prod 無 proxy 不受影響）。
   9 個 CF 改 `firebase-admin/firestore` 模組匯入。
2. **寫 52 步端到端實測** `functions/scripts/core-loop-e2e.cjs`：家長/小孩/訪客三真實
   client（各帶 auth、受 firestore.rules 約束），callable+trigger 跑 functions emulator，
   寫入 shape 一比一取自畫面碼。
3. **10 維度靜態審計 + 對抗驗證 workflow**（撞 session token 上限，42/43 verify agent 沒跑完，
   改用人工讀碼替代驗證）。逐一確認後修 **18 個真 bug**（commit `8c14fa7`）。

## 修掉的 18 個 bug（分類見 commit 8c14fa7 訊息）

資料完整性：扣款-取消競態遺失點數、重複接受邀請歸零錢包。
帳號卡死（CRITICAL）：兩步註冊無失敗恢復、useAuth 一次性 get、index 無逃生出口。
授權/狀態機：核准過期訂單重複領獎、編輯任務誤傷 approved instance / 卡 missed / dueDate 漂移、
小孩列表未過濾 archived。
查詢/顯示：limit(20) 無 orderBy 截斷、snapshot 亂序競態、memberName permission-denied 連鎖、
慶祝閃 +0、通知時間錯、歷程漏 archived、按鈕永久 disabled、載入卡死、封存品項訂單卡死、
建任務防連點、管理頁 instances 改即時訂閱。
其他：storage 5MB→12MB、jest config。

## 驗證（全綠）

app tsc 0 錯誤｜RN jest 13/13｜functions jest 59/59｜**core-loop E2E 52/52**

## ⚠️ 待辦（需人工）

1. **開新 PR**：PR #7 已 merged，本輪是新工作需**新 PR**（base: main）。這次 remote session
   的 GitHub 連接器斷線/需重新授權，無法自動開 —— 在互動環境用 /mcp 授權後開，或本機開。
   分支已推：`claude/continue-afternoon-work-cfse3p`（領先 main 兩個 commit）。
2. **prod 部署**（remote 無 firebase 憑證，未執行）：
   ```
   firebase deploy --only firestore:rules,firestore:indexes,storage --project mission-for-kids
   firebase deploy --only functions --project mission-for-kids
   ```
   本輪改了 `storage.rules`（12MB）與多個 CF（acceptFamilyInvite / onRewardOrderCreated），
   不部署不會在 prod 生效。
3. **A7 補刀仍待做**：舊密碼 `mfk-dev-2026!` 已公開，Firebase Console 改三個 @mfk.test 密碼。

## 未修（產品缺口 / 需外部動作，非 bug）

推播 B2、週期任務排程 B3、Apple/Google 登入 B4、i18n、統計真數據、
acceptFamilyInvite 要求 email_verified（產品決策）、parent 路由 UI 角色守衛（server 已擋）、
邀請信 custom scheme（需 universal link 設定）、analyzePhoto abort 死碼（降級路徑，非阻斷）。
