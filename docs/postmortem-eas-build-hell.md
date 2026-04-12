# EAS Build 地獄踩坑紀錄

> 2026-04-12 ~ 04-13｜Expo 54 + React Native 0.81 + @react-native-firebase + Firebase iOS SDK
> 20+ 次 build 失敗，歷時 ~8 小時，最終靠 Codex 給出正確配置

---

## TL;DR

Expo 54 + RNFB + Firebase iOS SDK 的 CocoaPods 設定是一個多維度的相容性地雷陣。每修一個問題就會觸發下一個。最終解法極其簡單，但找到它需要踩過所有的坑。

**最終能 build 的配置：**
```
RNFB v24 + Firebase iOS SDK 12.10.0
expo-build-properties: useFrameworks: "static" + forceStaticLinking
$RNFirebaseAsStaticFramework = true
EAS image: Xcode 16.3（不是 26）
不需要 modular headers、post_install hacks、C++ flags
```

---

## 踩坑時間線

### 坑 1：Node 25 simdjson 壞了
**錯誤：** `Library not loaded: libsimdjson.31.dylib`
**原因：** Homebrew 升級 simdjson 到 4.6.1（.33 dylib），但 Node 25 編譯時連結的是 4.4.x（.31 dylib）
**修法：** symlink 舊版 dylib：`ln -sf .../simdjson/4.4.2/lib/libsimdjson.31.dylib /opt/homebrew/opt/simdjson/lib/`
**教訓：** Homebrew 背景更新會悄悄破壞 Node

### 坑 2：依賴版本不匹配
**錯誤：** `expo doctor` 失敗 — `expo-build-properties` 55.0.13 vs 要求 ~1.0.10
**原因：** 上一個 session 用了不相容的 package 版本
**修法：** `npx expo install --fix`
**教訓：** 每次改依賴後跑 `npx expo install --check`

### 坑 3：react-dom peer dependency
**錯誤：** `npm ci` 失敗 — react@19.1.0 vs react-dom@19.2.5 peer dep 衝突
**原因：** EAS 用 `npm ci` 嚴格模式，本機 `npm install` 能過但 EAS 不行
**修法：** package.json 加 `"overrides": { "react-dom": "19.1.0" }`
**教訓：** 本機能裝不代表 EAS 能裝

### 坑 4：FirebaseMessagingInterop modular headers
**錯誤：** `The Swift pod FirebaseFunctions depends upon FirebaseMessagingInterop which does not define modules`
**原因：** 加了 `@react-native-firebase/functions` 但沒在 modular headers 列表裡
**修法：** 加入 withModularHeaders.js 的 pod 列表
**教訓：** 每加一個 RNFB module 都可能需要新的 modular header

### 坑 5：FirebaseAuth-Swift.h not found（死亡循環開始）
**錯誤：** `'FirebaseAuth/FirebaseAuth-Swift.h' file not found (in target 'RNFBStorage')`
**原因：** Firebase 11+ 的 Storage/Auth/Firestore 是 Swift pods，static library 模式下不會生成 Swift compatibility header
**嘗試過的修法（全部失敗）：**
1. ✗ 加更多 modular headers（GTMSessionFetcher、FirebaseStorageInternal）→ 版本衝突
2. ✗ `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` → 沒用
3. ✗ `HEADER_SEARCH_PATHS` 加 Firebase headers → 檔案根本不存在
4. ✗ `use_frameworks! :linkage => :static` → 觸發坑 6
**教訓：** 這個問題在 static library 模式下無解，必須用 frameworks

### 坑 6：use_frameworks 導致 RNFB ObjC 編譯失敗
**錯誤：** `type specifier missing, defaults to 'int' (in RNFBStorageModule.m)`
**原因：** 這其實和坑 5 是同一個根因 — Firebase types 找不到，所以 compiler 把未知 type 當 int
**教訓：** 這不是 use_frameworks 的問題，是 Firebase SDK 版本的問題

### 坑 7：降級 Firebase 10 — AppDelegate 不相容
**錯誤：** `Cannot add Firebase code to AppDelegate of language "swift"`
**原因：** RNFB v20 不支援 Expo 54 的 Swift AppDelegate
**修法：** 用 RNFB v21（支援 Swift AppDelegate）+ `$FirebaseSDKVersion = '10.29.0'`
**教訓：** RNFB v20 太舊，v21 是最低可用版本

### 坑 8：Firebase 10 + GoogleSignIn 9 版本衝突
**錯誤：** `GoogleUtilities/Environment` 需要 ~7.12（Firebase 10）和 ~8.0（GoogleSignIn 9 via AppCheckCore 11）
**原因：** GoogleSignIn 9 的 AppCheckCore 11 升級了 GoogleUtilities 到 v8
**修法：** 移除 @react-native-google-signin（功能未啟用）
**教訓：** Firebase 10 生態系已經老化，第三方 library 都跑太前面了

