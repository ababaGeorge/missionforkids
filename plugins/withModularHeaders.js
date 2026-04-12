const { withPodfile } = require('@expo/config-plugins');

/**
 * 修復 Firebase + React Native Firebase 的 modular header 問題。
 *
 * 不使用 use_frameworks!（會導致 RNFB ObjC 程式碼編譯失敗）。
 * 改用：
 * 1. 個別 pod 的 :modular_headers => true
 * 2. post_install 中設定 CLANG flag + HEADER_SEARCH_PATHS
 *
 * 參考：https://github.com/invertase/react-native-firebase/issues/8271
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
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

    // ---- post_install: CLANG flag + Swift header search paths ----
    const postMarker = '# [withModularHeaders:post_install]';
    if (!config.modResults.contents.includes(postMarker)) {
      const snippet = `
    ${postMarker}
    # Allow non-modular includes and add Swift header search paths for RNFB
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
        # Add derived sources paths so RNFB can find Firebase Swift headers
        existing = bc.build_settings["HEADER_SEARCH_PATHS"] || "$(inherited)"
        unless existing.include?("Firebase")
          bc.build_settings["HEADER_SEARCH_PATHS"] = existing + ' "$(PODS_ROOT)/Headers/Public" "$(PODS_ROOT)/Headers/Public/FirebaseAuth" "$(PODS_ROOT)/Headers/Public/FirebaseStorage"'
        end
      end
    end`;

      config.modResults.contents = config.modResults.contents.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${snippet}`
      );
    }

    return config;
  });
};
