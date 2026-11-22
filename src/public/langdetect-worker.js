const supported = new Set([
  "json",
  "py",
  "html",
  "sql",
  "md",
  "java",
  "php",
  "css",
  "xml",
  "cpp",
  "rs",
  "cs",
  "rb",
  "sh",
  "yaml",
  "toml",
  "go",
  "clj",
  "erl",
  "js",
  "ts",
  "swift",
  "kt",
  "groovy",
  "ps1",
  "dart",
  "scala",
  "lua",
]);

let model;

async function guess(content) {
  const text = content.trim();
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const value = JSON.parse(text);
      if (value && typeof value === "object") return { language: "json", confidence: 1 };
    } catch {
      // Incomplete JSON can still be recognized by the model.
    }
  }

  if (!text) return null;
  if (!model) {
    importScripts("./guesslang.min.js");
    model = new self.GuessLang();
  }
  const predictions = await model.runModel(content);
  // The leading prediction needs 15% confidence; alternatives need a majority.
  const match = predictions.find(
    ({ languageId, confidence }, index) => supported.has(languageId) && confidence > (index === 0 ? 0.15 : 0.5),
  );
  return match ? { language: match.languageId, confidence: match.confidence } : null;
}

self.onmessage = async ({ data: { content, idx } }) => {
  let guesslang = null;
  try {
    guesslang = await guess(content);
  } catch {
    // Reply even when the model is unavailable, so the editor can retire the request.
  }
  self.postMessage({ content, idx, guesslang });
};
