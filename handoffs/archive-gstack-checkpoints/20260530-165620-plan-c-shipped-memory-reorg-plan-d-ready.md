---
status: in-progress
branch: feat/real-user-accounts
timestamp: 2026-05-30T16:56:20+0800
files_modified:
  - docs/superpowers/plans/2026-05-30-real-user-accounts-plan-d.md (新增 Plan D v2 計畫，未追蹤/未 commit)
  - ~/.claude/rules/work-style.md (新增全域規則)
  - ~/.claude/rules/decision-log.md (新增全域規則)
  - ~/.claude/projects/.../memory/project-decision-log.md (新增 missionforkids 全局地圖)
  - (Plan C 程式碼已於本 session 稍早 commit+push+部署，HEAD 0d06d7d)
---

## Working on: Plan C 已上線(部署+E2E) + 記憶系統重整 + Plan D v2 計畫就緒，下一步實作 Plan D

## 下一步（開新 session 直接做這個）
**實作 Plan D v2** —— 權威文件 `docs/superpowers/plans/2026-05-30-real-user-accounts-plan-d.md`（codex 審過、決策鎖定）。
鐵律：**先建 seed 跑通完整流程，才移除匿名捷徑與邀請碼**（先建後刪）。

### Summary
本 session 做了三大塊：(1) Plan C(childId 點數重構)實作→commit→push→**部署正式環境**→**正式 Firebase E2E 驗證通過**；
(2) **記憶系統重整**(全域 work-style + decision-log 規則、missionforkids 全局地圖,解長線稀釋);
(3) **Plan D v2 計畫**(codex 審過、決策鎖定,尚未寫 code)。git HEAD `0d06d7d`(Plan C),已 push。Plan D 計畫檔未 commit。

### Decisions Made
- **Plan C 已上線且驗證**：4 CF 部署正式環境，正式 Firestore E2E 三 trigger 全綠(25→15→25、client 亂寫 childId 被忽略、退款回原錢包)。cleanup policy 已設(3 天)。
- **記憶分層紀律(已全域化)**：checkpoint=短期交接;memory/=長期脊椎(決策+為什麼);docs=細節權威。重要決策**升級進 memory 全局地圖**,不只留會滾動的 checkpoint。規則在 `~/.claude/rules/decision-log.md` + `work-style.md`(工作習慣/授權邊界/🟢🟡🔴 分級/先建後刪),所有專案通用。
- **Plan D v2 決策(全鎖定)**：D-1=A Admin SDK seed **用穩定 UID**;D-2=A 移除 family 匿名加小孩、一律 email 邀請;D-3=A 保留 `__DEV__` 自動填入鈕;**邀請碼=全收**(codex 校正:inviteCode.ts 非死碼,family 有整套邀請碼 UI;半殘+與 email 邀請重疊→整套移除)。**co-parent 邀請暫時消失**(列未來,email 邀請擴充補)。
- codex Plan D 必修(已寫進 v2)：seed 對齊 acceptFamilyInvite/bootstrapParentAccount shape(+斷言測試)、seed 的 task/reward 帶 childId、全流程驗證(非只登入)、全 repo grep gate、清匿名 Auth users(非只 Firestore)。

### Remaining Work
1. **實作 Plan D v2**(5 段：seed 腳本→seed 跑通完整流程驗證→移除匿名 dev 捷徑→全收邀請碼→清資料+整合驗證)。
2. 未來：email 邀請擴充支援邀請家長(補回 co-parent)。
3. 🔴 上線前：Resend 自有寄件網域。
4. 補強：完整 App 視覺 E2E(child 端畫面,後端已驗)。
5. 之後：feat/real-user-accounts → main 開 PR(A/B/C/D 收齊)。

### Notes
- **git**：HEAD `0d06d7d`(Plan C,已 push)。Plan D 計畫檔未追蹤未 commit。`.maestro/` + 舊 handoffs 一直未 commit(刻意)。
- **背景 Metro**(bg `bdjwusnj5`,:8081)+ 模擬器 App 還開著。新 session 不需要的話 `kill $(lsof -ti :8081)`。
- **測試現況**：functions 44/44、RN 13/13、tsc 雙乾淨。
- **codex Plan D consult session**：`019e780d-cfee-74a0-aae4-eed3056b6501`(要追問可 `/codex` 續)。
- **舊資料**：dev QQ(`EPXQAVro`)/RR(`giVFzmh1`)是舊匿名、無 childId、舊錢包 auto-id,新讀取顯示 0(預期)。Plan D 的 seed 改用穩定 uid 真帳號,E2E 用 seed 帳號不要用舊 QQ/RR。
- 全局抓宏觀請先讀 memory `project-decision-log.md`。相關：[[points-identity-fragmentation]](根因已修)、[[maestro-newarch-no-hierarchy]]、[[repo-branch-structure]]、[[work-style-...→已移全域]]。
