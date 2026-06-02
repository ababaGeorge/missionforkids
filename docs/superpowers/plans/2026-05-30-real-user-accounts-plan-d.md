# Plan D v2 — 移除匿名 dev 捷徑 + 全收舊邀請碼 + 真帳號測試 seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。步驟用 `- [ ]` 追蹤。

> **v2 變更（2026-05-30，codex consult 審查後）：** 修正 v1 的核心錯誤——`inviteCode.ts` **不是死碼**，`family.tsx` 還有一整套「邀請碼」UI（建碼/列表/重產/刪碼/家長碼）在用它。使用者決策：**全收掉舊邀請碼,只留 email 邀請**。並補上 codex 點出的：seed 用穩定 UID、對齊 acceptFamilyInvite shape、seed 帶 childId 的 task/reward、全流程驗證、全 repo grep gate、清匿名 Auth users、shape 斷言測試。

**Goal:** 從源頭斷掉匿名/placeholder 身分碎片：(1) 移除匿名 dev 登入捷徑，改固定真帳號 seed；(2) **全收掉舊「邀請碼」機制**（已半殘、與 email 邀請重疊、是匿名 placeholder 來源）；(3) 加成員一律走 email 邀請。完成後 dev 每次登入同一組真 uid，App 只剩一套加成員機制。

**Branch:** `feat/real-user-accounts`

**鐵律（穩定才往下推 / 先建後刪）：先把真帳號 seed 做出來、用它跑通完整流程（家長+小孩登入、任務、錢包、給點、兌換、核准），才移除匿名捷徑與邀請碼。**

---

## 取捨（已定，2026-05-30）
- **D-1 = A**：firebase-admin Node 腳本 seed，用**明確穩定 UID**建固定真帳號（繞過 Resend sandbox；穩定 UID → childId/錢包 doc id 重跑不變）。
- **D-2 = A**：移除 family.tsx 匿名加小孩，加小孩一律 email 邀請。
- **D-3 = A**：移除匿名捷徑，保留 `__DEV__`-gated「自動填入測試帳號」便利鈕（只填欄位、走真 email 登入）。
- **邀請碼 = 全收**：移除整套 inviteCode 機制。**co-parent（邀請另一位家長）暫時消失** → 列未來項（之後用 email 邀請補，不在 Plan D）。

---

## 移除清單（codex 校正後的完整範圍）

| 項目 | 位置 | 處置 |
|---|---|---|
| 匿名 dev 登入 `handleDevSignIn` + `seedDevTasks/Rewards/Order` | `sign-in.tsx`（約 400 行）| 移除 |
| dev 子登入走 `redeemInviteCode` | `sign-in.tsx` ~405-470 | 移除 |
| 邀請碼 client 封裝 `createInviteCode`/`createParentInviteCode`/`redeemInviteCode` | `src/lib/inviteCode.ts` | **刪整檔** |
| 邀請碼 callable | `functions/src/redeemInvite.ts` + `index.ts` 匯出 | 刪 |
| family 邀請碼 UI：訂閱 `inviteCodes`、`handleAddChild`(匿名)、`handleInviteParent`、`handleRegenerate`、`handleDeleteInvite`、碼列表渲染 | `family.tsx`（line 123/186/241/252/262/574 等）| 移除，只留 email 邀請(`handleInviteByEmail`) |
| `inviteCodes` collection 的 firestore.rules | `firestore.rules` | 移除對應規則 |
| 邀請碼相關 i18n 字串 | locale 檔 | 清（grep 找） |
| 邀請碼/redeemInvite/inviteCode 相關測試 | `__tests__` | 刪/改 |

> **保留**：`createFamilyInvite`(email)、`acceptFamilyInvite`、`registerParent`、`registerChild`、email 邀請 UI。這些是真實流程,不動。

---

## Seed 腳本規格（codex #4/#5/#6/#8）

`scripts/seed-dev-family.ts`（firebase-admin），**必須**：
- **明確穩定 UID**：`auth().createUser({ uid: 'dev-parent', ... })` 等固定 uid → childId==uid 固定、錢包 doc id 固定，重跑不漂移。砍掉重建用同 uid。
- **對齊真實 shape**（避免漂移；寫 shape 斷言測試對照）：
  - 家長：mirror `bootstrapParentAccount`/`registerParent`——`users/{uid}`(parent)、`families/{familyId}`、parent membership。
  - 小孩：mirror `acceptFamilyInvite`——`users/{uid}`(child, **childId=uid**, authProvider:'password', nickname/avatar)、`familyMemberships/{uid}_{familyId}`(**childId**, role child, active)、`pointWallets/{familyId}_{childId}`(**childId + userId**, balance 0)。
