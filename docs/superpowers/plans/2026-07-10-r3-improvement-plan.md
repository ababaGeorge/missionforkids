# R3 改善輪實作計畫（2026-07-10 使用者定案：方案 B）

> 來源：R2 延後池（`docs/superpowers/plans/2026-07-09-cowork-round2-fix-plan.md` §8）＋
> codex 二審與模擬器實測新發現（`.superpowers/sdd/progress.md` :86,98,103——未回填 PLAN §8，本文件已收齊）。
> 使用者兩項產品定案（2026-07-10）：①擋多家庭 ②移除成員作廢 pending 邀請。
> 架構定案（2026-07-10）：移除成員收進新 CF `removeFamilyMember`（原子完成移除＋作廢，rules 禁 client 直改）。

## 0. 範圍

### 做（R3-1 ～ R3-6，每項獨立 commit）
| # | 項目 | 類型 |
|---|---|---|
| R3-1 | acceptFamilyInvite 擋跨家庭雙 active membership | CF＋client 文案 |
| R3-2 | bootstrapParentAccount 同款檢查 | CF＋client 文案 |
| R3-3 | removeFamilyMember CF（移除＋作廢邀請原子化）＋rules 收緊 | 新 CF＋rules＋client |
| R3-4 | 封存任務雙修：清單即時反映＋提交三層守衛 | client＋rules |
| R3-6 | markMissed 套 updateInstanceIfStatusIn 收窄（修正版：IN_PROGRESS 三態） | client |

> **2026-07-10 瘦身定案（codex 全局審查建議、使用者同意路線）**：R3-5（notif/rewards 查詢加上限）
> 退回池子——屬「資料數百筆後才痛」的規模問題，不擋首批家庭試用；本輪維持純安全閘門。
> R3 完成後不開 R4 修復輪，轉product主線：週期任務排程＋最小推播 → 寄件網域＋TestFlight → 首批 2-5 家庭 7 天試用。

### 不做（明確出範圍，含去向）
- R3-5 查詢加上限 → 留池（規模問題，見上方瘦身定案；§5 規格保留供未來輪直接取用）。
- 通知已讀持久化＋per-item 導覽 → **R4 設計輪**（通知是虛擬合成、無 collection，需先設計穩定 ID＋存放位置，塞本輪會拖節奏）。
- rejectOrderIfPending 進一步收窄（PROG:86）→ R4（本輪只做 markMissed 這個機械款）。
- legacy child 遮蔽 doc、雙裝置重複 instance（確定性 instance id）、8 秒逃生計時器、未分級雜項（CreateRewardModal 裸 update、rejectNote 交易外、accessibilityRole 債等）→ 留池。
- R2-25/26/27 補測 → Run 04（先備 seed 腳本）。

## 1. R3-1 acceptFamilyInvite 擋多家庭

現況：`functions/src/acceptFamilyInvite.ts` 單一 transaction，只查目標家庭的
`familyMemberships/{uid}_{familyId}`，完全沒有跨家庭檢查（:72-74 的 ALREADY_PARENT 只擋家長降級）。

改法：
- 交易內（讀 profile 後、寫入前，約 :76）加 `tx.get(familyMemberships where userId==uid AND status=='active')`，
  過濾掉 `familyId == invite.familyId`（同家庭 reactivate 路徑不受影響）；有其他家庭 →
  `HttpsError('failed-precondition', 'ALREADY_IN_FAMILY')`。
- Client：接受邀請流程（`src/lib/familyInvite.ts:25` 的呼叫端頁面）加 `ALREADY_IN_FAMILY`
  錯誤分支＋i18n 友善文案（「你已加入其他家庭，須先離開才能接受邀請」）。
- 備註：admin SDK transaction 支援 query 讀取（tx.get(Query)），equality-only 查詢不需新索引。

驗收：unit 正反例（無 membership 過／同家庭 reactivate 過／他家庭 active 擋）；E2E 新步：家庭 A 的 kid 接家庭 B 邀請被擋。

## 2. R3-2 bootstrapParentAccount 同款檢查

現況：`functions/src/bootstrapParentAccount.ts` 只用 `users/{uid}.roleType` 當代理指標（:17-21 冪等短路、:25-27 擋 child），建家庭前（:39-42）不查 membership。

改法：建家庭寫入前查 `familyMemberships where userId==uid AND status=='active'`（任何家庭）；
有 → `ALREADY_IN_FAMILY`。既有 parent 冪等短路維持在前、行為不變。Client 註冊頁加同款錯誤分支。

驗收：unit 正反例；E2E 新步：已有家庭的帳號再 bootstrap 被擋。

## 3. R3-3 removeFamilyMember CF＋rules 收緊

現況：**移除成員沒有 CF**——client 直寫（`src/app/parent/(tabs)/family.tsx:620`
`.update({status:'removed'})`）。邀請 status 只有 `pending|accepted|expired`、無 `revoked`；
client 被 rules 禁止 list 邀請（`firestore.rules:98`）→ 作廢查詢只能在 CF（admin）做。

