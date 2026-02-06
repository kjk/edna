// import path from "node:path";
// import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte()],
  // resolve: {
  //   alias: {
  //     "@": path.resolve(path.dirname(fileURLToPath(import.meta.url))),
  //   },
  // },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.spec.ts", "tests/browser/**"],
  },
});
