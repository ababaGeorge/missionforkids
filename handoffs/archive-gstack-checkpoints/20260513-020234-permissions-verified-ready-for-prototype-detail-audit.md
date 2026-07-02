---
status: in-progress
branch: ababaGeorge/office-hours
timestamp: 2026-05-13T02:02:34+08:00
files_modified: []
supersedes: 20260513-014306-night-sky-aligned-prototype-detail-audit-pending.md
---

## Working on: Mac 權限已通 — 下個 session 可全自動跑 prototype 對齊

### Summary

上份 checkpoint（20260513-014306）後，使用者：(1) 授權 Terminal.app 拿到 Accessibility +
Screen Recording 權限、(2) ⌘Q 重啟 Terminal.app、(3) 用 `claude --resume` 回到原本對話、
(4) 試了 `/context-restore` 失敗。本份補上「為什麼失敗 + 權限驗證結果 + 下個 session 怎麼
最快接上」。**權限三項全部通過**（cliclick p / screencapture -x / simctl screenshot），
下個 session 開起來就能全自動「prototype 並排截圖 → 自動點 simulator → 逐畫面對比 + 修
走樣」，不需要使用者再動手做任何 Mac 操作。

### Decisions Made

- **`/context-restore` 失敗根因**：新 session 預設工作目錄 `~/Desktop/glab`，`gstack-slug`
  在那兒回傳 `SLUG=glab`（因為 glab 不是 git repo），找錯了 checkpoint 目錄。從 manado
  workspace 跑才會回傳正確的 `SLUG=ababaGeorge-missionforkids`
- **權限驗證方式**：跑 `cliclick p && screencapture -x /tmp/test.png && xcrun simctl io
  booted screenshot /tmp/sim.png` 三個全成功 = 通
- **下個 session 啟動策略**：不依賴 `/context-restore` skill 的 slug 推導，直接告訴
  Claude 讀 checkpoint 檔案絕對路徑

### Remaining Work（下個 session 第一輪要做）

1. **啟動 Metro**（上個 session 結束時被 kill）：
   ```
   cd /Users/ababa_george/conductor/workspaces/missionforkids/manado
   npx expo start --port 8081 --clear
   ```
   等 `Logs for your project will appear below` 出現
2. **載入 app 到 simulator**（mfk app 已裝著，simulator 也還在 Booted）：
   ```
   xcrun simctl openurl booted "exp+missionforkids://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
   ```
3. **打開 prototype**（chrome-devtools MCP）：
   `https://missionforkids.vercel.app/` — 預設 C2 Night + Parent 配置
4. **開始逐畫面對齊**：
   - 第一頁：先測 child 端，因為 child 路徑短。用 cliclick 點 simulator 上的「以孩子身分進入」按鈕（Beta dev sign-in）
   - 對應 prototype Tweaks 切到 Child role
   - 並排截圖 → 我列差異 → 你點頭 → 改 code → HMR 驗證
5. **使用者具體痛點要逐一定位**：
   - 「按鈕無效或錯誤」
   - 「死局」（已修 1 個 child/task KAV，可能還有）
   - 「字體大小不適合」
   - 「沒置中」
   - 「滑動不順」
   - 「圖跟按鈕重疊」（FAB `bottom: 92` 是首要嫌疑犯）
6. **走完後**：把走樣清單寫進 `docs/ui-feedback-2026-05.md`、commit 修法、推 origin、
   重 EAS rebuild 送 TestFlight

### Notes

#### 下個 session 第一句話建議使用者打

> 接續 mfk Night Sky prototype 對齊。請讀
> `~/.gstack/projects/ababaGeorge-missionforkids/checkpoints/20260513-020234-permissions-verified-ready-for-prototype-detail-audit.md`
> 然後 cd 到 manado workspace、啟動 Metro、載入 simulator、打開 prototype，
> 開始 child 端逐畫面對齊。

（這樣繞過 `/context-restore` 的 slug 推導 bug，直接吃這份 checkpoint。）

#### 環境快照（驗證過）

