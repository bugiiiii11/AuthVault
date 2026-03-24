import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      // libsodium-wrappers ESM build is broken -- force CJS entry
      'libsodium-wrappers': require.resolve('libsodium-wrappers'),
    },
  },
});
