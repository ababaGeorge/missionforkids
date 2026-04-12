const { withPodfile } = require('@expo/config-plugins');

/**
 * RNFB v24 + Firebase 12 + Expo 54 修補：
 * 1. use_frameworks! :linkage => :static（via expo-build-properties）
 * 2. modular headers for Firebase ObjC dependencies
 * 3. $RNFirebaseAsStaticFramework = true
 * 4. post_install: suppress C++ warnings for gRPC compatibility
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    // ---- 1. $RNFirebaseAsStaticFramework at top ----
    const sdkMarker = '# [withFirebaseConfig]';
    if (!config.modResults.contents.includes(sdkMarker)) {
      config.modResults.contents =
        `${sdkMarker}\n$RNFirebaseAsStaticFramework = true\n\n` +
        config.modResults.contents;
    }

    // ---- 2. modular headers (pods from error messages) ----
    const pods = [
      'GoogleUtilities',
      'FirebaseCore',
      'FirebaseCoreExtension',
      'FirebaseCoreInternal',
      'FirebaseFirestoreInternal',
      'FirebaseAppCheckInterop',
      'FirebaseAuthInterop',
      'FirebaseMessagingInterop',
      'RecaptchaInterop',
      'FirebaseSharedSwift',
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

    // ---- 3. post_install: C++ fixes AFTER react_native_post_install ----
    const postMarker = '# [withModularHeaders:post_install]';
    if (!config.modResults.contents.includes(postMarker)) {
      const snippet = `\n    ${postMarker}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        bc.build_settings['OTHER_CPLUSPLUSFLAGS'] = '$(inherited) -Wno-missing-template-arg-list-after-template-kw -Wno-comma -Wno-shorten-64-to-32'
        bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

      config.modResults.contents = config.modResults.contents.replace(
        /(react_native_post_install\([\s\S]*?\n\s*\))/,
        `$1${snippet}`
      );
    }

    return config;
  });
};