- **seed sample 內容且帶 childId**：tasks + taskInstances(**childId**!)、rewardItems、rewardOrders，否則小孩任務/獎勵頁查 `where childId` 會空（codex #6）。
- **idempotent**：存在就重設、不重複建。
- 固定測試帳號：`dev-parent@mfk.test` / `dev-kid1@mfk.test` / `dev-kid2@mfk.test` + 固定 dev 密碼（測試網域，不放敏感值）。

---

## Sections（先建後刪順序）

### Section 1：dev 真帳號 seed（先做）
- [x] 寫 `functions/scripts/seed-dev-family.ts`（穩定 UID dev-parent/dev-kid1/dev-kid2、familyId=dev-family-seed、對齊 shape、taskInstance/rewardOrder 帶 childId、idempotent upsert）。共用 builder 抽到 `functions/src/devSeed/shapes.ts`。
- [x] 寫 seed shape 斷言測試 `functions/src/__tests__/seed-shapes.test.ts`：鎖死欄位 key 集合對齊 `acceptFamilyInvite`/`bootstrapParentAccount`（codex #11）。functions 測試 51/51 綠、tsc 乾淨。
- [x] 跑腳本（ADC 已登入）→ firebase MCP 驗證：3 Auth 帳號、錢包 balance 8、taskInstance 帶 childId、membership shape 全對。**Section 1 完成**。

### Section 2：seed 帳號跑通完整流程（驗證 seed 可用，才准往下刪）
> **範圍決策（2026-06-01，使用者定）：** 採「登入+渲染證明」。給點/核准/兌換的 CF 已被 51 個 functions 測試 + Plan C 正式環境 E2E 覆蓋，不在脆弱的盲點座標 E2E 重跑。
- [x] 模擬器用 `dev-parent@mfk.test` 登入 → 家長首頁顯示「12 個任務在跑」、tabs 小安/小宇兩個 seed 小孩、設定頁小孩區 🦊小安+🐼小宇、無邀請碼區（截圖存證 s2-parent-home-clean / s2-parent-settings）
- [x] 用 `dev-kid1@mfk.test` 登入 → child 首頁「嗨 小安」、任務列表非空、**右上餘額 ★8 = seed 錢包 balance** 一致（截圖 s2-kid1-result）
- [x] seed 帳號全程**無 firestore error toast**（先前 toast 是舊 QQ/RR 髒資料，佐證 Section 5 清舊資料必要）。給點/核准/兌換改由既有測試+Plan C E2E 覆蓋（使用者決策）。**Section 2 完成**。

### Section 3：移除匿名 dev 捷徑
- [x] sign-in.tsx 移除 `handleDevSignIn`(~187 行) + `seedDev*`(3 函式) + `handleDevSignInAsExistingChild`(邀請碼 dev 子登入) + `firestore`/`inviteCode` imports
- [x] 加 `__DEV__`-gated 自動填入鈕（家長/小安/小宇 → `fillDevAccount` 只 setEmail/setPassword、走真 `handleEmailSignIn`）
- [x] root tsconfig 加 `exclude: [functions]`（套件分離；functions 有自己的 tsc/test）。root tsc exit 0、RN jest 13/13 綠。**Section 3 完成**。

### Section 4：全收舊邀請碼
- [x] family.tsx 移除：邀請碼訂閱 useEffect、`handleAddChild`(匿名)、`handleInviteParent`、`handleRegenerate`、`handleDeleteInvite`、InviteRow type、invites/showAddChild/childName/generatedCode state、邀請碼列表 UI、showAddChild modal；FAB 改直接開 email 邀請。清孤兒 import(`Data`)+styles(codeRow/statusBadge/fullBtn)。只留 `handleInviteByEmail` + email modal。
- [x] 刪整檔 `src/lib/inviteCode.ts`、`functions/src/redeemInvite.ts` + index 匯出（無相關測試）
- [x] 移除 `inviteCodes` firestore.rules 區塊（MCP 驗證 OK）+ i18n 字串（zh-TW/en：inviteCode*/codeUsed/codeExpired/codeActive/regenerateCode/inviteParent/noInviteCodes/addChild/enterInviteCode/childJoin）
- [x] **全 repo grep gate**：✅ 無殘留 import/引用（codex #10）
- [x] functions tsc 0 + 51/51 測試、root tsc 0 + RN 13/13、i18n JSON 合法。**Section 4 完成**。
  - ⚠️ 部署時：`firebase deploy --only functions` 會提示刪除 `redeemInvite` CF（預期）；rules deploy 移除 inviteCodes 規則。

