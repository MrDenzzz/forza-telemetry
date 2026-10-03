const { getDefaultConfig } = require('expo/metro-config');

// Expo finds the workspace root and the other packages by itself. Workspace libraries are read
// from their TypeScript sources, which their package exports offer under this condition.
const config = getDefaultConfig(__dirname);
config.resolver.unstable_conditionNames = ['@ft/source'];

module.exports = config;
