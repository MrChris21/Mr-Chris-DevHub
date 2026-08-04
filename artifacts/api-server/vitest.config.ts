import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 15000,
    // Run test files sequentially to avoid DB contention
    pool: "forks",
    singleFork: true,
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
  },
});
