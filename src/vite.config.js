import * as child from "child_process";
import path from "path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

/**
 * @param {string} id
 */
function manualChunks(id) {
  const chunksDef = [
    ["/@zip.js/zip.js", "zipjs"],
    ["/prettier/", "prettier"],

    ["/@codemirror/legacy-modes/", "langlegacy"],
    // ["/@codemirror/lang-rust/", "langrust"],
    // ["/@codemirror/lang-php/", "langphp"],
    ["/@codemirror/lang-cpp/", "langcpp"],

    // ["/@codemirror/lang-javascript/", "langjavascript"],
    // ["/@codemirror/lang-css/", "langcss"],
    // ["/@codemirror/lang-html/", "langhtml"],
    // ["/@replit/codemirror-lang-svelte/", "langsvelte"],

    [
      "/@codemirror/lang-javascript/",
      "/@codemirror/lang-css/",
      "/@codemirror/lang-html/",
      "/@codemirror/lang-vue/",
      "/@replit/codemirror-lang-svelte/",
      "langweb",
    ],

    ["@codemirror/lang-python", "langpython"],
    // ["@codemirror/lang-java", "langjava"],
    // ["@codemirror/lang-vue", "langvue"],
    // ["@codemirror/lang-xml", "langxml"],

    // ["@codemirror/lang-lezer", "langlezer"],
    ["@codemirror/lang-sql", "langsql"],
    // ["/@codemirror/lang-json/", "langjson"],
    ["/@replit/codemirror-lang-csharp/", "langcsharp"],

    [
      "/markdown-it/",
      "/entities/",
      "/linkify-it/",
      "/mdurl/",
      "/punycode.js/",
      "/uc.micro/",
      "/markdown-it-anchor/",
      "markdownit",
    ],
    ["/highlight.js/", "highlightjs"],
    // ["/@lezer/", "lezer"],
  ];

  // for highlight.js, don't create a chunk for one .css file
  if (id.endsWith(".css")) {
    return null;
  }

  for (let def of chunksDef) {
    let n = def.length;
    for (let i = 0; i < n - 1; i++) {
      if (id.includes(def[i])) {
        return def[n - 1];
      }
    }
  }
  const noLog = [
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
    "commonjsHelpers.js",
    "/@lezer/",
  ];
  for (let s of noLog) {
    if (id.includes(s)) {
      return null;
    }
  }
  console.log(id);
  return null;
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
