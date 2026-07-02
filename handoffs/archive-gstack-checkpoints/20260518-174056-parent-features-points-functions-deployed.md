---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-05-18T17:40:56+0800
supersedes: 20260514-161600-child-10-pages-aligned-pushed.md
files_modified: []
---

## Working on: Parent 端 prototype 對齊 + 點數系統 cloud functions 全部署 + 4 個功能

### Summary

接續 child 端 10 頁對齊（上一個 checkpoint）。本輪完成 parent 端 9 頁 prototype 對齊、修一卡車 dev sign-in / 登出 / cleanup bug、做 4 個新功能（任務頻率 Plan C / 任務編輯 / 小孩扣點 / 帳號管理），最後把 6 個 cloud functions 全部用 Node.js 22 部署到 prod（點數系統正式上線）。所有 commit 已 push origin/ababaGeorge/office-hours（HEAD = eebb8ca）。工作樹乾淨。下個 session：使用者重登 simulator 跑完整點數 happy path 驗證。

### Decisions Made

- **雙指派任務 = 獨立計算**（維持現狀，不做協作型）：一個 task 定義、每個孩子各一筆 instance、各做各的各拿各的點。使用者確認。
- **任務頻率截止日 Plan C**（不裝 datetimepicker 依賴）：每天=無選項(當天底)、每週=選週幾(一~日)、每月=1/5/10/15/20/25/月底、單次=自由填1-365天。1-25 皆<=28 無2月問題；「月底」用 `new Date(y,m+1,0)` 自動處理大小月/閏年。
- **firebase-functions 不升大版本**：維持 6.6.0（v2 API 寫法正確、運作正常）。只升 Node runtime 20→22（2026-10-30 停用前的必要修，低風險）。升 v7 有 breaking changes 不冒險。
- **Q1 餘額不足自動擋掉**：`onRewardOrderCreated` 若 balance<cost 直接標 rejected（孩子換不了也不扣點，家長看不到）。使用者確認這是要的行為。
- **Q2 同意後不可反悔（責任）**：approved 後不加取消鍵。驗證全 codebase 只有 sign-in.tsx dev cleanup 寫 cancelled，無任何家長/孩子面向的 approved→cancel 路徑。天然成立，無 code 改動。
- **暱稱/頭像 = family-scoped 覆寫**：存在 FamilyMembership.nickname / avatarEmoji（與真實 user.displayName/ID 無關）。任何家長可改任何人暱稱/頭像、移除小孩；只有 family.createdBy 可移除其他家長；不能移除自己。
- **invite redeem 補 membership**：真實邀請的孩子簽進來必須建 `${authUid}_${familyId}` membership（rules 用此查 isFamilyMember），否則 permission-denied 看不到 family。

### Remaining Work（依優先排，下個 session 第一輪）

1. **使用者重登 simulator 驗證完整點數 happy path**（最高優先）：孩子做任務 → 家長審核通過 → 看 wallet 點數真的累加（functions 已部署，這次應該會動，不再是 0）→ 孩子兌換獎品 → 點數扣除 → 家長婉拒 → 點數退回。同時測 4 個新功能：①新頻率選擇器 ②點任務卡編輯 ⑤設定頁扣點 ⑥改暱稱/頭像/移除成員 ④邀請碼「完成」按鈕有字。
2. **暱稱跨畫面統一**（中等改動）：目前暱稱只在「設定」頁生效。任務頁/審核頁/通知頁仍顯示真實 displayName（那些畫面查 users collection 不查 membership）。要統一需改那些畫面的 name 來源或建一個 family-members context/hook。
3. **GCP Artifact Registry 清理政策沒設**：deploy 時警告容器映像會累積小額月費。使用者可自行跑 `firebase functions:artifacts:setpolicy --location us-central1 --days 3 --force`（曾被 Claude auto-mode classifier 擋，需使用者親自執行或授權）。
4. **小孩間點數互轉**：使用者明確說未來要做、現在先不用。已記下。
5. **gstack 大版本落後**：1.11.0.0 → 1.40.0.0 可升。本 session 為不打斷結報沒處理。

### Notes

#### 本輪 push 的 commit（5a38425..eebb8ca，HEAD=eebb8ca）

