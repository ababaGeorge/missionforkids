---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-05-13T01:43:06+08:00
files_modified: []
---

## Working on: Night Sky 對齊 prototype — 細節走樣 audit 待繼續

### Summary

使用者本來「卡 18 天」說整支 app UI 全部走樣不知怎麼改。本次 session 用 code-level audit
找到真相：14 個 in-app 畫面其實 12 個對齊 Night Sky 設計系統不錯，只是有 2 個孤兒入口
畫面（`auth/sign-in.tsx` + `index.tsx`）完全沒套設計系統，導致打開 app 第一眼就崩壞。
另外從 bug pattern 掃描找到 1 個功能 bug（`child/task/[id].tsx` 沒包 KeyboardAvoidingView，
輸入備註時鍵盤擋住輸入框，是「死局」之一）。三個都修了 + 全部 Night Sky 工作（4/24 完成
但從未 commit）一併分 5 commit 推到 GitHub。下一個 session 要繼續做 prototype detail
alignment — 使用者具體說：「按鈕無效/錯誤、字體大小不適合、沒置中、滑動不順、圖跟按鈕重疊」
需要實際操作 simulator 才能定位。

### Decisions Made

- **問題重新定義**：使用者「都走樣」其實 80% 是 sign-in 第一印象崩盤，不是 14 個畫面都壞
- **修法選擇**：保留所有 4/24 Night Sky 8 phase 工作 + 加入今晚 3 個 fix，分 5 個邏輯
  commit（deps / design system / UI reskin / infra / docs）一次 push，不分批
- **Sign-in 重刻策略**：完全替換 StyleSheet，導入 `src/design/` tokens + Starfield +
  Display/Label/AppText 元件，pill 按鈕，金色 glow CTA。Auth logic / Firebase / i18n
  零改動，純樣式重寫
- **Index splash 重刻**：白底 + #4A90D9 藍轉圈 → P.bg 深藍 + P.primary 金色轉圈 +
  Starfield
- **Child task KAV fix**：`KeyboardAvoidingView` 包整個 sheet body（header + ScrollView +
  footerBar 一起），`Platform.OS === 'ios' ? 'padding' : undefined`，ScrollView 加
  `keyboardShouldPersistTaps="handled"`
- **不分小 commit 切 sign-in 修復**：原 sign-in.tsx 在 4/24 已有改動，今晚的重刻是
  在那基礎上覆蓋。要拆 4/24 改動 vs 今晚改動成本太高，乾脆 commit message body 寫清楚
- **不用簡單 git add -A**：每個 commit 明確列檔案，避免誤 commit `.env` 或機密
- **送 simctl screenshot 是唯一可行的視覺驗證**：使用者用 Remote Control 從手機看
  Claude，Mac 沒人在；cliclick / osascript / screencapture 都被 macOS Accessibility +
  Screen Recording 權限擋住；無法自動點 simulator

### Remaining Work

1. **使用者授權兩個 Mac 權限給 Terminal.app**（next session 才能自動操作 simulator）：
   - 系統設定 → 隱私權與安全性 → **輔助使用** → + Terminal.app
   - 系統設定 → 隱私權與安全性 → **螢幕與系統音訊錄製** → + Terminal.app
   - 完全 ⌘Q 結束 Terminal.app 重開，重進 tmux session
   - 驗證指令：`cliclick p`（印滑鼠位置）、`screencapture -x /tmp/t.png`（截全螢幕）兩個都不報錯就 OK
2. **逐畫面 prototype 對齊 audit**（使用者具體痛點，需 simulator 操作驗證）：
   - 按鈕無效或錯誤：需要使用者具體 repro
   - 字體大小不適合：需要逐畫面看 vs prototype 比對
   - 沒置中：layout 視覺檢查
   - 滑動不順：實機/simulator 操作測試
   - 圖跟按鈕重疊：12 處 absolute positioning（FAB `bottom: 92` 是首要嫌疑犯，不同手機高度可能擋內容）
3. **重新 EAS rebuild + 送新 TestFlight**：今晚 3 個 fix 在 simulator 驗證了 sign-in，
   但 child/task KAV + index splash 沒實機驗證過，要讓使用者拿手機跑一遍
4. **Pending 從 4/24 checkpoint 還沒解的**：
   - Parent notif：仍是 placeholder，要從 taskInstances 派生實際資料
   - `child/order/[id].tsx`「我拿到了」按鈕邏輯沒接好
   - Firestore 安全規則：`isFamilyMember` 加 `status == 'active'` 檢查
   - 型別補齊：`Task.graceDays`、`RewardItem.emoji`、`TaskInstance.parentNote`、`TaskInstance.submittedAt`
5. **Phase 2 候選**（非急）：react-native-svg + Pip owl mascot 真 SVG / Celebration confetti / AI 自動初審 UI / notifications collection 資料模型

### Notes

#### 環境狀態（next session 接上就能用）

