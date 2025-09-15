import { defineConfig } from 'tsx/config';

export default defineConfig({
  format: 'esm',
  target: 'node20',
  allowTopLevelAwait: true,
  platform: 'node',
  external: ['yoga-layout-prebuilt']
});