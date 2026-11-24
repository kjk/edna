import * as child from "child_process";
import * as fs from "fs";
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

// dist/ is emptied before each build but dist/gitkeep.txt must exist because
// it's checked into git (go:embed dist/* fails if dist/ is empty)
function keepDistGitkeep() {
  return {
    name: "keep-dist-gitkeep",
    apply: "build",
    closeBundle() {
      fs.writeFileSync("./dist/gitkeep.txt", "don't delete this folder\n");
    },
  };
}

// writes the version and the list of files to pre-cache into dist/sw.js, the
// service worker that makes Edna work offline (#16). Source maps and images
// only used by the help page aren't pre-cached
function precacheServiceWorker() {
  return {
    name: "precache-service-worker",
    apply: "build",
    closeBundle() {
      const skip = (f) =>
        f.endsWith(".map") ||
        f === "index.html" ||
        f === "sw.js" ||
        f === "gitkeep.txt" ||
        /^(help-|pwa-shot-).*\.png$/.test(f);
      const files = fs
        .readdirSync("./dist", { recursive: true })
        .map((f) => String(f).replaceAll("\\", "/"))
        .filter((f) => fs.statSync("./dist/" + f).isFile() && !skip(f))
        .sort()
        .map((f) => "/" + f);
      const version = child.execSync("git rev-parse --short HEAD").toString().trim() + "-" + Date.now();
      let s = fs.readFileSync("./dist/sw.js", "utf-8");
      const n = s.length;
      s = s.replace('"dev"; /*__VERSION__*/', JSON.stringify(version) + ";");
      s = s.replace("[] /*__PRECACHE__*/", JSON.stringify(files));
      if (s.length === n || s.includes("__PRECACHE__") || s.includes("__VERSION__")) {
        throw new Error("precacheServiceWorker: placeholders not found in dist/sw.js");
      }
      fs.writeFileSync("./dist/sw.js", s);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: "./src/public",

  plugins: [svelte(), tailwindcss(), keepDistGitkeep(), precacheServiceWorker()],

  build: {
    outDir: "./dist",
    // target: "esnext", // needed for top-level await
    // this prevents pre-laoding manual chunks
    modulePreload: {
      resolveDependencies: (url, deps, context) => {
        return [];
      },
    },
    emptyOutDir: true,
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

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __GIT_HASH__: JSON.stringify(child.execSync("git rev-parse --short HEAD").toString().trim()),
  },

  server: {
    // must be same as proxyURLStr in runServerDev
    port: 3035,
  },
});
