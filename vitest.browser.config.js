import { svelte } from "@sveltejs/vite-plugin-svelte";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  publicDir: "./src/public",
  test: {
    include: ["tests/browser/**/*.test.ts"],
    // test files share localStorage, IndexedDB and the Origin Private File System
    fileParallelism: false,
    browser: {
      enabled: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
      provider: playwright({
        launch: {
          headless: true,
        },
      }),
    },
  },
});
