/**
 * react-native-worklets runs its JavaScript implementation in tests by resolving its files
 * without `.native` extensions. Its own Jest resolver does that for every path that mentions the
 * package, and pnpm names directories after peer dependencies
 * (`.pnpm/expo@57…__react-native-worklets@0.10…`), so on Linux, where those names are not
 * shortened as on Windows, it also gave Expo its web runtime. This applies it to the package only.
 *
 * @type {import('jest-resolve').SyncResolver}
 */
module.exports = (request, options) => {
  const inWorklets =
    /[\\/]node_modules[\\/]react-native-worklets[\\/]/.test(options.basedir) ||
    request === 'react-native-worklets' ||
    request.startsWith('react-native-worklets/');
  return options.defaultResolver(
    request,
    inWorklets
      ? { ...options, extensions: options.extensions?.filter((ext) => !ext.includes('native')) }
      : options,
  );
};