新 CF 規格（`functions/src/removeFamilyMember.ts`，onCall v2，`index.ts` 匯出）：
- 輸入 `{ familyId, memberUserId }`。
- 守衛：caller 已登入；`{callerUid}_{familyId}` 存在且 role=='parent'、status=='active'（否則 `NOT_PARENT`）；
  目標 `{memberUserId}_{familyId}` 存在且 status=='active'（否則 `MEMBER_NOT_FOUND`）；
  `memberUserId !== callerUid`（否則 `CANNOT_REMOVE_SELF`）；
  **目標 role=='child'（否則 `ONLY_CHILD_REMOVABLE`）**——2026-07-10 codex 全局審查分歧採納：
  現在沒有「家長互移」的產品政策，不提前開放這個權限面；未來做 co-parent 時連政策一起設計再放寬。
- 交易：membership → `status:'removed', removedAt, removedBy:callerUid`（joinedAt 等欄位保留，對齊 R2-29 慣例）；
  讀 `users/{memberUserId}.email` → 查 `familyInvites where familyId== AND status=='pending' AND email==`
  → 全改 `status:'revoked', revokedAt, revokedBy:callerUid`。user doc 無 email（legacy）→ 跳過作廢，
  回傳帶 `warning:'NO_EMAIL_SKIP_REVOKE'`。
- 回傳 `{ removed:true, revokedInvites:<n> }`。

配套：
- `src/types/models.ts:45-63`：invite status union 加 `'revoked'`；選填 `revokedAt/revokedBy`；membership 選填 `removedAt/removedBy`。
- `acceptFamilyInvite.ts:29-40`：確認狀態檢查會擋 `revoked`（若現況是「非 pending 即擋＋accepted 冪等分支」則自動涵蓋；若枚舉比對則補 case）。
- `firestore.rules:84-89`：familyMemberships update 禁止 client 把 status 寫成 `'removed'`（移除只能走 CF；
  R2-29 reactivate 由 CF/admin 做不受影響）。改前先盤點既有合法 client 更新，以 rules-proof＋E2E 81 步零退化為準。
- familyInvites rules：確認 client 無任何路徑可寫 `revoked`（維持最小變更）。
- `family.tsx:620`：改呼叫 `removeFamilyMember`＋錯誤處理（三個錯誤碼文案）。

驗收：unit（守衛正反例＋作廢計數＋無 email 分支）；E2E 新步：移除成員 → membership removed
＋pending 邀請 revoked → 拿該邀請 accept 被擋；rules 攻防新步：client 直改 status→removed 被拒。

## 4. R3-4 封存任務雙修

現況三個洞（`src/app/child/(tabs)/tasks.tsx:105-150`、`src/app/child/task/[id].tsx:145-193`、`firestore.rules:166-172`）：
清單用一次性 `tasks/{taskId}.get()` 過濾 archived（封存後不觸發 taskInstances 監聽器 → 不即時）；
提交 batch 直寫、不重讀 task status；rules 提交轉移只看 instance status——**封存後提交會真的成功**。

改法（三層一起關門）：
- (a) 即時反映：`tasks.tsx` 加一條 `tasks where familyId==` 的 onSnapshot 建 status map
  取代逐筆一次性 get（家庭任務量小，成本可接受；也順帶消掉逐筆 await）。
- (b) 提交守衛：`task/[id].tsx` handleSubmit 改 transaction——重讀 instance status（沿用現況允許值）＋
  重讀 `tasks/{taskId}.status !== 'archived'`＋重讀 submissionCount 判 MAX（取代本地 state 防呆）。
  違反丟 `TASK_ARCHIVED / INSTANCE_GONE / MAX_SUBMISSIONS`，UI 提示後返回清單。
  實作為 `src/lib/instances.ts` 新 helper `submitInstanceGuarded`（仿 :28-46 `updateInstanceIfStatusIn` 模式）。
- (c) rules 後端擋：taskInstances 提交轉移（:166-172）加
  `get(/databases/$(database)/documents/tasks/$(taskId)).data.status != 'archived'`——舊版 client 也擋住。

驗收：app jest（helper 正反例）；E2E 新步：封存後 client 提交被 rules 拒；模擬器實測：封存後小孩清單即時消失。

## 5. R3-5 查詢加上限（⛔ 2026-07-10 定案延後——留池，規格保留供未來輪直接取用）

現況四處無 limit（對照組：`src/app/parent/(tabs)/rewards.tsx:113-116` 已有 `orderBy(createdAt).limit(50)`）：
- `src/app/parent/(tabs)/notif.tsx:67-71`（submitted instances）、`:105-108`（pending orders）
- `src/app/child/(tabs)/notif.tsx:67-71`（approved/rejected instances）
- `src/app/child/(tabs)/rewards.tsx:102-104`（**全歷史訂單**，無過濾無排序）
- `src/app/parent/(tabs)/review.tsx:174-176`（pending orders）

