const { withAppDelegate } = require('@expo/config-plugins');

/**
 * 在 AppDelegate.swift 中加入 FirebaseApp.configure()。
 * RNFB v21 的自動注入在 Expo 54 的 Swift AppDelegate 上失敗，
 * 所以手動加入。
 */
module.exports = function withFirebaseAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes('FirebaseApp.configure()')) {
      return config;
    }

    // 在 didFinishLaunchingWithOptions 的 super.application 之前加入
    config.modResults.contents = contents.replace(
      'return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
      'FirebaseApp.configure()\n    return super.application(application, didFinishLaunchingWithOptions: launchOptions)'
    );

    return config;
  });
};
