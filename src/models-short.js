
export const kProviderOpenAI = 0;
export const kProviderAnthropic = 1;
export const kProviderGoogle = 2;
export const kProviderMetaLlama = 3;
export const kProviderQwen = 4;
export const kProviderXAI = 5;
export const kProviderDeepSeek = 6;
export const kProviderPerplexity = 7;
//export const kProviderCohere = 8;
//export const kProviderMistralAI = 9;

export const providersInfo = [
  ["openai", "OpenAI"],
  ["anthropic", "Anthropic"],
  ["google", "Google"],
  ["meta-llama", "Meta Llama"],
  ["qwen", "Qwen"],
  ["x-ai", "xAI"],
  ["deepseek", "DeepSeek"],
  ["perplexity", "Perplexity"],
  //  ["cohere", "Cohere"],
  //  ["mistralai", "Mistral AI"],
];

export const kModelIDIdx = 0;
export const kModelProviderIdx = 1;
export const kModelNameIdx = 2;
export const kModelPricePromptIdx = 3;
export const kModelPriceCompletionIdx = 4;

export const modelsShort = [
  [
    "gemini-2.5-flash-lite-preview-06-17",
    2,
    "Gemini 2.5 Flash Lite Preview 06-17",
    1e-7,
    4e-7
  ],
  [
    "gemini-2.5-flash",
    2,
    "Gemini 2.5 Flash",
    3e-7,
    0.0000025
  ],
  [
    "gemini-2.5-pro",
    2,
    "Gemini 2.5 Pro",
    0.00000125,
    0.00001
  ],
  [
    "o3-pro",
    0,
    "o3 Pro",
    0.00002,
    0.00008
  ],
  [
    "grok-3-mini",
    5,
    "Grok 3 Mini",
    3e-7,
    5e-7
  ],
  [
    "grok-3",
    5,
    "Grok 3",
    0.000003,
    0.000015
  ],
  [
    "gemini-2.5-pro-preview",
    2,
    "Gemini 2.5 Pro Preview 06-05",
    0.00000125,
    0.00001
  ],
  [
    "deepseek-r1-distill-qwen-7b",
    6,
    "R1 Distill Qwen 7B",
    1e-7,
    2e-7
  ],
  [
    "deepseek-r1-0528-qwen3-8b:free",
    6,
    "Deepseek R1 0528 Qwen3 8B (free)",
    0,
    0
  ],
  [
    "deepseek-r1-0528-qwen3-8b",
    6,
    "Deepseek R1 0528 Qwen3 8B",
    1e-8,
    2e-8
  ],
  [
    "deepseek-r1-0528:free",
    6,
    "R1 0528 (free)",
    0,
    0
  ],
  [
    "deepseek-r1-0528",
    6,
    "R1 0528",
    5e-7,
    0.00000215
  ],
  [
    "claude-opus-4",
    1,
    "Claude Opus 4",
    0.000015,
    0.000075
  ],
  [
    "claude-sonnet-4",
    1,
    "Claude Sonnet 4",
    0.000003,
    0.000015
  ],
  [
    "gemma-3n-e4b-it:free",
    2,
    "Gemma 3n 4B (free)",
    0,
    0
  ],
  [
    "gemma-3n-e4b-it",
    2,
    "Gemma 3n 4B",
    2e-8,
    4e-8
  ],
  [
    "gemini-2.5-flash-preview-05-20",
    2,
    "Gemini 2.5 Flash Preview 05-20",
    1.5e-7,
    6e-7
  ],
  [
    "gemini-2.5-flash-preview-05-20:thinking",
    2,
    "Gemini 2.5 Flash Preview 05-20 (thinking)",
    1.5e-7,
    0.0000035
  ],
  [
    "codex-mini",
    0,
    "Codex Mini",
    0.0000015,
    0.000006
  ],
  [
    "gemini-2.5-pro-preview-05-06",
    2,
    "Gemini 2.5 Pro Preview 05-06",
    0.00000125,
    0.00001
  ],
  [
    "deepseek-prover-v2",
    6,
    "DeepSeek Prover V2",
    5e-7,
    0.00000218
  ],
  [
    "llama-guard-4-12b",
    3,
    "Llama Guard 4 12B",
    5e-8,
    5e-8
  ],
  [
    "qwen3-30b-a3b:free",
    4,
    "Qwen3 30B A3B (free)",
    0,
    0
  ],
  [
    "qwen3-30b-a3b",
    4,
    "Qwen3 30B A3B",
    8e-8,
    2.9e-7
  ],
  [
    "qwen3-8b:free",
    4,
    "Qwen3 8B (free)",
    0,
    0
  ],
  [
    "qwen3-8b",
    4,
    "Qwen3 8B",
    3.5e-8,
    1.38e-7
  ],
  [
    "qwen3-14b:free",
    4,
    "Qwen3 14B (free)",
    0,
    0
  ],
  [
    "qwen3-14b",
    4,
    "Qwen3 14B",
    6e-8,
    2.4e-7
  ],
  [
    "qwen3-32b:free",
    4,
    "Qwen3 32B (free)",
    0,
    0
  ],
  [
    "qwen3-32b",
    4,
    "Qwen3 32B",
    1e-7,
    3e-7
  ],
  [
    "qwen3-235b-a22b:free",
    4,
    "Qwen3 235B A22B (free)",
    0,
    0
  ],
  [
    "qwen3-235b-a22b",
    4,
    "Qwen3 235B A22B",
    1.3e-7,
    6e-7
  ],
  [
    "gemini-2.5-flash-preview",
    2,
    "Gemini 2.5 Flash Preview 04-17",
    1.5e-7,
    6e-7
  ],
  [
    "gemini-2.5-flash-preview:thinking",
    2,
    "Gemini 2.5 Flash Preview 04-17 (thinking)",
    1.5e-7,
    0.0000035
  ],
  [
    "o4-mini-high",
    0,
    "o4 Mini High",
    0.0000011,
    0.0000044
  ],
  [
    "o3",
    0,
    "o3",
    0.000002,
    0.000008
  ],
  [
    "o4-mini",
    0,
    "o4 Mini",
    0.0000011,
    0.0000044
  ],
  [
    "gpt-4.1",
    0,
    "GPT-4.1",
    0.000002,
    0.000008
  ],
  [
    "gpt-4.1-mini",
    0,
    "GPT-4.1 Mini",
    4e-7,
    0.0000016
  ],
  [
    "gpt-4.1-nano",
    0,
    "GPT-4.1 Nano",
    1e-7,
    4e-7
  ],
  [
    "grok-3-mini-beta",
    5,
    "Grok 3 Mini Beta",
    3e-7,
    5e-7
  ],
  [
    "grok-3-beta",
    5,
    "Grok 3 Beta",
    0.000003,
    0.000015
  ],
  [
    "llama-4-maverick:free",
    3,
    "Llama 4 Maverick (free)",
    0,
    0
  ],
  [
    "llama-4-maverick",
    3,
    "Llama 4 Maverick",
    1.5e-7,
    6e-7
  ],
  [
    "llama-4-scout:free",
    3,
    "Llama 4 Scout (free)",
    0,
    0
  ],
  [
    "llama-4-scout",
    3,
    "Llama 4 Scout",
    8e-8,
    3e-7
  ],
  [
    "deepseek-v3-base:free",
    6,
    "DeepSeek V3 Base (free)",
    0,
    0
  ],
  [
    "gemini-2.5-pro-exp-03-25",
    2,
    "Gemini 2.5 Pro Experimental",
    0,
    0
  ],
  [
    "qwen2.5-vl-32b-instruct:free",
    4,
    "Qwen2.5 VL 32B Instruct (free)",
    0,
    0
  ],
  [
    "qwen2.5-vl-32b-instruct",
    4,
    "Qwen2.5 VL 32B Instruct",
    9e-7,
    9e-7
  ],
  [
    "deepseek-chat-v3-0324:free",
    6,
    "DeepSeek V3 0324 (free)",
    0,
    0
  ],
  [
    "deepseek-chat-v3-0324",
    6,
    "DeepSeek V3 0324",
    2.8e-7,
    8.8e-7
  ],
  [
    "o1-pro",
    0,
    "o1-pro",
    0.00015,
    0.0006
  ],
  [
    "gemma-3-4b-it:free",
    2,
    "Gemma 3 4B (free)",
    0,
    0
  ],
  [
    "gemma-3-4b-it",
    2,
    "Gemma 3 4B",
    2e-8,
    4e-8
  ],
  [
    "gemma-3-12b-it:free",
    2,
    "Gemma 3 12B (free)",
    0,
    0
  ],
  [
    "gemma-3-12b-it",
    2,
    "Gemma 3 12B",
    5e-8,
    1e-7
  ],
  [
    "gpt-4o-mini-search-preview",
    0,
    "GPT-4o-mini Search Preview",
    1.5e-7,
    6e-7
  ],
  [
    "gpt-4o-search-preview",
    0,
    "GPT-4o Search Preview",
    0.0000025,
    0.00001
  ],
  [
    "gemma-3-27b-it:free",
    2,
    "Gemma 3 27B (free)",
    0,
    0
  ],
  [
    "gemma-3-27b-it",
    2,
    "Gemma 3 27B",
    9e-8,
    1.7e-7
  ],
  [
    "sonar-reasoning-pro",
    7,
    "Sonar Reasoning Pro",
    0.000002,
    0.000008
  ],
  [
    "sonar-pro",
    7,
    "Sonar Pro",
    0.000003,
    0.000015
  ],
  [
    "sonar-deep-research",
    7,
    "Sonar Deep Research",
    0.000002,
    0.000008
  ],
  [
    "qwq-32b:free",
    4,
    "QwQ 32B (free)",
    0,
    0
  ],
  [
    "qwq-32b",
    4,
    "QwQ 32B",
    7.5e-8,
    1.5e-7
  ],
  [
    "gpt-4.5-preview",
    0,
    "GPT-4.5 (Preview)",
    0.000075,
    0.00015
  ],
  [
    "gemini-2.0-flash-lite-001",
    2,
    "Gemini 2.0 Flash Lite",
    7.5e-8,
    3e-7
  ],
  [
    "claude-3.7-sonnet",
    1,
    "Claude 3.7 Sonnet",
    0.000003,
    0.000015
  ],
  [
    "claude-3.7-sonnet:thinking",
    1,
    "Claude 3.7 Sonnet (thinking)",
    0.000003,
    0.000015
  ],
  [
    "claude-3.7-sonnet:beta",
    1,
    "Claude 3.7 Sonnet (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "r1-1776",
    7,
    "R1 1776",
    0.000002,
    0.000008
  ],
  [
    "llama-guard-3-8b",
    3,
    "Llama Guard 3 8B",
    2e-8,
    6e-8
  ],
  [
    "o3-mini-high",
    0,
    "o3 Mini High",
    0.0000011,
    0.0000044
  ],
  [
    "deepseek-r1-distill-llama-8b",
    6,
    "R1 Distill Llama 8B",
    4e-8,
    4e-8
  ],
  [
    "gemini-2.0-flash-001",
    2,
    "Gemini 2.0 Flash",
    1e-7,
    4e-7
  ],
  [
    "qwen-vl-plus",
    4,
    "Qwen VL Plus",
    2.1e-7,
    6.3e-7
  ],
  [
    "qwen-vl-max",
    4,
    "Qwen VL Max",
    8e-7,
    0.0000032
  ],
  [
    "qwen-turbo",
    4,
    "Qwen-Turbo",
    5e-8,
    2e-7
  ],
  [
    "qwen2.5-vl-72b-instruct:free",
    4,
    "Qwen2.5 VL 72B Instruct (free)",
    0,
    0
  ],
  [
    "qwen2.5-vl-72b-instruct",
    4,
    "Qwen2.5 VL 72B Instruct",
    2.5e-7,
    7.5e-7
  ],
  [
    "qwen-plus",
    4,
    "Qwen-Plus",
    4e-7,
    0.0000012
  ],
  [
    "qwen-max",
    4,
    "Qwen-Max ",
    0.0000016,
    0.0000064
  ],
  [
    "o3-mini",
    0,
    "o3 Mini",
    0.0000011,
    0.0000044
  ],
  [
    "deepseek-r1-distill-qwen-1.5b",
    6,
    "R1 Distill Qwen 1.5B",
    1.8e-7,
    1.8e-7
  ],
  [
    "deepseek-r1-distill-qwen-32b",
    6,
    "R1 Distill Qwen 32B",
    7.5e-8,
    1.5e-7
  ],
  [
    "deepseek-r1-distill-qwen-14b:free",
    6,
    "R1 Distill Qwen 14B (free)",
    0,
    0
  ],
  [
    "deepseek-r1-distill-qwen-14b",
    6,
    "R1 Distill Qwen 14B",
    1.5e-7,
    1.5e-7
  ],
  [
    "sonar-reasoning",
    7,
    "Sonar Reasoning",
    0.000001,
    0.000005
  ],
  [
    "sonar",
    7,
    "Sonar",
    0.000001,
    0.000001
  ],
  [
    "deepseek-r1-distill-llama-70b:free",
    6,
    "R1 Distill Llama 70B (free)",
    0,
    0
  ],
  [
    "deepseek-r1-distill-llama-70b",
    6,
    "R1 Distill Llama 70B",
    1e-7,
    4e-7
  ],
  [
    "deepseek-r1:free",
    6,
    "R1 (free)",
    0,
    0
  ],
  [
    "deepseek-r1",
    6,
    "R1",
    4.5e-7,
    0.00000215
  ],
  [
    "deepseek-chat:free",
    6,
    "DeepSeek V3 (free)",
    0,
    0
  ],
  [
    "deepseek-chat",
    6,
    "DeepSeek V3",
    3.8e-7,
    8.9e-7
  ],
  [
    "o1",
    0,
    "o1",
    0.000015,
    0.00006
  ],
  [
    "grok-2-vision-1212",
    5,
    "Grok 2 Vision 1212",
    0.000002,
    0.00001
  ],
  [
    "grok-2-1212",
    5,
    "Grok 2 1212",
    0.000002,
    0.00001
  ],
  [
    "gemini-2.0-flash-exp:free",
    2,
    "Gemini 2.0 Flash Experimental (free)",
    0,
    0
  ],
  [
    "llama-3.3-70b-instruct:free",
    3,
    "Llama 3.3 70B Instruct (free)",
    0,
    0
  ],
  [
    "llama-3.3-70b-instruct",
    3,
    "Llama 3.3 70B Instruct",
    3.8e-8,
    1.2e-7
  ],
  [
    "qwq-32b-preview",
    4,
    "QwQ 32B Preview",
    2e-7,
    2e-7
  ],
  [
    "gpt-4o-2024-11-20",
    0,
    "GPT-4o (2024-11-20)",
    0.0000025,
    0.00001
  ],
  [
    "grok-vision-beta",
    5,
    "Grok Vision Beta",
    0.000005,
    0.000015
  ],
  [
    "qwen-2.5-coder-32b-instruct:free",
    4,
    "Qwen2.5 Coder 32B Instruct (free)",
    0,
    0
  ],
  [
    "qwen-2.5-coder-32b-instruct",
    4,
    "Qwen2.5 Coder 32B Instruct",
    6e-8,
    1.5e-7
  ],
  [
    "claude-3.5-haiku-20241022:beta",
    1,
    "Claude 3.5 Haiku (2024-10-22) (self-moderated)",
    8e-7,
    0.000004
  ],
  [
    "claude-3.5-haiku-20241022",
    1,
    "Claude 3.5 Haiku (2024-10-22)",
    8e-7,
    0.000004
  ],
  [
    "claude-3.5-haiku:beta",
    1,
    "Claude 3.5 Haiku (self-moderated)",
    8e-7,
    0.000004
  ],
  [
    "claude-3.5-haiku",
    1,
    "Claude 3.5 Haiku",
    8e-7,
    0.000004
  ],
  [
    "claude-3.5-sonnet:beta",
    1,
    "Claude 3.5 Sonnet (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "claude-3.5-sonnet",
    1,
    "Claude 3.5 Sonnet",
    0.000003,
    0.000015
  ],
  [
    "qwen-2.5-7b-instruct",
    4,
    "Qwen2.5 7B Instruct",
    4e-8,
    1e-7
  ],
  [
    "gemini-flash-1.5-8b",
    2,
    "Gemini 1.5 Flash 8B",
    3.75e-8,
    1.5e-7
  ],
  [
    "llama-3.2-11b-vision-instruct:free",
    3,
    "Llama 3.2 11B Vision Instruct (free)",
    0,
    0
  ],
  [
    "llama-3.2-11b-vision-instruct",
    3,
    "Llama 3.2 11B Vision Instruct",
    4.9e-8,
    4.9e-8
  ],
  [
    "llama-3.2-1b-instruct",
    3,
    "Llama 3.2 1B Instruct",
    5e-9,
    1e-8
  ],
  [
    "llama-3.2-90b-vision-instruct",
    3,
    "Llama 3.2 90B Vision Instruct",
    0.0000012,
    0.0000012
  ],
  [
    "llama-3.2-3b-instruct",
    3,
    "Llama 3.2 3B Instruct",
    3e-9,
    6e-9
  ],
  [
    "qwen-2.5-72b-instruct:free",
    4,
    "Qwen2.5 72B Instruct (free)",
    0,
    0
  ],
  [
    "qwen-2.5-72b-instruct",
    4,
    "Qwen2.5 72B Instruct",
    1.2e-7,
    3.9e-7
  ],
  [
    "o1-mini",
    0,
    "o1-mini",
    0.0000011,
    0.0000044
  ],
  [
    "o1-preview-2024-09-12",
    0,
    "o1-preview (2024-09-12)",
    0.000015,
    0.00006
  ],
  [
    "o1-mini-2024-09-12",
    0,
    "o1-mini (2024-09-12)",
    0.0000011,
    0.0000044
  ],
  [
    "o1-preview",
    0,
    "o1-preview",
    0.000015,
    0.00006
  ],
  [
    "qwen-2.5-vl-7b-instruct",
    4,
    "Qwen2.5-VL 7B Instruct",
    2e-7,
    2e-7
  ],
  [
    "chatgpt-4o-latest",
    0,
    "ChatGPT-4o",
    0.000005,
    0.000015
  ],
  [
    "gpt-4o-2024-08-06",
    0,
    "GPT-4o (2024-08-06)",
    0.0000025,
    0.00001
  ],
  [
    "llama-3.1-405b",
    3,
    "Llama 3.1 405B (base)",
    0.000002,
    0.000002
  ],
  [
    "llama-3.1-70b-instruct",
    3,
    "Llama 3.1 70B Instruct",
    1e-7,
    2.8e-7
  ],
  [
    "llama-3.1-405b-instruct",
    3,
    "Llama 3.1 405B Instruct",
    8e-7,
    8e-7
  ],
  [
    "llama-3.1-8b-instruct",
    3,
    "Llama 3.1 8B Instruct",
    1.5e-8,
    2e-8
  ],
  [
    "gpt-4o-mini-2024-07-18",
    0,
    "GPT-4o-mini (2024-07-18)",
    1.5e-7,
    6e-7
  ],
  [
    "gpt-4o-mini",
    0,
    "GPT-4o-mini",
    1.5e-7,
    6e-7
  ],
  [
    "gemma-2-27b-it",
    2,
    "Gemma 2 27B",
    8e-7,
    8e-7
  ],
  [
    "gemma-2-9b-it:free",
    2,
    "Gemma 2 9B (free)",
    0,
    0
  ],
  [
    "gemma-2-9b-it",
    2,
    "Gemma 2 9B",
    2e-7,
    2e-7
  ],
  [
    "claude-3.5-sonnet-20240620:beta",
    1,
    "Claude 3.5 Sonnet (2024-06-20) (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "claude-3.5-sonnet-20240620",
    1,
    "Claude 3.5 Sonnet (2024-06-20)",
    0.000003,
    0.000015
  ],
  [
    "qwen-2-72b-instruct",
    4,
    "Qwen 2 72B Instruct",
    9e-7,
    9e-7
  ],
  [
    "gemini-flash-1.5",
    2,
    "Gemini 1.5 Flash ",
    7.5e-8,
    3e-7
  ],
  [
    "llama-guard-2-8b",
    3,
    "LlamaGuard 2 8B",
    2e-7,
    2e-7
  ],
  [
    "gpt-4o",
    0,
    "GPT-4o",
    0.0000025,
    0.00001
  ],
  [
    "gpt-4o:extended",
    0,
    "GPT-4o (extended)",
    0.000006,
    0.000018
  ],
  [
    "gpt-4o-2024-05-13",
    0,
    "GPT-4o (2024-05-13)",
    0.000005,
    0.000015
  ],
  [
    "llama-3-8b-instruct",
    3,
    "Llama 3 8B Instruct",
    3e-8,
    6e-8
  ],
  [
    "llama-3-70b-instruct",
    3,
    "Llama 3 70B Instruct",
    3e-7,
    4e-7
  ],
  [
    "gpt-4-turbo",
    0,
    "GPT-4 Turbo",
    0.00001,
    0.00003
  ],
  [
    "gemini-pro-1.5",
    2,
    "Gemini 1.5 Pro",
    0.00000125,
    0.000005
  ],
  [
    "claude-3-haiku:beta",
    1,
    "Claude 3 Haiku (self-moderated)",
    2.5e-7,
    0.00000125
  ],
  [
    "claude-3-haiku",
    1,
    "Claude 3 Haiku",
    2.5e-7,
    0.00000125
  ],
  [
    "claude-3-sonnet:beta",
    1,
    "Claude 3 Sonnet (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "claude-3-sonnet",
    1,
    "Claude 3 Sonnet",
    0.000003,
    0.000015
  ],
  [
    "claude-3-opus:beta",
    1,
    "Claude 3 Opus (self-moderated)",
    0.000015,
    0.000075
  ],
  [
    "claude-3-opus",
    1,
    "Claude 3 Opus",
    0.000015,
    0.000075
  ],
  [
    "gpt-3.5-turbo-0613",
    0,
    "GPT-3.5 Turbo (older v0613)",
    0.000001,
    0.000002
  ],
  [
    "gpt-4-turbo-preview",
    0,
    "GPT-4 Turbo Preview",
    0.00001,
    0.00003
  ],
  [
    "claude-2:beta",
    1,
    "Claude v2 (self-moderated)",
    0.000008,
    0.000024
  ],
  [
    "claude-2",
    1,
    "Claude v2",
    0.000008,
    0.000024
  ],
  [
    "claude-2.1:beta",
    1,
    "Claude v2.1 (self-moderated)",
    0.000008,
    0.000024
  ],
  [
    "claude-2.1",
    1,
    "Claude v2.1",
    0.000008,
    0.000024
  ],
  [
    "gpt-4-1106-preview",
    0,
    "GPT-4 Turbo (older v1106)",
    0.00001,
    0.00003
  ],
  [
    "gpt-3.5-turbo-instruct",
    0,
    "GPT-3.5 Turbo Instruct",
    0.0000015,
    0.000002
  ],
  [
    "gpt-3.5-turbo-16k",
    0,
    "GPT-3.5 Turbo 16k",
    0.000003,
    0.000004
  ],
  [
    "claude-2.0:beta",
    1,
    "Claude v2.0 (self-moderated)",
    0.000008,
    0.000024
  ],
  [
    "claude-2.0",
    1,
    "Claude v2.0",
    0.000008,
    0.000024
  ],
  [
    "gpt-4",
    0,
    "GPT-4",
    0.00003,
    0.00006
  ],
  [
    "gpt-4-0314",
    0,
    "GPT-4 (older v0314)",
    0.00003,
    0.00006
  ]
];
