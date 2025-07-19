import * as child from "child_process";
import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * @param {string} id
 */
function manualChunks(id) {
  // pack all .css files in the same chunk
  if (id.endsWith(".css")) {
    return;
  }

  if (false && id.includes("/highlight.js/")) {
    console.log(id);
  }

  const chunksDef = [
    ["/@zip.js/zip.js", "zipjs"],
    ["/prettier/", "prettier"],

    // ["/@codemirror/legacy-modes/", "langlegacy"],
    // ["/@codemirror/lang-rust/", "langrust"],
    // ["/@codemirror/lang-php/", "langphp"],
    // ["/@codemirror/lang-cpp/", "langcpp"],

    // ["/@codemirror/lang-javascript/", "langjavascript"],
    // ["/@codemirror/lang-css/", "langcss"],
    // ["/@codemirror/lang-html/", "langhtml"],
    // ["/@replit/codemirror-lang-svelte/", "langsvelte"],

    // [
    //   "/@codemirror/lang-javascript/",
    //   "/@codemirror/lang-css/",
    //   "/@codemirror/lang-html/",
    //   "/@codemirror/lang-vue/",
    //   "/@replit/codemirror-lang-svelte/",
    //   "langweb",
    // ],

    // ["@codemirror/lang-python", "langpython"],
    // ["@codemirror/lang-java", "langjava"],
    // ["@codemirror/lang-vue", "langvue"],
    // ["@codemirror/lang-xml", "langxml"],

    // ["@codemirror/lang-lezer", "langlezer"],
    // ["@codemirror/lang-sql", "langsql"],
    // ["/@codemirror/lang-json/", "langjson"],
    // ["/@replit/codemirror-lang-csharp/", "langcsharp"],

    // markdown-it and highlight.js are used together in askai.svelte
    [
      "/markdown-it/",
      "/entities/",
      "/linkify-it/",
      "/mdurl/",
      "/punycode.js/",
      "/uc.micro/",
      "/markdown-it-anchor/",
      "/highlight.js/",

      "markdownit-hljs",
    ],
  ];

  for (let def of chunksDef) {
    let n = def.length;
    for (let i = 0; i < n - 1; i++) {
      if (id.includes(def[i])) {
        return def[n - 1];
      }
    }
  }
  const noLogList = [
    "elaris/src",
    "/svelte/src/",
    "debounce",
    "/@codemirror/autocomplete/",
    "/@codemirror/lang-html/",
    "/@codemirror/lang-markdown/",
    "/@codemirror/autocomplete/",
    "@codemirror/search/",
    "/@codemirror/commands/",
    "/@codemirror/language/",
    "/@codemirror/lang-java/",
    "/@codemirror/lang-json/",
    "/@codemirror/lang-lezer/",
    "/@codemirror/lang-php/",
    "/@codemirror/lang-rust/",
    "/@codemirror/lang-xml/",
    "/@codemirror/state/",
    "/@codemirror/view/",
    "/@codemirror/language/",
    "/esm-env/",
    "/clsx/",
    "/@marijn/find-cluster-break/",
    "/overlayscrollbars/",
    "/style-mod/",
    "/crelt/",
    "/w3c-keyname/",
    "vite/modulepreload-polyfill.js",
    "__vite-browser-external",
    "vite/preload-helper.js",
    // "commonjsHelpers.js",
    "/@lezer/",
  ];

  // this is a hack to put getDefaultExportFromCjs function in main index chunk
  // otehrwise it somehow ended up in highlighjs chunk, was imported by main
  // chunk causing eagarly loading highlightjs
  // https://github.com/vitejs/vite/issues/17823
  // https://github.com/vitejs/vite/issues/19758
  // https://github.com/vitejs/vite/issues/5189
  const ROLLUP_COMMON_MODULES = [
    "vite/preload-helper",
    "vite/modulepreload-polyfill",
    "vite/dynamic-import-helper",
    "commonjsHelpers",
    "commonjs-dynamic-modules",
    "__vite-browser-external",
  ];

  // bundle all other 3rd-party modules into a single vendor.js module
  if (
    id.includes("/node_modules/") ||
    ROLLUP_COMMON_MODULES.some((commonModule) => id.includes(commonModule))
  ) {
    return "vendor";
  }

  function logMaybe() {
    for (let s of noLogList) {
      if (id.includes(s)) {
        return;
      }
    }
    console.log(id);
  }
  logMaybe();
  // all other files are project source files and are allowed to be split whichever way rollup wants
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
        manualChunks: manualChunks,
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
