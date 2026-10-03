/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Picks the JavaScript implementation of worklets instead of the native one.
  resolver: '<rootDir>/test/jest-resolver.js',
  setupFiles: ['<rootDir>/test/setup.ts'],
  // Failures become annotations on the pull request, as Vitest's do in the other packages.
  reporters: process.env.GITHUB_ACTIONS ? ['default', 'github-actions'] : ['default'],
  // pnpm keeps packages under node_modules/.pnpm, and React Native ones ship untranspiled.
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@shopify/react-native-skia))',
  ],
  testEnvironmentOptions: { customExportConditions: ['require', 'react-native', '@ft/source'] },
  moduleNameMapper: {
    // Skia draws through a native module; see test/skia-mock.ts.
    '^@shopify/react-native-skia$': '<rootDir>/test/skia-mock.ts',
    // Metro gives every package the app's React; Jest has to be told. Workspace libraries that
    // develop against another React version would otherwise load a second copy.
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
  },
};
