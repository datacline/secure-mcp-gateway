import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { smcp: 'bin/smcp.js' },
  format: ['esm', 'cjs'],
  target: 'node18',
  platform: 'node',
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  minify: false,
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
});