```
eebb8ca chore(functions): Node 20→22
37108e3 feat(parent): 帳號管理 暱稱/頭像/移除成員（⑥）
77ccbb9 feat(parent): 小孩扣點（⑤）
cdce35e feat(parent): 任務編輯（②）
cbd5761 feat(parent): 頻率 Plan C（①）
b300f9a fix(parent): 邀請碼 modal「完成」按鈕沒字（flex:1 撐歪）
f319cce fix: invite redeem 補 membership + 兌換前後 label
4fae9a9 fix(parent): CRUD 加 try/catch + confirm dialog
d394928 fix(parent): 登出加 Alert 確認
8cc1a11 fix(parent): 登出後 navigate 回 sign-in
616a138 fix(auth): orphan cleanup 用孤兒判斷 + 邀請碼刪除
5a38425 fix(hooks): useFamily snapshot 沒擋 null 登出 crash
（更早 P1/P3/P6/P7/P8/P9 parent 對齊 commit 在 cf0559d..a407bc3）
```

#### Cloud Functions 已部署狀態（prod, us-central1, Node 22）

- `grantPoints` — 家長 grant/deduct（已改：允許負數 + balance clamp 不低於0）
- `onTaskInstanceApproved` — 任務通過加點
- `onRewardOrderCreated` — 兌換申請先扣（餘額不足直接 reject）
- `onRewardOrderCancelledOrRejected` — 取消/婉拒退回
- `autoCompleteDeliveredOrders` — 自動完成已交付（不碰點數）
- `analyzePhoto` — AI 照片分析
- 全部 6 個都已用 Node.js 22 部署成功。**之前 wallet 永遠 0 的根因（trigger 沒部署）已解決。**

#### 點數系統規則（使用者拍板的完整 spec）

- 小孩不能自己調點數（firestore rule `pointWallets update:false` 擋 client 直寫）
- 完成任務獲得 / 兌換扣除 / 申請兌換時先扣 / 兌換失敗退回 / 無其他要素
- 家長超級權限：填說明後自由 ±（grantPoints）作獎懲
- 未來：小孩間互轉（先不做）

#### 環境快照

```
Workspace:  /Users/ababa_george/conductor/workspaces/missionforkids/manado
Branch:     ababaGeorge/office-hours (clean, all pushed)
Origin:     up to date, HEAD = eebb8ca
Firebase:   project mission-for-kids，已登入，functions 全部署 Node22
Simulator:  iPhone 17 Pro iOS 26.4，登入流程 cliclick 點不準（建議使用者手動操作）
Node:       v22.22.2
```

#### 教訓（本 session 學到）

1. **dev sign-in 每次建新 uid 會累積 orphan**：membership/tasks/rewards/instances 全會堆。cleanup 要用「擁有者不在當前 active 成員」判斷，不能靠「本次新 mark removed 的清單」（第二次以後該清單空）。
2. **登出要 router.replace 回 sign-in**：只 call signOut() 會卡在原畫面（useFamily 變 null → 「還沒有家庭」空狀態，且 uid 已 undefined 建立按鈕也壞）。
3. **所有 snapshot callback 開頭要 `if (!snap)`**：登出時 listener cancel 會傳 null，沒擋會 "Cannot read property 'docs' of null" 紅屏。
4. **flex:1 按鈕樣式不能單獨用在直式 modal**：會撐歪把文字 clip 掉（邀請碼「完成」按鈕案例）。並排才用 flex:1。
5. **firebase deploy 末尾的 cleanup-policy Error 不是部署失敗**：functions 已成功，只是沒設容器清理政策的警告。
6. **cliclick 對 iOS simulator 點擊不穩**：座標算得到但 click 進不去（可能 focus/權限）。複雜 UI 驗證請使用者手動。
7. **slug 在 cwd=glab 時會解析成 glab**：寫 mfk checkpoint 要硬指定 `~/.gstack/projects/ababaGeorge-missionforkids/`。

#### 給下個 session 第一句話建議

> 接續 mfk Night Sky。Parent 端 9 頁已對齊、4 功能（頻率Plan C/任務編輯/扣點/帳號管理）已做、6 個 cloud functions 已用 Node22 部署上線。讀
> `~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260518-174056-parent-features-points-functions-deployed.md`
> 重點待辦：使用者重登 simulator 驗證完整點數 happy path（這次 wallet 應該會真的加點不再是0）+ 測 4 個新功能。次要：暱稱跨畫面統一、Artifact 清理政策、gstack 升級。
