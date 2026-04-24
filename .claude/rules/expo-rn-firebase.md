## Expo + React Native + Firebase iOS Build 注意事項

### 額外環境檢查
以下項目在 session 開始時隨全域檢查一併執行：
- `firebase --version`
- `head -1 $(which firebase)`（確認 shebang 指向 node@22）
- `eas --version`

### Firebase Swift Pods modular headers
- `@react-native-firebase` 的 Swift pods 需要 modular headers
- **不能**全域 `use_modular_headers!`（會破壞 gRPC-Core modulemap）
- **不能**靠 `expo-build-properties` 的 `useModularHeaders: true`（只影響 Expo pods）
- ✅ 正確做法：自訂 config plugin `plugins/withModularHeaders.js`，用 `withPodfile` 在 `pre_install` hook 中對特定 pods 啟用 `swift_module_map: true`
- 需要啟用的 pods：`FirebaseAuthInterop`、`GoogleUtilities`、`RecaptchaInterop` 等

### Xcode 26 本機 build
- Firebase Firestore 依賴的 gRPC CocoaPods 跟 Xcode 26 不相容
- 不要本機 build，用 EAS Build 雲端建置（EAS 用穩定版 Xcode）

### EAS Build
- EAS Build 用 `npm ci --include=dev`，不容忍 peer dependency 不匹配
- 本機 `npm install --legacy-peer-deps` 能過但 EAS 會失敗
- 用 `npx expo install --fix` 檢查相容版本，react/react-native 用精確版本（不加 `^`）
- Build 需要 15-20 分鐘，CLI 超時不影響雲端 build，用 `eas build:list --limit 1` 查狀態
