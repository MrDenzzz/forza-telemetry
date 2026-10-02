/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'protocol',
        'contracts',
        'recording',
        'api',
        'web',
        'mobile',
        'recorder',
        'replayer',
        'config',
        'ci',
        'deps',
        'docs',
        'infra',
        'repo',
      ],
    ],
  },
};
