---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-05-18T19:52:25+0800
supersedes: 20260518-174056-parent-features-points-functions-deployed.md
files_modified:
  - functions/src/grantPoints.ts
  - functions/src/index.ts
  - functions/src/redeemInvite.ts (new)
  - src/lib/memberName.ts (new)
  - src/lib/inviteCode.ts
  - src/app/auth/sign-in.tsx
  - src/app/child/task/[id].tsx
  - src/app/parent/(tabs)/family.tsx
  - src/app/parent/(tabs)/notif.tsx
  - src/app/parent/(tabs)/review.tsx
  - src/app/parent/(tabs)/rewards.tsx
  - src/app/parent/(tabs)/tasks.tsx
---

## Working on: 暱稱跨畫面統一 + 點數 happy path 打通（修真實小孩 onboarding + dev 測試工具）

### Summary

接續上一個 checkpoint（parent 9 頁 + 4 功能 + 6 functions Node22 已部署）。本輪：升 gstack 1.11→1.40；做暱稱跨畫面統一；驗點數系統時連環挖出並修掉一串真實 bug，最後讓點數 happy path 在 simulator 完整跑通並視覺驗證。**所有程式碼改動尚未 commit**（branch ababaGeorge/office-hours，HEAD 仍 eebb8ca）。functions 端共 5 次 prod 部署（grantPoints×1、redeemInvite×4 迭代），全部成功上線（Node 22）。

點數 happy path 已由 function log 證明後端 100% 正確（onTaskInstanceApproved 正確 +10），且 dev 工具修好後使用者在 simulator 也視覺確認：任務狀態與點數正常持久。

### Decisions Made

- **暱稱統一用單一來源 `src/lib/memberName.ts`**：`memberName`/`memberAvatar` pure 函式 + `resolveMemberUser`（比照 useAuth：先 doc id 再 authProviderId fallback）+ `resolveMemberDisplay`。家長端 review/notif/rewards/tasks/family 全共用。規則：nickname?.trim() || displayName || fallback。
- **真實小孩 onboarding 改 server-side（使用者選 Cloud Function 方案）**：根因 = `redeemInviteCode` client 端寫 QQ user doc 撞 firestore rule `users update: request.auth.uid == userId`，小孩永遠綁不上家長建的 QQ/RR（正式產品 onboarding 本來就是壞的，只是先前沒跑通沒發現）。修法：新增 callable `redeemInvite`（admin 權限繞 client rules，transaction 原子），client `redeemInviteCode` 改呼叫它，簽名/錯誤碼不變呼叫端不動。
- **redeemInvite 帶 placeholder 的 nickname/avatarEmoji 進新 membership**：否則綁定後家長設的暱稱/頭像會掉。
- **redeemInvite 重綁資料遷移（使用者選「加遷移」）**：dev 每次進場換新匿名 uid，舊 uid 的 wallet/instances 成孤兒。修法：bind 後 best-effort 把 prevUid 的 pointWallet（餘額併入或改綁）+ taskInstances（重建成 `*_today_${newUid}` deterministic id）遷到新 uid。prod 只在重複兌換觸發、行為正確。
- **grantPoints 並發 lost-update bug**：`runTransaction` 內用 `db.collection().get()` 非 `tx.get()`，並發加/扣點會 lost update。改 `tx.get`。已部署。
- **給點數字輸入**：`keyboardType="numeric"` 擋不住 simulator 硬體鍵盤注音；改 `onChangeText` 強制 `replace(/[^0-9]/g,'')` + `number-pad`。
- **dev 測試工具兩個**：①sign-in.tsx 加「以現有小孩進入（QQ/RR）」按鈕（背後跑正式 createInviteCode+redeemInvite，dev-gated 可整塊刪）②child/task/[id].tsx 加「[dev] 假提交（跳過拍照）」（simulator 無相機）。
- **seedDevTasks 不洗進度（Fix A）**：原本 `{merge:true}` 把已存在 instance 蓋回 seed 的 pending。改成「instance 已存在就跳過」，保住 approved/submitted 進度。

### 本輪收尾已完成（2026-05-18 ~20:00）

- ✅ 移除 redeemInvite `[diag]` log（保留 `[migrate]`），已部署乾淨版 prod
- ✅ 程式碼分 4 commit（branch ababaGeorge/office-hours，**未 push**）：
  - `004ae4a` feat(parent): 暱稱跨畫面統一 + 給點數字輸入修復
  - `ca12902` fix(functions): grantPoints 並發 lost-update 修復
  - `54a41cb` fix(onboarding): 小孩邀請碼綁定改 server-side + 重綁資料遷移
  - `172749a` feat(dev): 模擬器測試工具 + seed 不洗進度

### Remaining Work（依優先序）

