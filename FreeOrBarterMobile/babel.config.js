module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Prefer new plugin; fall back for environments without react-native-worklets installed
      (() => {
        try {
          return require.resolve('react-native-worklets/plugin');
        } catch (_) {
          return 'react-native-reanimated/plugin';
        }
      })(),
    ],
  };
};
