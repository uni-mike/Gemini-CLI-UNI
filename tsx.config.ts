import { defineConfig } from 'tsx/config';

export default defineConfig({
  format: 'esm',
  target: 'node20',
  allowTopLevelAwait: true,
  platform: 'node',
  external: ['yoga-layout-prebuilt', 'yoga-wasm-web', 'ink', 'ink-gradient'],
  esbuild: {
    format: 'esm',
    platform: 'node',
    target: 'node20',
    external: ['yoga-wasm-web']
  }
});