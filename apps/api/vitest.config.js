import { node } from '@ft/vitest-config';
import swc from 'unplugin-swc';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(node, {
  // Nest resolves providers from emitted decorator metadata, which Vite's own transform omits.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
