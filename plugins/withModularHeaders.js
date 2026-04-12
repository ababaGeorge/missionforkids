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
    end`;

      config.modResults.contents = config.modResults.contents.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${snippet}`
      );
    }

    return config;
  });
};
