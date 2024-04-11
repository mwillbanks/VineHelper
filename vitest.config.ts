import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: './vitest.env.ts',
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      interopDefault: true,
    },
  },
});
