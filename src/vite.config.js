import * as child from "child_process";

import { defineConfig } from "vite";
import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: "../public",

  plugins: [svelte(), tailwindcss()],

  build: {
    // target: "esnext", // needed for top-level await
    // this prevents pre-laoding manual chunks
    modulePreload: {
      resolveDependencies: (url, deps, context) => {
        return [];
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          prettier: [
            "prettier",
            "prettier/standalone",
            "prettier/plugins/estree.mjs",
            "prettier/plugins/babel.mjs",
            "prettier/plugins/postcss.mjs",
            "prettier/plugins/html.mjs",
            "prettier/plugins/markdown.mjs",
            "prettier/plugins/typescript.mjs",
            "prettier/plugins/yaml.mjs",
          ],
          langjavascript: ["@codemirror/lang-javascript"],
          langcpp: ["@codemirror/lang-cpp"],
          langphp: ["@codemirror/lang-php"],
          langrust: ["@codemirror/lang-rust"],
          langlegacy: [
            "@codemirror/legacy-modes/mode/clojure",
            "@codemirror/legacy-modes/mode/diff",
            "@codemirror/legacy-modes/mode/erlang",
            "@codemirror/legacy-modes/mode/go",
            "@codemirror/legacy-modes/mode/groovy",
            "@codemirror/legacy-modes/mode/clike",
            "@codemirror/legacy-modes/mode/powershell",
            "@codemirror/legacy-modes/mode/ruby",
            "@codemirror/legacy-modes/mode/shell",
            "@codemirror/legacy-modes/mode/swift",
            "@codemirror/legacy-modes/mode/toml",
            "@codemirror/legacy-modes/mode/yaml",
            // "@codemirror/legacy-modes/mode/lua",
            // "@codemirror/legacy-modes/mode/octave",
          ],
          zipjs: ["@zip.js/zip.js"],
        },
      },
    },
  },

  resolve: { alias: { "@": path.resolve(__dirname, "..") } },

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __GIT_HASH__: JSON.stringify(
      child.execSync("git rev-parse --short HEAD").toString().trim(),
    ),
  },

  server: {
    // must be same as proxyURLStr in runServerDev
    port: 3035,
  },
});