- **Metro bundler 還在跑** pid 應該在 port 8081，工作目錄 manado workspace。可能 session
  結束就沒了。重啟方式：`cd ~/conductor/workspaces/missionforkids/manado && npx expo start --port 8081 --clear`
- **iOS Simulator 還開著**（iPhone 17 Pro, UDID B4436202-581F-4922-8D3A-B2CAA91273DE），
  mfk app 已安裝（`com.missionforkids.app`），bundle 已正常載入。可直接 `xcrun simctl io
  booted screenshot` 截圖（無需權限）
- **Dev build native binary 已編譯**在 `ios/build/`，重 build 只要幾秒（pods 已裝）
- **Chrome devtools MCP** 開著 prototype (`https://missionforkids.vercel.app/`)，目前在
  C · Night + Parent + Busy day + Motion On + 中文 配置（C2 設計定版）
- **`/tmp/mfk-backup/`** 有今晚改的 2 個檔的 .bak 備份（保險，commit 後其實已不需要）
- **參考工件**：`/Users/ababa_george/Desktop/glab/` 底下：
  - `compare-01.html` / `compare-01.png` — sign-in before vs prototype 對比
  - `compare-final.html` / `compare-final.png` — sign-in before vs after 重刻
  - `mfk-impl-signin-fresh.png` — 重刻後 sign-in 真實截圖（驗證成功）
  - `mfk-proto-01-parent-tasks.png` — prototype 家長 tasks 畫面
- **`~/.claude/plans/mfk-tranquil-dongarra.md`** 有本次 session 的 plan，記錄了攻擊策略
  從「commit + push」→「UI 測試回饋翻譯」→「code-level audit + 修 2 孤兒 + KAV」的演變

#### Prototype 對齊參考

- **設計定版來源**：`https://missionforkids.vercel.app/` 是活的 prototype，**這就是
  你眼中的 ground truth**。9 個家長畫面 + 10 個孩子畫面，可用 Tweaks 切換 Direction (A/B/C) +
  Role + Load + Motion + Language
- **規格文件**：`docs/ui-spec-c2.md`（1000+ 行，本次已 commit）
- **本地 prototype source**：`~/Desktop/missionforkids project/missionforkids/core_loop/`
  有 prototype_{child,parent,shared}{,2}.jsx + screens_c2.jsx

#### 本次 audit 的關鍵發現（save 給 future session 避免重做）

```
auth/sign-in.tsx                         design=0 star=0 tokens=0    ← 孤兒（已修）
index.tsx                                design=0 star=0 tokens=0    ← 孤兒（已修）
其他 14 個 .tsx 都有 design system import，token 使用 8~69 次
```

```
fontSize 分佈統計（從整 src/app/ 掃出來）：
26x fontSize 11    22x fontSize 14    17x fontSize 13
16x fontSize 15    16x fontSize 12    12x fontSize 22
11x fontSize 10     9x fontSize 26     7x fontSize 20
全部對應 spec 字級表，沒有亂用
```

```
Hard-coded hex 顏色（潛在走樣，已掃過）：
- parent/(tabs)/{rewards,family,tasks}.tsx: '#000'   ← shadow 用，合理
- parent/(tabs)/review.tsx: '#1C1A14' + '#8A8275'    ← spec 規格內的 surfaceCream 配色
- child/(tabs)/rewards.tsx: '#FFF1DE'                ← 可能可改 token
```

#### 教訓 / 踩坑

- **Metro CI=1 模式 watch 被關**：第一次跑 `CI=1 npx expo start` 為了避開互動 prompt，
  結果 file changes 不會自動 trigger HMR，編輯了 sign-in.tsx 但 simulator 還是顯示
  舊畫面。要殺 Metro、清 cache、重啟 `npx expo start --port 8081 --clear` 不要 CI=1
- **expo run:ios --device "iPhone 17 Pro"** 會把名字當實機 device 解讀，要求 code signing
  certificate。應該不帶 `--device` 讓它自動 attach 已 boot 的 simulator
- **macOS 權限三件套會擋自動化**：Accessibility（控制其他 app）+ Screen Recording（截圖）
  + Automation（osascript System Events）。Claude Code 透過 Terminal.app 跑，所以權限
  要授給 Terminal.app
- **Remote Control 模式**：使用者透過 `/remote-control` 把 Claude 對話轉到手機看，Mac
  桌面沒人在 → 無法臨機應變授權權限或手動點 simulator → 必須提前安排好，或走 code-level 路線

#### Git 推送狀態（next session 從這裡接）

```
local & remote synced at:
  23554ce docs: HANDOFF + session handoffs (2026-04-17 / 2026-04-21)
  d24bedc chore(infra): app.json + eas store profile + firestore rules + grantPoints fn
  8036602 feat(ui): Night Sky reskin — all 14 in-app screens + sign-in + splash
  872eeb3 feat(design): Night Sky design system + ui-spec-c2 reference
  97aeef5 build(deps): pin RN 0.81 / Expo 54 toolchain + metro config
working tree: clean
```
