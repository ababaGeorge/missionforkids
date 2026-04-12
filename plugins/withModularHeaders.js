const { withPodfile } = require('@expo/config-plugins');

/**
 * 1. 強制 Firebase iOS SDK 10.29.0
 * 2. 為 Firebase Swift pods 的 ObjC 依賴啟用 modular headers
 * 3. 修復 gRPC/abseil C++ 編譯問題（std::result_of 在 C++17 被移除）
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    // ---- 1. 強制 Firebase iOS SDK 版本 ----
    const sdkMarker = '# [withFirebaseSDK]';
    if (!config.modResults.contents.includes(sdkMarker)) {
      config.modResults.contents =
        `${sdkMarker}\n$FirebaseSDKVersion = '10.29.0'\n\n` +
        config.modResults.contents;
    }

    // ---- 2. modular headers ----
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

    // ---- 3. post_install: gRPC C++14 fix (AFTER react_native_post_install) ----
    const postMarker = '# [withModularHeaders:post_install]';
    if (!config.modResults.contents.includes(postMarker)) {
      const snippet = `\n    ${postMarker}
    # Fix gRPC/abseil std::result_of removal in C++17
    installer.pods_project.build_configurations.each do |bc|
      bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++14'
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++14'
      end
    end`;

      // Insert AFTER react_native_post_install(...) call
      config.modResults.contents = config.modResults.contents.replace(
        /(react_native_post_install\([\s\S]*?\n\s*\))/,
        `$1${snippet}`
      );
    }

    return config;
  });
};
