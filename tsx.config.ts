import { defineConfig } from 'tsx/config';

export default defineConfig({
  format: 'esm',
  target: 'node20',
  platform: 'node',
  // Remove allowTopLevelAwait to prevent issues
  // Use yoga-layout-prebuilt instead of yoga-wasm-web
  alias: {
    'yoga-wasm-web': 'yoga-layout-prebuilt'
  },
  external: ['yoga-layout-prebuilt'],
  esbuild: {
    format: 'esm',
    platform: 'node',
    target: 'node20',
    alias: {
      'yoga-wasm-web': 'yoga-layout-prebuilt'
    },
    external: ['yoga-layout-prebuilt']
  }
});