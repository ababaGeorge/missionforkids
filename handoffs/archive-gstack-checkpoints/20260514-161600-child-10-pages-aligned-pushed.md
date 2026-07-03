---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-05-14T16:16:00+08:00
supersedes: 20260513-020234-permissions-verified-ready-for-prototype-detail-audit.md
files_modified: []
---

## Working on: Child 端 10 頁 prototype 對齊全部完成 + push origin

### Summary

接續 20260513 的 prototype 對齊 audit，完整做完 child 端 1-10 頁對 prototype 的 UI alignment。8 個 commit (5179aed..1342551) 全部 push 到 origin/ababaGeorge/office-hours。同時順手解了一大堆 dev 環境債務 (firestore membership doc ID bug、iOS 26.5 simulator runtime 缺、entitlements + keychain-error、cloud function reject dev orders 等)。下個 session 接「實機 TestFlight 真實流程驗證」或「parent 端 9 頁對齊」。

### Decisions Made

- **走 ad-hoc dev mode + Firestore prod**：seed dev tasks/rewards/orders 用 client SDK 直接寫，doc id 帶 uid suffix 避免跨 sign-in update 衝突 rules。不開 emulator (省設定成本)，犧牲離線/快速 reset
- **camera 採折衷方案**：簡內鏡頭用 iOS native (`expo-image-picker.launchCameraAsync`)，外圍 chrome (REC label / Pip 引導 / 大金黃 shutter / 4 個控制鈕) 做成 prototype 第 3 頁樣的 in-app overlay。鏡頭內 native UX 成熟 + 鏡頭外對齊 prototype 視覺
- **04 / 05 拆兩階段**：04「星光正在傳送」改成 transient `SendingOverlay`（handleSubmit 期間 submitting state 顯示），05「等爸媽看」是 Wait component (持續 submitted 狀態)。原本 4+5 共用一個 component
- **06 慶祝大金黃星 + +N 用 RN Text 而非設計版 SVG**：emoji-as-Text 處理 fallback 失敗 + 加 lineHeight 解決 clip 問題
- **dev mode 允許點 done card 進 Celebrate**：`!__DEV__ ? undefined : onPress` 純 dev helper，production unchanged
- **me 頁設定移到右上 ⚙ icon → modal**：拿掉底部 settings list，改右上齒輪 + Modal。位置用 `useSafeAreaInsets` 動態避免被 iPhone status bar 蓋
- **作業/書桌等 emoji 用 regex map 補齊**：emojiFor() 內加「作業/功課/寫/算」→ 📝，emoji 用 `<Text>` 非 `<Body>`，custom font 沒 emoji fallback

### Remaining Work（依優先排，下個 session 第一輪選一）

1. **實機 build + TestFlight 驗證**（最高風險未知）：mac mini 沒鏡頭，simulator 沒法走 handleSubmit → uploadPhoto → onTaskInstanceApproved trigger → grantPoints 整個 happy path
   - 需 EAS build / Apple Developer 帳號正常
   - 拿 iPhone 實機跑：實際拍照 + Firestore Storage upload + Cloud Functions process + push notification
2. **Parent 端 9 頁對齊**（mirror child 流程，scope 跟 child 端差不多）：
   - 01 任務管理 (`parent/(tabs)/tasks.tsx`)
   - 02-03 派任務 form + 鍵盤檢查
   - 04 審核 list (`parent/(tabs)/review.tsx`)
   - 05 兌換確認
   - 06 禮物 TAB (`parent/(tabs)/rewards.tsx`)
   - 07 新增禮物
   - 08 任務歷程
   - 09 設定/隱私
3. **Auth 真實整合**：Apple/Google Sign-in 設定 + invite code 流程跨 device 驗證
4. **Cloud functions dogfooding**：grantPoints / autoCompleteDeliveredOrders / analyzePhoto 在 prod 跑起來，wallet 自動累加（讓 06 慶祝頁的「總星光 ★ N」副標真實顯示而非走 fallback）
5. **設計版 illustration**：取代目前 system emoji fallback（書桌 / Pip 等 cartoony 設計）→ SVG illustration 庫

### Notes

#### 已完成（不要重做）

- ✅ Child 1-10 頁 layout 對 prototype（5179aed / edd45a6 / fce75e9 / 0f288cf / e02af86 / fbbb499 / 4f144b2 / 1342551）
- ✅ Firestore rules ↔ client doc ID 順序 bug 修了（`${uid}_${familyId}`，跟 inviteCode.ts 一致）
- ✅ `auth/keychain-error` 在 iOS 26.5 simulator 加 try-catch fallback 用 `auth().currentUser` 繼續寫 Firestore
- ✅ sign-in 加自動 signOut + seed dev tasks(6 個)/rewards(6 個)/order(1 個) 把對齊用 data 準備齊
- ✅ task seed 加 `parentHint` 字段（schema models.ts + sign-in.tsx + task/[id].tsx 顯示「媽媽的暗號」卡）
- ✅ TaskCard dev mode 可點 done card 進 Celebrate

#### 環境變動（從上份 checkpoint 後）