1. **未 push**：4 個 commit 在本地，`git push origin ababaGeorge/office-hours` 尚未做（上輪 checkpoint 提過 origin 無 upstream，需確認 remote）。
2. **dev 捷徑上正式前要 gate 或移除**：「以現有小孩進入」「[dev] 假提交」目前無條件顯示。正式版前需用 `__DEV__` 或環境旗標包起來，或整塊移除（皆已註解標示可整塊刪）。
4. **child 端暱稱待產品決定**：小孩自己畫面（child tasks/me）顯示 `user.displayName`（Queenie 本名），沒套家長設的 family-scoped 暱稱（QQ）。家長端已統一；小孩端要不要看暱稱是產品決定，未做。
5. **auto-mode classifier 白名單**：使用者要自己加（AI 被硬擋不能代勞）。方式：`/permissions` 或編 mfk `.claude/settings.local.json` 加 `Bash(npx --no-install firebase deploy:*)` + `Bash(firebase deploy:*)`。沒加就維持「使用者說『部署 X』我重試」。
6. **GCP Artifact Registry 清理政策**沿用上輪未設（每次 deploy 結尾 cleanup-policy Error，非失敗）。使用者可自跑 `firebase functions:artifacts:setpolicy --location us-central1 --days 3 --force`。
7. firebase-functions 6.6.0 deploy 時警告版本舊，維持不升（上輪決策，v7 breaking）。
8. 小孩間點數互轉（使用者說未來再做）。

### Notes

#### 點數 happy path 驗證證據（function log）
```
onTaskInstanceApproved:
 11:36:18 Points awarded instanceId=dev-task-desk_today_7CYqada… userId=7CYqada… points=10
 11:39:25 Points awarded instanceId=dev-task-desk_today_hUPWR1ov… userId=hUPWR1ov… points=10
```
後端正確（每次 +10）。先前「審核完點數沒加/任務變回未提交」根因 = dev 每次進場換新匿名 uid + seedDevTasks merge 洗回 pending，非產品 bug。遷移 + Fix A 修掉後使用者 simulator 視覺確認正常持久。

#### redeemInvite 演進（4 次部署）
1. 初版 server-side bind（解 onboarding 被 rule 擋）
2. + 帶 nickname/avatarEmoji
3. + 診斷 log（定位 permission-denied → 證實是舊 session auth 殘留，乾淨重綁後正常）
4. + 重綁資料遷移（prevUid → newUid wallet/instances）

#### permission-denied 結案
image #4 的 `[ChildTasks] firestore/permission-denied` 是早期未修版本 + 舊 session auth 殘留造成。diag log 確認 redeemInvite 寫的 membership doc id 正確（`${authUid}_dev-family-001`）。乾淨重綁後不再出現。

#### 環境快照
```
Workspace:  /Users/ababa_george/conductor/workspaces/missionforkids/manado
Branch:     ababaGeorge/office-hours（本輪 4 commit 已落地至 172749a，未 push）
cwd 注意:   session 在 ~/Desktop/glab 啟動，slug 解析成 glab。
            mfk checkpoint 必須硬指定 ~/.gstack/projects/ababaGeorge-missionforkids/
Firebase:   mission-for-kids，functions 7 個（含新 redeemInvite）全 Node22 prod
Simulator:  iPhone 17 Pro（B4436202…），App bundle com.missionforkids.app，
            Metro dev-client port 8081 仍在跑
gstack:     已升 1.11 → 1.40
```

#### 教訓（本 session）
1. **redeemInviteCode client 寫他人 user doc 必被 `users update` rule 擋** → 任何「綁定到別人建的 placeholder」都得走 Cloud Function（admin）。
2. **dev 匿名登入每次換 uid**：任何「跨身分來回」測試（小孩↔家長）都會讓前一身分的 wallet/instances 成孤兒。要嘛遷移、要嘛穩定身分。
3. **seedDevTasks 用 merge 會洗掉真實進度** → seed 類工具一律「不存在才寫」。
4. **simulator 無相機**：拍照流程在 simulator 測不了，需 dev 假提交或真機。
5. **auto-mode classifier 硬擋 AI 自行加白名單**（Safety-Check Bypass），只能使用者本人加。
6. RNFB v22 `DocumentSnapshot.exists` 是**方法** `exists()` 不是屬性（tsc 會抓）。
7. cwd=glab → slug=glab，mfk checkpoint 要硬指定路徑（沿用上輪教訓）。

#### 給下個 session 第一句話建議
> 接續 mfk。點數 happy path 已打通並驗證（暱稱統一 + redeemInvite server-side onboarding + 重綁遷移 + grantPoints 並發修 + dev 工具）。讀
> `~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260518-195225-points-happypath-verified-redeem-cf.md`
> 最優先：4 commit 已落地未 push（HEAD 172749a），確認 remote 後 push；dev 捷徑上正式前要 __DEV__ gate/移除。
