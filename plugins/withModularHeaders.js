const { withPodfile } = require('@expo/config-plugins');

/**
 * 修復 Firebase Swift pods 的 header 問題。
 *
 * 使用 use_frameworks! :linkage => :static 讓所有 pods 以 framework
 * 方式建構（Swift headers 會正確生成），但保持 static linkage。
 * 這是 @react-native-firebase 官方推薦的 Expo 設定。
 *
 * 參考：https://github.com/invertase/react-native-firebase/issues/8657
 *       https://rnfirebase.io/#expo-installation
 */
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents;

    const marker = '# [withModularHeaders:use_frameworks]';

    if (!podfile.includes(marker)) {
      // 在 use_expo_modules! 之後插入 use_frameworks!
      config.modResults.contents = podfile.replace(
        /use_expo_modules!\s*!?\(?.*\)?/,
        `$&\n\n  ${marker}\n  use_frameworks! :linkage => :static`
      );
    }

    // 在 post_install 中對每個 target 設定 CLANG flag
    const postInstallMarker = '# [withModularHeaders:post_install]';
    if (!config.modResults.contents.includes(postInstallMarker)) {
      const postInstallSnippet = `
    ${postInstallMarker}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings["CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES"] = "YES"
      end
    end`;

      config.modResults.contents = config.modResults.contents.replace(
        /post_install do \|installer\|/,
        `post_install do |installer|${postInstallSnippet}`
      );
    }

    return config;
  });
};
