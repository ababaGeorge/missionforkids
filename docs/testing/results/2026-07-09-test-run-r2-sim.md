# R2 模擬器實測報告（pre-deploy client 側驗證）

> 日期：2026-07-09 ｜ 分支：fix/cowork-round2 @ b18f2b4（36 commits）｜ 環境：iPhone 17 Pro（A, B4436202）＋ iPhone 17（B, C6986BCA）雙模擬器、Metro dev client 連 prod、Maestro 2.6.0 座標驅動＋截圖＋Firebase MCP 後端讀值
> 範圍原則：只測 client 側修復。後端修復（扣款競態、rules 狀態機、發點守衛、冪等標記）已由 emulator E2E 78 步攻防覆蓋；註冊/邀請/clamp 提示等依賴新 CF 的流程**禁測**（部署順序約束），列 Run 03。

## 結果：8/8 通過

| # | 驗證項 | 結果 | 關鍵證據 |
|---|---|---|---|
| S1 | R2-32 忘記密碼連結＋空 email 提示 | ✅ | Alert「請先填寫 Email」，未實際送出 |
| S2 | R2-14 「+ 邀請小孩」extended FAB | ✅ | pill 型 FAB 帶文字（初次誤判係 Metro stale bundle，重啟 --clear 後正常） |
| S3 | R2-20 家長設定列「尚未開放」 | ✅ | Alert「語言／尚未開放」 |
| S4 | R2-15a 通知點擊導覽 | ✅ | 點卡片直達審核頁對應申請 |
| S5 | R2-10 封存品項橫幅 ＋ R2-04 stale 核准守衛 | ✅ | 見下 |
| S6 | R2-07 archived 任務過濾 | ✅（帶保留） | 過濾器有效，但非即時（見 R3-1） |
| S7 | R2-19 加入時長顯示 | ✅ | Kid3 顯示「今天加入」非「加入 1 個月」 |
| S8 | R2-20 小孩設定列回饋 | ✅ | Alert「語言／尚未開放」 |

### S5 全鏈（核心情境，雙機協作）
小安見 #SXSN 橫幅 → 家長封存「遊戲30分鐘」→ 小安**橫幅仍在可進入**（R2-10 ✓，修前會鎖死商城）→ 家長審核 sheet 停住（顯示兌換前 ★38→兌換後 ★8 快照）→ 小安取消訂單 → 家長按「好，答應她」→ **友善 Alert 真的顯示**（「這筆兌換已被小孩取消，點數已退還」——/check 點名的 iOS 時序 quirk 實測過關）。
後端（MCP 讀 prod）：`rewardOrders/ZBvt53YQyPleVeXRsXSn` status=cancelled 未被蓋寫；`pointWallets/dev-family-seed_dev-kid1` balance=38（退款正確）；`rewardItems/dev-reward-game` status=archived。

## 測試殘留（dev-family-seed）
1. `rewardItems/dev-reward-game`「遊戲 30 分鐘」已封存（要復原需另行處理）
2. `tasks/rSiDfFFkRZHfvnmnDBMH`「測試任務」已封存
3. 訂單 #SXSN 已取消，小安錢包 8→38（處置定案：以取消作為 R2-04 守衛實測）
4. 模擬器 B 登入中帳號為 Kid3

## R3 候選（本輪新觀察）
1. 🟡 **小孩任務清單不即時反映封存**：R2-07 的 filter 掛在 taskInstances snapshot 回呼，task doc 的 status 變更不觸發 instance listener——切 tab 不刷新、要重啟 App 才消失，期間小孩仍可能提交已封存任務（與審查記錄「詳情頁可提交 archived」同根）。修法方向：訂閱 tasks 集合或組裝時重讀 task status。
2. 🟢 取消訂單確認框破壞性按鈕與標題同文字「取消訂單」（自動化易誤中，使用者無礙）。
3. 🟢 dev 快速填入鈕缺 Kid3（常駐 fixture 要手動輸入）。
4. 🟢 環境教訓：長命 Metro 不保證吃到新 commit——驗 client 修復前先重啟 Metro（--clear）。

## Run 03（部署後補測清單）
- R2-13 clamp 提示顯示實際扣值（需新 CF delta）
- R2-05/06 註冊恢復＋逃生出口（需新 CF 守衛；含 R2-24 家長完整註冊）
- R2-29 removed 成員重邀 reactivate（真流程）
- CX-1 rules 狀態機 prod 生效驗證（MCP 重讀 rules）
- R2-25 退回 3 次→missed、R2-26 通知 >20、R2-27 低優先回歸池（視成本）
- E2E 補步：建單後立刻 approve → 餘額仍被扣（FIX-A 部署後）
