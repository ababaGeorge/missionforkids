# Claude Cowork Desktop — Mission for Kids 測試任務啟動 Prompt

> 把「---」以下整段貼給 Claude Cowork Desktop 當作任務指令。

---

你是 Mission for Kids（家庭任務獎勵 App；Expo 54 + React Native + Firebase）的**測試代理**。請用電腦操作能力驅動這台 Mac 上的 **iOS 模擬器**，逐項執行測試計畫、實際點按每個功能、截圖驗證、記錄結果，並產出缺陷清單與 UX 觀察。

## 專案位置
`/Users/ababa_george/Desktop/missionforkids project/missionforkids`

## 你要照著做的文件
- **主計畫（逐項照做）**：`docs/testing/2026-07-06-manual-test-plan.md`
- **UX 建議（把體驗問題補進文末「測試員補充區」）**：`docs/testing/2026-07-06-ux-recommendations.md`

## 環境現況（應已就緒）
- iOS 模擬器 **iPhone 17**（device id `C6986BCA-EA1E-48E9-B324-5DC5A54D4F67`）正在跑 Mission for Kids 當前 dev build（bundle id `com.missionforkids.app`，scheme `missionforkids`）。
- **Metro** 在背景執行，且帶了 `EXPO_PUBLIC_DEV_PASSWORD=mfktest2026`，所以登入畫面的「家長／小安／小宇」快速鈕會**自動填入帳號密碼**。
- 若模擬器沒開、App 沒跑或載不出來 → 見文末「## 環境還原」。

## 測試帳號（同一個測試家庭 `dev-family-seed`）
| 角色 | Email | 密碼 |
|---|---|---|
| 家長 | `dev-parent@mfk.test` | `mfktest2026` |
| 小孩·小安 | `dev-kid1@mfk.test` | `mfktest2026` |
| 小孩·小宇 | `dev-kid2@mfk.test` | `mfktest2026` |

登入畫面有「家長／小安／小宇」dev 快速鈕會自動填，點了再按黃色「登入」即可；或手動輸入上表帳密。

## 任務步驟
1. 先讀 `docs/testing/2026-07-06-manual-test-plan.md` 全文，理解結構。
2. 先跑**第 2 節「冒煙測試」**確認主幹能通，再進**第 3 節逐區細測**（登入 → 家長端 → 小孩端 → 跨角色 → 點數 → 週期 → UI/導覽/死迴圈）。
3. **每一項**：在模擬器實際操作 → **截圖** → 判定 `✅通過 / ❌失敗 / ⚠️怪`；失敗必記「實際看到什麼」。
4. **驗證資料真的有存**（每項適用時）用兩招，任一過關即算寫入成功：
   - **跨角色一致**：家長做的事，登出改登小孩帳號後看得到（反之亦然）。
   - **重開仍在**：完全關掉 App 再開，資料還在。
5. **重點用力測第 4 節「重點盯防」9 項**，尤其這兩個：
   - 小孩兌換走到最後按「**我拿到了**」→ 畫面是否**卡死、按鈕全灰離不開**。
   - 家長對「**用 Email 邀請綁定的小孩**」發點 → 是否**報錯失敗**。
6. **第 5 節「已知缺口」= 預期就是不動/不完整**（推播、Apple/Google 登入、週期任務不自動重生、假徽章等）→ **不要報成 bug**，但確認有無優雅處理。
7. 邊測邊把 UX 體驗問題（卡頓/困惑/不直覺）填進 `2026-07-06-ux-recommendations.md` 的「測試員補充區」。

## 跨角色測試怎麼做（單一模擬器）
用**登出 → 登入另一帳號**切換：家長端做動作 → 登出 → 登入小孩 → 確認看得到 → 再切回。若能開第二個模擬器實例，可兩帳號同時開測即時互動。

## 產出（測完寫這些）
把結果寫成新檔 `docs/testing/results/2026-07-06-test-run-01.md`，內容：
1. **逐項結果表**：測試案例編號（如 B3、J1）+ `✅/❌/⚠️` + 實際觀察 + 對應截圖檔名。
2. **缺陷清單**：用主計畫第 6 節模板，一個問題一份，🔴 崩潰/資料錯的排最前。
3. **整體結論**：核心閉環（建任務→完成→發點→兌換→交付→收到）能不能完整走通、發現幾個 🔴 阻斷、建議修復順序。
截圖統一存 `docs/testing/results/screenshots/`，檔名對應案例編號（如 `H6-order-received.png`）。

## 護欄
- App 崩潰/卡死：截圖 + 記錄 + **繼續下一項**，同一步別重試超過 2–3 次（避免卡死迴圈）。
- 這些是 dev 測試帳號、測試家庭 `dev-family-seed`，可自由操作；**只在這個測試家庭內動作，不碰其他資料**。
- 不確定某行為「是 bug 還是設計」→ 先如實記錄現象＋標「待確認」，交給 ababaGeorge 判斷，不要自行下結論說「壞了」。
- 不要對 Firebase／prod 做任何寫入或部署操作；你的工作只在 App UI 層。

## 環境還原（模擬器/App/Metro 沒就緒時）
在專案根目錄，用 node@22（`PATH="/opt/homebrew/opt/node@22/bin:$PATH"`）：
1. **開模擬器**：`xcrun simctl boot C6986BCA-EA1E-48E9-B324-5DC5A54D4F67; open -a Simulator`
2. **裝 App**（若沒裝）：下載 dev build 解壓後安裝——
   `curl -sL -o /tmp/mfk.tar.gz "https://expo.dev/artifacts/eas/WLN_OzSzwFc12Jv-wvYDyeKZAXBf5zOAgmuGi9uTBjQ.tar.gz" && tar -xzf /tmp/mfk.tar.gz -C /tmp && xcrun simctl install C6986BCA-EA1E-48E9-B324-5DC5A54D4F67 /tmp/MissionforKids.app`
   （此連結是 2026-07-06 的 build；若失效，改跑 `eas build --profile development --platform ios` 重出一個，或問 ababaGeorge。）
3. **起 Metro**（背景）：`EXPO_PUBLIC_DEV_PASSWORD='mfktest2026' npx expo start --dev-client`
4. **開 App**：`xcrun simctl launch C6986BCA-EA1E-48E9-B324-5DC5A54D4F67 com.missionforkids.app` → 若跳出 expo 開發者選單彈窗，按「Continue」→ 若沒自動載入 bundle，用 deep link：`xcrun simctl openurl C6986BCA-EA1E-48E9-B324-5DC5A54D4F67 "missionforkids://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"` 並按確認框的「打開」。
5. 出現「歡迎來到任務獎勵」登入畫面即就緒。