```
Permissions:
  cliclick p              → 1915,1103         OK ✓
  screencapture -x        → 3MB PNG saved     OK ✓
  xcrun simctl io booted screenshot → OK ✓

Simulator:
  iPhone 17 Pro (B4436202-581F-4922-8D3A-B2CAA91273DE)  Booted
  com.missionforkids.app                                installed

Git (manado workspace, ababaGeorge/office-hours):
  23554ce docs: HANDOFF + session handoffs
  d24bedc chore(infra): app.json + eas store profile + firestore rules + grantPoints fn
  8036602 feat(ui): Night Sky reskin — all 14 in-app screens + sign-in + splash
  872eeb3 feat(design): Night Sky design system + ui-spec-c2 reference
  97aeef5 build(deps): pin RN 0.81 / Expo 54 toolchain + metro config
  Working tree: clean, pushed to origin

Metro: NOT running (was killed at session end)
```

#### 自動點 simulator 的方式（cliclick + screencapture 組合）

```bash
# 1. 找 Simulator 視窗在螢幕上的位置 + 大小
osascript -e 'tell application "System Events" to tell process "Simulator" to return {position, size} of window 1'
# 或 screencapture 全螢幕 + 人眼判斷

# 2. iPhone 17 Pro 邏輯解析度 402x874pt，但 Simulator 視窗在 Mac 上會被縮放
# 截圖檔的 px 跟 Simulator 視窗顯示的 pt 換算需要實測

# 3. cliclick 點擊（global screen coordinates）
cliclick c:X,Y    # 單擊
cliclick dc:X,Y   # 雙擊
cliclick t:文字   # 打字
```

**第一次點任何 simulator 按鈕前**：建議先 screencapture 全螢幕 + 讀檔，肉眼確認
Simulator 視窗的螢幕座標，算出按鈕中心位置，再用 cliclick c:X,Y。第二次以後該位置
就穩定了。

#### Prototype 對齊參考（同上份 checkpoint）

- **設計定版**：`https://missionforkids.vercel.app/`（活的網頁，9 家長 + 10 孩子畫面）
- **規格文件**：`docs/ui-spec-c2.md`（已 commit）
- **本地 prototype source**：`~/Desktop/missionforkids project/missionforkids/core_loop/`
  prototype_{child,parent,shared}{,2}.jsx + screens_c2.jsx
- **本次 audit 結果**：14 個 in-app .tsx 已掃過，token 用得 OK，沒有亂用顏色或字級；
  剩下的細節走樣需要實機/simulator 視覺對比才能發現

#### 已完成（不要重做）

- ✅ sign-in.tsx 完全重刻成 Night Sky（深藍 + 金黃 + 星空 + 膠囊按鈕 + glow）
- ✅ index.tsx splash 重刻
- ✅ child/task/[id].tsx 加 KeyboardAvoidingView（鍵盤死局修復）
- ✅ 全部 work 分 5 個 commit 推到 GitHub origin/ababaGeorge/office-hours
- ✅ /context-save 兩次（這份是第二次，supersedes 上份）
- ❌ EAS rebuild 送新 TestFlight（待下個 session 結尾跑）

#### Pending 從 4/24 還沒解（非急、視時間做）

- Parent notif：placeholder，待從 taskInstances 派生
- `child/order/[id].tsx`「我拿到了」按鈕邏輯沒接好
- Firestore 安全規則：`isFamilyMember` 加 `status == 'active'` 檢查
- 型別補齊：Task.graceDays、RewardItem.emoji、TaskInstance.parentNote/submittedAt

#### 教訓（已寫進這份 checkpoint，下次別重踩）

1. **Metro `CI=1` mode 會關 watch** — 啟動就不要加 CI=1
2. **expo run:ios `--device "iPhone 17 Pro"` 會被當實機解讀** — 不要帶 --device
3. **macOS 三權限**（Accessibility / Screen Recording / Automation）授給 Terminal.app
   後要 ⌘Q 完全重啟才生效
4. **gstack-slug 在非 git 目錄會回傳 cwd basename** — `/context-restore` 在 ~/Desktop/glab
   啟動的 session 會失敗。修法：先 cd 到 repo 內，或直接 Read 絕對路徑
