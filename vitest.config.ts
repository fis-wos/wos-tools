import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@wos-tools/data': path.resolve(__dirname, 'packages/data/src'),
      '@wos-tools/core': path.resolve(__dirname, 'packages/core/src'),
    },
  },
  test: {
    globals: true,
    include: [
      'packages/**/src/__tests__/**/*.test.ts',
      'apps/**/src/__tests__/**/*.test.ts',
    ],
  },
});