### Section 5：清測試資料 + 整合驗證
- [x] `functions/scripts/cleanup-anon-dev-data.ts`（dry-run 預設）：dry-run 確認清單後對 prod 執行 — 刪 **73 匿名 Auth users + 390 dev-family-001 Firestore docs**，保留 3 個 seed password 帳號。明確標記法（authProvider==anonymous / familyId==dev-family-001），不靠 display-name（codex #12）。復跑 dry-run = 0 殘留、seed 錢包 balance 8 完好。
- [x] 整合驗證（模擬器載入 S3/S4 新碼）：新 sign-in 畫面 dev 填入鈕 ✓、填入「家長」→ 登入 ✓、家長首頁 12 任務 ✓、家庭頁**無邀請碼區** ✓、FAB→email 邀請 modal ✓、child 端 ★8 渲染 ✓。
- [x] functions 51/51 + RN 13/13 + root/functions tsc 乾淨、git 分 5 段 commit。**Section 5 完成**。

---

## 風險 / 注意
1. **先建後刪 + 全流程驗證**：Section 1-2 的 seed 必須先跑通完整流程，才動 Section 3-4 的移除。
2. **seed 漂移**：用 shape 斷言測試把 seed 綁死在 acceptFamilyInvite/bootstrapParentAccount 的欄位上（codex #4）。
3. **穩定 UID**：seed 一定要指定 uid，否則重建後 childId/錢包/任務 doc id 全變（codex #5）。
4. **co-parent 邀請暫時消失**：移除邀請碼的已知代價，列未來（email 邀請擴充支援家長）。
5. **真實功能零影響**：email 邀請 + acceptFamilyInvite + registerParent 全部保留。
6. **清匿名 Auth users**：用 Identity Toolkit Admin REST（Plan B 用過）按 uid/標記刪，不靠顯示名（codex #12）。

---

## 完成定義（DoD）— ✅ 全數達成（2026-06-02）
- [x] dev 測試靠固定真帳號（穩定 uid，非匿名）；seed 跑通完整流程（登入+渲染證明）。
- [x] 匿名 dev 捷徑、整套邀請碼機制、family 匿名加小孩 全部移除；App 只剩 email 邀請一套加成員。
- [x] seed shape 對齊真實流程（shape 斷言測試保證不漂移）；小孩 seed 內容帶 childId。
- [x] 真實功能不受影響、測試雙綠（functions 51/51、RN 13/13）、tsc 乾淨；dev-family-001 殘留匿名資料 + Auth users 清掉（0 殘留）。
- 未來項：co-parent 用 email 邀請補。

## 部署狀態（2026-06-02 ✅ 已上線）
- [x] **push** feat/real-user-accounts → origin（同步）。
- [x] **PR #5** feat → main（OPEN）：https://github.com/ababaGeorge/missionforkids/pull/5
- [x] **functions 部署**：prod 9 個 function，刪除 `redeemInvite`（Plan D 移除）+ `bootstrapDevSession`（早期孤兒）；順帶新建 `bootstrapParentAccount`（之前竟未部署到 prod）。MCP list 驗證。
- [x] **firestore:rules 部署**：inviteCodes 規則移除，live rules 驗證確認。
- ⬜ PR #5 尚未 merge（待使用者決定）。

## 未來（不在 Plan D）
- email 邀請擴充支援邀請另一位家長（補回 co-parent）。

## Codex 審查發現（2026-06-02，3×P2，使用者決定「先記下來」待處理）
- **#2 seed 兌換訂單被退**（✅ 已修 commit）：seeded delivered order cost 50 > 錢包 8 → `onRewardOrderCreated` 退成 rejected。已移除 seed 該訂單。⚠️ **prod 殘留 2 個 rejected doc**（`rewardOrders/dev-order-ice-dev-kid1`、`-dev-kid2`）尚未刪（使用者只授權 review，未授權動 prod）。
- **#1 email 寄送失敗無補救**（待處理）：`createFamilyInvite` 回 `emailSent:false` 時，family.tsx 丟掉 `inviteId` 只叫家長重試；邀請碼 fallback 已移除 → Resend 故障時家長卡死。正解=email 重寄/顯示連結，屬「email 邀請擴充」未來項。
- **#3 cleanup 全域刪匿名 Auth**（待處理）：`cleanup-anon-dev-data.ts` `--execute` 刪所有 providerData 空的 Auth user，未 scope 到 dev-family-001。本次安全（已驗 73 匿名全是 dev），但作為可重用工具過廣，未來重用前應加 dev-family scope 防呆。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | PASS (gate) | 3 findings (3×P2), 1 fixed |

- **CODEX:** 3 advisory findings (no P1). #2 (seed 訂單被退) 已修並 commit；#1 (email 失敗無補救) + #3 (cleanup scope 過廣) 由使用者決定先記錄待處理。
- **UNRESOLVED:** 2 — #1 email 重寄補救（屬 email 邀請擴充未來項）、#3 cleanup scope 防呆（重用前再加）。另 prod 殘留 2 個 rejected 訂單 doc 待清。
- **VERDICT:** Plan D 程式碼 CLEARED（gate pass，無阻擋性問題）。可進部署/PR；上述 P2 為非阻擋待辦。