改法：每處補 `orderBy(<時間欄位，依 doc 實際欄位：instances 用 submittedAt/updatedAt、orders 用 createdAt>, 'desc').limit(50)`。
`rewards.tsx:102` 動手前先確認該頁是否用全歷史做統計/pending 扣點計算——若有，拆兩條查詢
（pending 專查＋歷史 limit 50），不得默默改變數字。所需 composite index 逐條補進
`firestore.indexes.json`（emulator 報錯訊息為準），與 rules 同批部署。

驗收：四頁功能不變（E2E 既有步零退化）；emulator 無 missing-index 報錯。

## 6. R3-6 markMissed 收窄

現況：`src/app/parent/(tabs)/tasks.tsx:763-767` 直接 `.update({status:'missed'})`，無交易重讀——可蓋掉 approved。
改法：改用現成 `updateInstanceIfStatusIn`（`src/lib/instances.ts:28-46`），來源狀態限
`IN_PROGRESS_STATUSES`（`['pending','submitted','rejected']`——直接引用 `src/lib/taskAssignments.ts:4-8`
的常數，不另抄一份）；轉移失敗（已被核准／已 missed）靜默跳過＋console 記錄。

> 2026-07-10 codex 全局審查抓到、經讀碼查證後修正：初版誤寫只允許 `['pending']`。但 assignment
> plan 本來就把 submitted/rejected 的進行中 instance 放進 markMissed（`taskAssignments.ts:89-92`，
> 家長把孩子從任務移除的正常路徑），只留 pending 會讓已提交/被退回的孩子無法解除指派。
> 收窄的目的只是擋「計畫算完到寫入之間被核准」的競態，不是改變解除指派語意。

> 2026-07-11 審查釐清（防線定位）：本節與 421c490 commit 訊息把裸 update 描述成
> 「會把 approved 打穿、毀掉點數帳本歷史」——在現行 rules 下不成立：R2-CX1 的
> taskInstances 轉移矩陣早已把 approved 鎖成 client 終態（對 approved 寫 missed
> 匹配不到任何條款 → permission-denied），後端防線完好。本項的實際價值是 UX/健壯性：
> 單筆競態不再讓 rules 拒絕冒成整批移除中斷＋神祕「儲存失敗」。另收窄 client catch：
> 只吞 INSTANCE_GONE / INSTANCE_NOT_SUBMITTED 兩個守衛碼，其餘錯誤（網路
> unavailable 等）重拋交外層 Alert——離線時解除指派不再靜默假成功。

驗收：app jest 正反例（pending/submitted/rejected→missed 過；approved/missed 不動）。

## 7. 流程與閘門

- 分支 `fix/r3-round`，R3-1～6 每項獨立 commit（含各自測試），可單獨 revert。
- 閘門（全過才進審查）：tsc 0；functions 單元測試既有 78 全綠＋新增案例；app jest 既有 88 全綠＋新增；
  emulator E2E `core-loop-e2e.cjs` 既有 81 步零退化＋新增步（§1/2/3/4 驗收所列）**兩次**全綠；
  `run-rules-proof.sh` 全過＋新攻防案例。
- 審查：/check（Deep，含 security specialist——本輪動 rules）→ 重大 diff 照正選加 /codex 二審。
- 上線：push→PR→merge → **先** `firebase deploy --only functions,firestore:rules,firestore:indexes`（走使用者 `!`）
  → Firebase MCP 重讀 prod 驗證（rules 內容含新守衛、functions 清單含 removeFamilyMember）
  → **重啟 Metro `--clear`**（R2 環境教訓：stale bundle 誤判）→ 模擬器實測。
- 模擬器實測素材：R3-1 用 TestFamily2 fixture（dev-parent2@mfk.test，使用者留存即為此用）；
  R3-3 實測**不清 Kid3**——用臨時帳號、或對 Kid3 移除後立即走邀請 reactivate 鏈恢復（R2-29 已驗證）。

## 8. 部署順序與空窗（硬約束沿用 R2）

merge 後先部署 functions＋rules＋indexes，才讓任何新 client（Metro/EAS）連 prod。
本輪特有空窗：rules 禁 client 直改 removed 生效後、新 client 部署前，**舊 bundle 的移除按鈕會失敗**——
目前無真實使用者（dev 階段），可接受；實測前重啟 Metro 即消除。

## 9. 回退

逐 commit `git revert`；removeFamilyMember 可單獨下架（redeploy 舊版 functions）；rules revert 後
client 直改路徑恢復原狀。`revoked` 是新增狀態值、無資料遷移——回退後殘留的 revoked doc 無害
（accept 本來就擋非 pending）。全程不動錢包/點數資料。

## 10. 依賴

零新增：不需新 API key、新服務、新套件。工具鏈照舊——firebase emulator（本機）、Firebase MCP（prod 驗證）、
firebase deploy 走使用者 `!`。
