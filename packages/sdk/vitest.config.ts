import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      // libsodium-wrappers ESM build is broken (missing internal .mjs file)
      'libsodium-wrappers': require.resolve('libsodium-wrappers'),
    },
  },
});
