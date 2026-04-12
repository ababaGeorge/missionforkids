const { withPodfile } = require('@expo/config-plugins');

/**
 * 強制 Firebase iOS SDK 10.29.0（pure ObjC，無 Swift header 問題）。
 *
 * RNFB v21 預設用 Firebase 11（Swift），但 Expo 54 的 CocoaPods 設定
 * 無法處理 Swift headers。Firebase 10.29.0 是 pure ObjC，完全不需要
 * modular headers 或 use_frameworks 等 workaround。
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const marker = '# [withFirebaseSDK]';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents =
        `${marker}\n$FirebaseSDKVersion = '10.29.0'\n\n` +
        config.modResults.contents;
    }
    return config;
  });
};
