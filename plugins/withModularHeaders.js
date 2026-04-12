const { withPodfile } = require('@expo/config-plugins');

/**
 * 1. 強制 Firebase iOS SDK 10.29.0
 * 2. 為 Firebase Swift pods 的 ObjC 依賴啟用 modular headers
 *
 * 只列出 pod install 錯誤訊息中要求的 pods。
 * 這些是 Firebase 的子依賴，版本由 $FirebaseSDKVersion 控制，不會衝突。
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const sdkMarker = '# [withFirebaseSDK]';
    if (!config.modResults.contents.includes(sdkMarker)) {
      config.modResults.contents =
        `${sdkMarker}\n$FirebaseSDKVersion = '10.29.0'\n\n` +
        config.modResults.contents;
    }

    // 只列出 pod install 錯誤中要求 modular headers 的 pods
    const pods = [
      'GoogleUtilities',
      'FirebaseCore',
      'FirebaseCoreExtension',
      'FirebaseFirestoreInternal',
      'FirebaseAppCheckInterop',
      'FirebaseAuthInterop',
      'FirebaseMessagingInterop',
    ];

    const podLines = pods
      .map(p => `    pod '${p}', :modular_headers => true`)
      .join('\n');

    const podMarker = '# [withModularHeaders]';
    if (!config.modResults.contents.includes(podMarker)) {
      config.modResults.contents = config.modResults.contents.replace(
        /use_react_native!\(([^)]*)\)/,
        `use_react_native!($1)\n\n    ${podMarker}\n${podLines}`
      );
    }

    return config;
  });
};
