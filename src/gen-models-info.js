import fs from "node:fs";
import { humanPrice } from "./util";

function printSummary(models) {
  // Count frequency of each provider
  const providerCount = {};
  for (const model of models) {
    const [provider] = model.id.split("/");
    providerCount[provider] = (providerCount[provider] || 0) + 1;
  }

  // Convert to array and sort by count ascending
  const sortedProviders = Object.entries(providerCount).sort(
    (a, b) => a[1] - b[1],
  );

  // Print providers and their counts
  for (const [provider, count] of sortedProviders) {
    console.log(`${provider}: ${count}`);
  }
}

let whitelistedProviders = [
  // "openrouter",
  "openai",
  "anthropic",
  // "mistralai",
  // "cohere",
  "google",
  "qwen",
  "meta-llama",
  "x-ai",
  "deepseek",
  "perplexity",
];

function parseModelsJSON() {
  let fpath = "./src/open_router_models.json";
  let s = fs.readFileSync(fpath, "utf8");
  let json = JSON.parse(s);
  let models = json.data;
  console.log("Found " + models.length + " models");

  let res = [];
  for (let m of models) {
    const [provider] = m.id.split("/");
    if (false || !whitelistedProviders.includes(provider)) {
      console.log(`Skipping model ${m.id} from provider ${provider}`);
      continue;
    }
    let o = {
      id: m.id,
      // slug: m.slug,
      name: m.name,
      price_prompt: parseFloat(m.pricing.prompt),
      price_completion: parseFloat(m.pricing.completion),
    };
    res.push(o);
    console.log(
      `id: ${m.id}, name: ${m.name} ${humanPrice(m.pricing.prompt)} / ${humanPrice(m.pricing.completion)}`,
    );
  }
  return res;
}

function genShort(models) {
  // convert to flat array
  let a = [];
  for (let m of models) {
    let id = m.id;
    let name = m.name;
    let pricePrompt = m.price_prompt;
    let priceCompletion = m.price_completion;
    a.push([id, name, pricePrompt, priceCompletion]);
  }
  let js = JSON.stringify(a, null, 2);
  let fpath = "./src/models-short.js";
  let s = `
export const kModelIDIdx = 0;
export const kModelNameIdx = 1;
export const kModelPricePromptIdx = 2;
export const kModelPriceCompletionIdx = 3;

export const modelsShort = ${js};\n`;
  fs.writeFileSync(fpath, s);
  console.log("Wrote " + fpath + " with " + a.length + " models");
}

function doit() {
  let models = parseModelsJSON();
  console.log("\n");
  printSummary(models);
  genShort(models);
}

doit();