- macOS Xcode 升到 26.5、但 simulator runtime 還是 26.4 → 跑 `xcodebuild -downloadPlatform iOS` 下載 8.52GB iOS 26.5 runtime
- iOS app entitlements 加過 `keychain-access-groups` 試 codesign 後 binary launch fail，rollback 回原本（不加 entitlement）
- Mac 的 Screen Recording 權限不知何時失效（`screencapture -x` 拿到全黑 PNG），Automation 對 System Events 也 timeout。當前 session 透過 `xcrun simctl io booted screenshot` 拿 simulator 內部畫面 OK

#### Dev seed 邊際問題

- wallet balance 永遠 0：rules `pointWallets update: false`，cloud function `onTaskInstanceApproved` → `grantPoints` 才會寫，dev seed 直接寫 `status='approved'` 沒觸發 trigger
- 受影響 UI：me tab 總星光 = 0、celebrate 副標走「+N 顆星，加進你的天空」fallback (而非 prototype 樣「總星光 ★ 152」)
- `onRewardOrderCreated` trigger 看 wallet < cost 會把新 order 標 `rejected`：seedDevOrder 用 `pointCostSnapshot: 0` 繞過

#### Tab / Page entry points

- Sign-in: simulator dev client 開「以孩子身分進入」按鈕（自動 signOut 既有 user + 重新 anonymous sign-in + seed all）
- Page 2: child tab 任務 → 點任一非 done card (整理書桌、倒垃圾、寫作業)
- Page 3 camera prep: 上方 Page 2 點底部「📷 拍一張照片」（叫 native camera 前的引導頁）
- Page 4 sending: 只在 handleSubmit 期間顯示，simulator 沒鏡頭沒法觸發
- Page 5 wait: 點 child tab 任務 → 點「寫作業」(submitted 狀態) card
- Page 6 celebrate: dev mode 點完成的 done card (刷牙/餵魚)
- Page 7 rewards: 底部 tab 切「獎勵」
- Page 8 order: rewards tab 頂部 active order banner（吃冰淇淋）→ 點
- Page 9 me: 底部 tab 切「我的」（右上 ⚙ → 跳設定 modal）
- Page 10 notif: 底部 tab 切「通知」

#### 已 push commits（5179aed..1342551）

```
1342551  feat(ui): child pages 08/09/10 aligned — order detail / me / notif
4f144b2  feat(ui): child rewards tab (07) — seed dev reward items + fix orders index + use seeded emoji
fbbb499  feat(ui): child celebrate (06) screen aligned to prototype + dev done-card tappable
e02af86  feat(ui): child wait/delivered (05) screen + Sending transient overlay + emoji 📝 規則
0f288cf  feat(ui): child star sending (04) — Pip wait screen aligned to prototype
fce75e9  feat(ui): child camera prep (03) aligned to prototype outer chrome
edd45a6  feat(ui): child task detail (02) aligned to prototype + Task.parentHint field
5179aed  feat(ui): child today screen aligned to prototype + dev sign-in fixes
```

#### 環境快照

```
Workspace:    /Users/ababa_george/conductor/workspaces/missionforkids/manado
Branch:       ababaGeorge/office-hours (clean, all pushed)
Origin:       https://github.com/ababaGeorge/missionforkids.git (up to date)
Node:         v22.22.2
Xcode:        26.5 (Build 17F42)
Simulator:    iPhone 17 Pro (B4436202-...) iOS 26.4 (Booted)
Metro:        background task brqqnc63y (port 8081, started 2026-05-13 12:33)
.app:         ios/build/Build/Products/Debug-iphonesimulator/MissionforKids.app
Permissions:  cliclick OK / simctl io OK / screencapture FAIL / Automation FAIL
```

#### 給下個 session 第一句話建議

> 接續 mfk Night Sky prototype 對齊。Child 端 1-10 頁已對齊完成 + push origin (5179aed..1342551)。請讀
> `~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260514-161600-child-10-pages-aligned-pushed.md`
> 然後決定走哪條路：(a) 實機 TestFlight 跑真實 task happy path、(b) Parent 端 9 頁對齊、(c) 其他細節微調（me 頁間距、Pip illustration、wallet grant fn）

#### 教訓（從這次 session 學的）

1. **doc ID 順序要跟 firestore rules 一致** — `firestore.rules` 用 `${uid}_${familyId}`，client 端 doc().set() 要對齊（沒對齊 → permission-denied）
2. **dev seed 跨 sign-in 用 uid suffix** — 不然 update path 走 stricter rules（rewardItems update 需 isFamilyParent，child 不是 parent → denied）
3. **iOS Simulator entitlements 不要手動加** — codesign 後 binary launch fail (POSIX error 163)。simulator build 預設不嵌 entitlements 是 OK 的，keychain-error 從 JS 端 catch 解
4. **Xcode 升級後 simulator runtime 不會跟著升** — `xcrun simctl runtime list` 確認；不匹配跑 `xcodebuild -downloadPlatform iOS` 下載
5. **`xcodebuild` exit 0 ≠ build SUCCESS** — 要看 stdout 有沒有 `** BUILD SUCCEEDED **`。Monitor 要 grep 對的 marker
6. **不要為了清 auth state 而 uninstall app** — DerivedData 可能空殼，重 build 慢。改用 `xcrun simctl keychain booted reset` 或讓 user signOut from app
7. **RN Text fontSize override 要帶 lineHeight** — variant 預設 lineHeight 比新 fontSize 小 → 字符上方被 clip（0 變 O、D 上方切）
