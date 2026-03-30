import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', '@supabase/supabase-js'],
  noExternal: ['@noble/curves', '@noble/hashes'],
});
