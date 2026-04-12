const { withPodfile } = require('@expo/config-plugins');

/**
 * 為 Firebase Swift pods 的 ObjC 依賴啟用 modular_headers，
 * 搭配 expo-build-properties 的 useFrameworks: "static"。
 *
 * 參考：https://rnfirebase.io/#expo-installation
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

    // ---- post_install CLANG flag ----
    const postMarker = '# [withModularHeaders:post_install]';
    if (!config.modResults.contents.includes(postMarker)) {
      const snippet = `
    ${postMarker}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
      end
      # gRPC pods 的 C 程式碼在 framework 模式下需要寬鬆的 C 語言設定
      if ['gRPC-Core', 'gRPC-C++', 'abseil', 'BoringSSL-GRPC'].include?(target.name)
        target.build_configurations.each do |bc|
          bc.build_settings["GCC_C_LANGUAGE_STANDARD"] = "gnu11"
          bc.build_settings["CLANG_CXX_LANGUAGE_STANDARD"] = "gnu++17"
          bc.build_settings["GCC_WARN_INHIBIT_ALL_WARNINGS"] = "YES"
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
