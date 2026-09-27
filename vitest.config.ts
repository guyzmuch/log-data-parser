import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/core/**/*.test.ts"],
    environment: "node",
    // Cap worker processes so a full run doesn't spike CPU/memory (each
    // worker spawns its own isolated environment) — the suite is small and
    // fast enough that this costs little wall-clock time.
    maxWorkers: 4,
  },
});
