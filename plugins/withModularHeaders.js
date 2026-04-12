const { withPodfile } = require('@expo/config-plugins');

/**
 * 為 Firebase Swift pods 的 ObjC 依賴啟用 modular_headers。
 *
 * 策略：在 target block 內加入顯式的 pod 宣告 with :modular_headers => true。
 * 這些 pods 已經被 auto-linking 安裝，這裡只是覆蓋設定。
 *
 * 不能用：
 * - 全域 use_modular_headers!（gRPC-Core modulemap 找不到）
 * - pre_install 改 build_type（CocoaPods 不支援這種方式）
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents;

    // 要啟用 modular headers 的 pods
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
    ];

    const podLines = pods
      .map(p => `    pod '${p}', :modular_headers => true`)
      .join('\n');

    const marker = '# [withModularHeaders]';

    if (!podfile.includes(marker)) {
      // 在 use_react_native! 之後插入
      config.modResults.contents = podfile.replace(
        /use_react_native!\(([^)]*)\)/,
        `use_react_native!($1)\n\n    ${marker}\n${podLines}`
      );
    }

    return config;
  });
};
