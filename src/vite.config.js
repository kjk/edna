import * as child from "child_process";
import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

function manualChunksFn(id) {
  const prettierModules = [
    "prettier",
    "prettier/standalone",
    "prettier/plugins/estree.mjs",
    "prettier/plugins/babel.mjs",
    "prettier/plugins/postcss.mjs",
    "prettier/plugins/html.mjs",
    "prettier/plugins/markdown.mjs",
    "prettier/plugins/typescript.mjs",
    "prettier/plugins/yaml.mjs",
  ];

  const langlegacyModules = [
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
  ];

  if (prettierModules.some((mod) => id.includes(mod))) {
    return "prettier";
  }
  if (id.includes("@codemirror/lang-javascript")) {
    return "langjavascript";
  }
  if (id.includes("@codemirror/lang-cpp")) {
    return "langcpp";
  }
  if (id.includes("@codemirror/lang-php")) {
    return "langphp";
  }
  if (id.includes("@codemirror/lang-rust")) {
    return "langrust";
  }
  if (langlegacyModules.some((mod) => id.includes(mod))) {
    return "langlegacy";
  }
  if (id.includes("@zip.js/zip.js")) {
    return "zipjs";
  }
}

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
    sourcemap: true,
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
    rolldownOptions: {
      output: {
        // Preserve function names in the output
        minifyInternalExports: false,
        manualChunks: manualChunksFn,
        // sourcemap: true,
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
