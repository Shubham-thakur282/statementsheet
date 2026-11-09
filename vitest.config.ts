import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: import.meta.dirname,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
  },
});
