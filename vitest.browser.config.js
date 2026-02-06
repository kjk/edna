import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    include: ["tests/browser/**/*.test.ts"],
    exclude: ["tests/**/*.spec.ts"],
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
