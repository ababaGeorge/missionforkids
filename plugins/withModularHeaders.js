const { withPodfile } = require('@expo/config-plugins');

/**
 * 為 Firebase Swift pods 的 ObjC 依賴啟用 modular_headers，
 * 並設定 CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES
 * 讓 RNFBStorage/RNFBAuth 等 target 能找到 Firebase Swift headers。
 *
 * 參考：https://github.com/invertase/react-native-firebase/issues/8657
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
      'GTMSessionFetcher',
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

    // 在 post_install 中設定允許非 modular includes
    const postInstallMarker = '# [withModularHeaders:post_install]';
    if (!config.modResults.contents.includes(postInstallMarker)) {
      const postInstallSnippet = `
    ${postInstallMarker}
    installer.pods_project.build_configurations.each do |config|
      config.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
    end`;

      config.modResults.contents = config.modResults.contents.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${postInstallSnippet}`
      );
    }

    return config;
  });
};
