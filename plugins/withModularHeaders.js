const { withPodfile } = require('@expo/config-plugins');

/**
 * 設定 $RNFirebaseAsStaticFramework = true
 * 搭配 expo-build-properties 的 useFrameworks: "static" + forceStaticLinking
 */
module.exports = function withRNFirebaseStaticFramework(config) {
  return withPodfile(config, (config) => {
    const line = '$RNFirebaseAsStaticFramework = true';
    if (!config.modResults.contents.includes(line)) {
      config.modResults.contents = `${line}\n${config.modResults.contents}`;
    }
    return config;
  });
};
