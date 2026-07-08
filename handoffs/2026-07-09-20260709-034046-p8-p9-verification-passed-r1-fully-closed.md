---
status: completed
branch: main
head: "6914620"
timestamp: 2026-07-09T03:40:46+0800
continues_from: 20260709-015914-r1-shipped-run02-passed-pr9-merged-deployed-prod.md
files_modified:
  - （repo 無程式碼變更；本 session 只有模擬器實測＋prod dev 測試家庭資料操作）
  - ~/.claude/projects/.../memory/project-decision-log.md（補驗結果＋R2 新觀察）
---

## Working on: P8/P9 補驗完成——R1 待驗清零（Maestro 實機驅動＋Firebase MCP 後端驗證）

### Summary
接續 R1 收尾 checkpoint 的兩項待補驗，全數實測通過。環境從零架起（boot iPhone 17 Pro 模擬器
B4436202、背景起 Metro 帶 `EXPO_PUBLIC_DEV_PASSWORD`），用 Maestro 座標點擊驅動真 App、
Firebase MCP 驗 prod 後端。P8：小安兌換「遊戲30分鐘」→ 訂單 doc 含 CF 寫入的
`balanceBeforeSnapshot:38`/`balanceAfterSnapshot:8`、錢包 38→8、家長審核 sheet 顯示快照值。
P9：真流程邀請→註冊→發點全通，Run 01 重點②正式結案。R1 至此完全關閉。

### Decisions Made
- **P9 不收信完成驗證的辦法**：inviteId＝Firestore doc id＝email 深連結參數（`missionforkids://invite/{id}`），
  寄信是 best-effort（`createFamilyInvite.ts:60-77` 失敗不 rollback）→ 用 MCP 讀 `familyInvites`
  拿 inviteId，`simctl openurl` 直開註冊頁。email 鎖定 invite.email、CF 驗 auth token email 相符，全程走正式路徑。
- **邀請 email 用全新假信箱 `dev-kid3@mfk.test`**：寄信註定失敗（非真信箱）但符合設計（alert 顯示「寄信失敗，稍後可重寄」）；
  該 email 不得已存在 Auth 帳號，事前用 auth_get_users 確認過。
- **訂單 #SXSN 留在 pending 不核准**：補驗範圍只到快照驗證；核准/取消留給使用者體驗或下次處理。
- **Kid3 帳號保留**：建議留作「受邀小孩」常駐 fixture，迴歸測試免重走邀請流程。

### Remaining Work / Next Steps
1. **使用者選產品方向**：B2 推播 / B3 週期任務 / B4 OAuth（scoping 見 07-06 checkpoint）——或開 R2。
2. **R2 待辦池**（開輪時的輸入）：U6 扣點 clamp 提示（DEFECT-R2-01）、邀請入口可發現性（「+」加文字）、
   種子殘影清理、**新增：小孩「我的」頁剛加入顯示「加入 1 個月」（日期差顯示雜訊）**、
   高成本補測（C4 退回3次→錯過、通知>20）、`.superpowers/sdd/progress.md` Minor 清單、PR #8 其餘資料完整性修復。
3. 殘留處置（使用者決定）：訂單 #SXSN（pending 爸媽確認，小安 38→8）核准或取消；Kid3 fixture 去留。
4. 舊線：`demo/current-snapshot` worktree 去留、Resend 自有寄件網域（🔴 上線前必做）。

### Notes / Gotchas
- **E2E 驅動 recipe（可重用）**：Maestro 在 `~/.maestro/bin`（不在 PATH）；RN 新架構下只能座標點擊
  （`tapOn: point "x%,y%"`）＋截圖肉眼確認，原生 Alert 可用文字 tapOn；登出確認框按鈕是「確定」不是「登出」。
  Metro：`CI=1 npx expo start --dev-client` 背景跑＋env 帶 dev 密碼（值不寫這裡，git 歷史 d6f3d7a 的前版可取）。
  模擬器兩台 iPhone 17 Pro 都裝了 App，用最近 mtime 那台（B4436202, iOS 26.4）。
- MCP 複合查詢（childId+familyId+createdAt 排序）缺 composite index 會 400——臨時查詢改單欄位過濾（如 status==pending）。
- 家長端第五個 tab 標籤是「設定」但內容是 family.tsx（家庭與權限頁），FAB/發點 pill 都在這頁。
- dev 帳號：dev-parent / dev-kid1(小安) / dev-kid2(小宇) @mfk.test；新增 dev-kid3(Kid3) uid=4U3wSiBAW3d6jIDXxmOFhiVzjRw1。

### Branch / PR / Commits
- `main` @ `6914620`（= origin/main），worktree clean，本 session 零 commit（除本 handoff 檔）。

### Validation
- **P8**：`rewardOrders/ZBvt53YQyPleVeXRsXSn` 實查含 `balanceBeforeSnapshot:38`/`balanceAfterSnapshot:8`/
  `pointCostSnapshot:30`（client 建單欄位無快照，CF transaction 補寫）✓；`pointWallets/dev-family-seed_dev-kid1`
  balance 8 ✓；審核 sheet 顯示「兌換前★38→兌換後★8」✓（與 doc 快照一致，非 fallback）。
- **P9**：invite doc `familyInvites/y7ttGpwLNAKEkCgh8fJm` pending→accepted（acceptedBy=Kid3 uid）✓；
  membership `{uid}_dev-family-seed` active、childId=userId=uid ✓；確定性錢包建立 balance 0→發點後 10 ✓；
  App 端 alert「+10 ★ → Kid3」無「不是家庭成員」錯誤 ✓。
- 未跑：本地測試套件（無程式碼變更，不適用）。

### Data Safety
- 只動 prod 的 `dev-family-seed` 測試家庭：新增 1 invite doc、1 Auth 帳號（dev-kid3）、1 membership、
  1 wallet、1 rewardOrder、1 grant（+10）。全走 App 正式流程（CF），無 admin 直寫、無 rules 繞過。
- 未動 .env、prod 設定、真實使用者資料；repo 無程式碼變更。

### Manual Acceptance Checklist
1. 模擬器（家長帳號）審核 tab → 點「遊戲 30 分鐘」申請 → sheet 顯示「兌換前★38→兌換後★8」→ 可自行核准或婉拒體驗完整流程。
2. family 頁小孩清單應見 Kid3（頭像 K）；對其 ★± 發點應直接成功。

### Rollback / Do-Not-Do
- 要清 Kid3 fixture：刪 Auth 帳號 dev-kid3@mfk.test＋`familyMemberships/4U3wSiBAW3d6jIDXxmOFhiVzjRw1_dev-family-seed`＋
  `pointWallets/dev-family-seed_4U3wSiBAW3d6jIDXxmOFhiVzjRw1`＋invite doc（走使用者授權，agent prod 寫入會被 classifier 擋）。
- **不要**再提 dev 測試密碼洩漏/輪換議題（使用者已結案，見 memory dev-password-risk-accepted）。
- **不要**刪 core_loop 4 條備份線、不要強刪 `demo/current-snapshot` worktree。

### Remaining Confirmations
- 下一步：開 R2、還是先選產品方向（B2/B3/B4）？
- 訂單 #SXSN 與 Kid3 fixture 的處置？
