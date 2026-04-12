const { withPodfile } = require('@expo/config-plugins');

/**
 * 1. 強制 Firebase iOS SDK 10.29.0（pure ObjC，無 Swift header 問題）
 * 2. 為 Firebase ObjC 依賴啟用 modular_headers
 *
 * RNFB v21 預設用 Firebase 11（Swift），但 Expo 54 的 CocoaPods 設定
 * 無法正確處理 Swift headers。強制降級到 10.29.0 可完全避免問題。
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    // ---- 強制 Firebase iOS SDK 10.29.0 ----
    const sdkMarker = '# [withModularHeaders:sdk]';
    if (!config.modResults.contents.includes(sdkMarker)) {
      config.modResults.contents =
        `${sdkMarker}\n$FirebaseSDKVersion = '10.29.0'\n\n` +
        config.modResults.contents;
    }

    // ---- 個別 pod modular headers ----
    const pods = [
      'GoogleUtilities',
      'FirebaseAuth',
      'FirebaseAuthInterop',
      'FirebaseAppCheckInterop',
      'FirebaseCore',
      'FirebaseCoreInternal',
      'FirebaseCoreExtension',
      'FirebaseFirestore',
      'FirebaseFirestoreInternal',
      'FirebaseSharedSwift',
      'FirebaseStorage',
      'RecaptchaInterop',
      'FirebaseMessagingInterop',
      'GTMSessionFetcher',
    ];

    const podLines = pods
      .map(p => `    pod '${p}', :modular_headers => true`)
      .join('\n');

    const podMarker = '# [withModularHeaders:pods]';
    if (!config.modResults.contents.includes(podMarker)) {
      config.modResults.contents = config.modResults.contents.replace(
        /use_react_native!\(([^)]*)\)/,
        `use_react_native!($1)\n\n    ${podMarker}\n${podLines}`
      );
    }

    return config;
  });
};
