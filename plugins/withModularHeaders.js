const { withPodfile } = require('@expo/config-plugins');

/**
 * 為 Firebase pods 的 ObjC 依賴啟用 modular_headers。
 * @react-native-firebase v21 不需要 use_frameworks，
 * 只需要個別 pod 的 modular headers。
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
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
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents = config.modResults.contents.replace(
        /use_react_native!\(([^)]*)\)/,
        `use_react_native!($1)\n\n    ${marker}\n${podLines}`
      );
    }

    return config;
  });
};
