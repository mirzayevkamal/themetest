import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.tsx'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // twilight-components-react ships ESM with extensionless imports and no
    // "type": "module" — bundlers resolve it, node's loader doesn't. The engine
    // has to be inlined too, or it loads that package as an externalised
    // subtree and node resolves it after all.
    server: { deps: { inline: [/@salla\.sa/] } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: ['app/**/*.d.ts'],
    },
    reporters: ['default', 'json'],
    outputFile: './coverage/test-results.json',
  },
});
