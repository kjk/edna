import * as child from "child_process";
import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: "./public",

  plugins: [svelte(), tailwindcss()],

  build: {
    outDir: "../dist",
    // target: "esnext", // needed for top-level await
    // this prevents pre-laoding manual chunks
    modulePreload: {
      resolveDependencies: (url, deps, context) => {
        return [];
      },
    },
    minify: "terser",
    terserOptions: {
      mangle: {
        keep_fnames: true,
        keep_classnames: true,
      },
      compress: {
        keep_fnames: true,
        keep_classnames: true,
      },
    },
    rollupOptions: {
      output: {
        // Preserve function names in the output
        minifyInternalExports: false,
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
    // must be same as proxyURLStr in server.go
    port: 3035,
  },
});
