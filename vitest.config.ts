import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Pure .test.ts files stay on the fast 'node' environment; component
    // .test.tsx files opt into jsdom individually via a
    // `// @vitest-environment jsdom` docblock at the top of the file.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
