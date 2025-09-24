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

export const kProviderOpenAI = 0;
export const kProviderAnthropic = 1;
export const kProviderGoogle = 2;
export const kProviderMetaLlama = 3;
export const kProviderQwen = 4;
export const kProviderXAI = 5;
export const kProviderDeepSeek = 6;
export const kProviderPerplexity = 7;
export const kProviderMoonshotAI = 8;
export const kProviderMistralAI = 9;

export const providersInfo = [
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["google", "Google"],
  ["meta-llama", "Meta Llama"],
  ["qwen", "Qwen"],
  ["x-ai", "xAI"],
  ["deepseek", "DeepSeek"],
  ["perplexity", "Perplexity"],
  ["moonshotai", "Moonshot AI"], // kimi
  ["mistralai", "Mistral AI"],
];

const whitelistedProviders = providersInfo.map((p) => p[0]);

const modelsFilePath = "./data/open_router_models.json";

async function downloadModelsJSON(force = false) {
  if (force && fs.existsSync(modelsFilePath)) {
    fs.unlinkSync(modelsFilePath);
  }
  const url = "https://openrouter.ai/api/v1/models";
  const options = { method: "GET" };
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    await Bun.write(modelsFilePath, JSON.stringify(data, null, 2));
    console.log(
      `Downloaded models JSON from https://api.openrouter.ai/v1/models to ${modelsFilePath}`,
    );
  } catch (error) {
    console.error(error);
  }
}

function parseModelsJSON() {
  let s = fs.readFileSync(modelsFilePath, "utf8");
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

function findProviderID(id) {
  for (let i = 0; i < providersInfo.length; i++) {
    if (id.startsWith(providersInfo[i][0])) {
      return i;
    }
  }
  return -1; // Not found
}

/**
 * @param {string} id
 * @returns {string}
 */
function shortenModelID(id) {
  // e.g. "openai/gpt-4o" -> "gpt-4o"
  const parts = id.split("/");
  if (parts.length < 2) {
    throw new Error(`Invalid model ID format: ${id}`);
  }
  return parts[1]; // Return the second part (the model name)
}

/**
 * @param {string} name
 * @returns {string}
 */
function shortenModelName(name) {
  // e.g. "Google: Gemini 1.5 Pro" -> "Gemini 1.5 Pro"
  const parts = name.split(": ");
  if (parts.length < 2) {
    return name;
  }
  return parts[1];
}

function genShort(models) {
  // convert to flat array
  let a = [];
  for (let m of models) {
    let id = m.id;
    let providerID = findProviderID(id);
    if (providerID < 0) {
      throw new Error(`Unknown provider for model ${id}`);
    }
    let name = m.name;
    let pricePrompt = m.price_prompt;
    let priceCompletion = m.price_completion;

    id = shortenModelID(id);
    name = shortenModelName(name);
    a.push([id, providerID, name, pricePrompt, priceCompletion]);
  }
  let js = JSON.stringify(a, null, 2);
  let fpath = "./src/models-short.js";
  let s = `
export const kProviderOpenAI = 0;
export const kProviderAnthropic = 1;
export const kProviderGoogle = 2;
export const kProviderMetaLlama = 3;
export const kProviderQwen = 4;
export const kProviderXAI = 5;
export const kProviderDeepSeek = 6;
export const kProviderPerplexity = 7;
export const kProviderMoonshotAI = 8;
export const kProviderMistralAI = 9;

export const providersInfo = [
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["google", "Google"],
  ["meta-llama", "Meta Llama"],
  ["qwen", "Qwen"],
  ["x-ai", "xAI"],
  ["deepseek", "DeepSeek"],
  ["perplexity", "Perplexity"],
  ["moonshotai", "Moonshot AI"], // kimi
  ["mistralai", "Mistral AI"],
];

export const kModelIDIdx = 0;
export const kModelProviderIdx = 1;
export const kModelNameIdx = 2;
export const kModelPricePromptIdx = 3;
export const kModelPriceCompletionIdx = 4;

export const modelsShort = ${js};\n`;
  fs.writeFileSync(fpath, s);
  console.log("Wrote " + fpath + " with " + a.length + " models");
}

async function doit() {
  await downloadModelsJSON(true);
  let models = parseModelsJSON();
  console.log("\n");
  printSummary(models);
  genShort(models);
}

doit();