### 坑 9：Firebase 10 gRPC + Xcode 26 — unsupported '-G' flag
**錯誤：** `unsupported option '-G' for target 'x86_64-apple-ios15.1-simulator'`
**原因：** Firebase 10.29.0 的 BoringSSL-GRPC 版本太舊，不相容 Xcode 26 的 assembler
**教訓：** Firebase 10 已經完全無法在新 Xcode 上 build。**此路不通。**

### 坑 10：回到 Firebase 12 — gRPC std::result_of
**錯誤：** `no template named 'result_of' in namespace 'std'`
**原因：** Firebase 12 的 gRPC 也有 C++17 deprecation 問題（但比 Firebase 10 好修）
**修法：** post_install 設 `CLANG_CXX_LANGUAGE_STANDARD = 'c++14'`
**教訓：** C++14 能修 gRPC 但會破壞 React Native（需要 C++20）

### 坑 11：C++14 破壞 React Native
**錯誤：** `unknown type name 'concept'`、`no type named 'identity' in namespace 'std'`
**原因：** React Native 0.81 用 C++20 features（concepts、std::identity），全域設 C++14 把它搞壞了
**教訓：** 不能全域改 C++ standard

### 坑 12：template-arg-list warning as error
**錯誤：** `-Wmissing-template-arg-list-after-template-kw` 被當作 error
**修法：** `OTHER_CPLUSPLUSFLAGS = '$(inherited) -Wno-missing-template-arg-list-after-template-kw'`
**副作用：** Ruby type error（nil + string）→ 改用直接賦值
**教訓：** CocoaPods build_settings 的值可能是 nil 或 Array，不能假設是 String

### 坑 13：post_install 位置錯誤
**錯誤：** C++14/warning flags 設了但沒生效
**原因：** 放在 `react_native_post_install()` **之前**，被它覆蓋
**修法：** 改放在 `react_native_post_install()` **之後**
**教訓：** Expo 的 post_install 會重設 build settings，自訂設定必須在最後

### 坑 14：use_frameworks 注入位置錯誤
**錯誤：** `use_frameworks!` 被插到 `if` block 裡面
**原因：** regex `use_expo_modules!\s*!?\(?.*\)?` 中 `\s*` 吃掉了換行，匹配到下一行
**修法：** 改用 `expo-build-properties` 的 `useFrameworks: "static"`（正確的 Expo 做法）
**教訓：** 不要用 regex 改 Podfile 結構，用 Expo 官方機制

### 坑 15：免費帳戶 build 配額用完
**錯誤：** `This account has used its iOS builds from the Free plan this month`
**修法：** 升級 EAS 付費方案
**教訓：** 免費帳戶一個月大概能 build 15 次左右，debug build 問題很容易超

---

## 最終解法（by Codex）

Codex 分析了整個 repo + 上游 issue，給出三個關鍵建議：

1. **`forceStaticLinking`** — Expo 的官方機制，取代所有 Podfile post_install hacks
2. **`$RNFirebaseAsStaticFramework = true`** — RNFB 官方要求
3. **固定 Xcode 16.3** — 避開 Xcode 26 的 gRPC/C++ 相容問題

最終 plugin 只有 5 行：
```js
module.exports = function(config) {
  return withPodfile(config, (config) => {
    const line = '$RNFirebaseAsStaticFramework = true';
    if (!config.modResults.contents.includes(line)) {
      config.modResults.contents = `${line}\n${config.modResults.contents}`;
    }
    return config;
  });
};
```

---

## 學到的教訓

### 架構層級
1. **Expo + Firebase native SDK 是地雷組合** — CocoaPods 的 static lib vs framework、Swift vs ObjC、modular headers 三者交織，任何一個變數改動都會連鎖反應
2. **Xcode 版本很關鍵** — 同樣的程式碼在 Xcode 16 能 build，Xcode 26 就不行。一定要固定 EAS image
3. **Firebase iOS SDK 的 Swift 遷移是分水嶺** — v10 是 pure ObjC 但 gRPC 太舊；v11+ 是 Swift 但需要 use_frameworks。沒有中間地帶

### 實務層級
4. **不要 regex 改 Podfile** — 用 `expo-build-properties` 和 Expo 官方 plugin API
5. **不要全域改 C++ standard** — React Native 需要 C++20，只能對特定 targets 降級
6. **post_install 順序很重要** — `react_native_post_install()` 會覆蓋之前的設定
7. **EAS 用 `npm ci`** — 比 `npm install` 嚴格，本機能過不代表雲端能過
8. **pod 'X', :modular_headers => true 不指定版本時** — CocoaPods 用依賴圖中的版本，但如果 pod 不在圖中會拉最新版造成衝突

### 流程層級
9. **Codex 比一個一個 build 試有效** — 人類（或 AI）逐個修錯會陷入局部最優解。Codex 能看全局並直接指向正確配置
10. **免費 EAS 帳戶不適合 debug build 問題** — 每次 build 15-20 分鐘 + 排隊，配額很快用完
11. **先驗證 prebuild 再提交 EAS** — `npx expo prebuild --no-install` 能在本機驗證 Podfile 注入是否正確
