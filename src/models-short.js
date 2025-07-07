
export const kModelIDIdx = 0;
export const kModelNameIdx = 1;
export const kModelPricePromptIdx = 2;
export const kModelPriceCompletionIdx = 3;

export const modelsShort = [
  [
    "google/gemini-2.5-flash-lite-preview-06-17",
    "Google: Gemini 2.5 Flash Lite Preview 06-17",
    1e-7,
    4e-7
  ],
  [
    "google/gemini-2.5-flash",
    "Google: Gemini 2.5 Flash",
    3e-7,
    0.0000025
  ],
  [
    "google/gemini-2.5-pro",
    "Google: Gemini 2.5 Pro",
    0.00000125,
    0.00001
  ],
  [
    "openai/o3-pro",
    "OpenAI: o3 Pro",
    0.00002,
    0.00008
  ],
  [
    "x-ai/grok-3-mini",
    "xAI: Grok 3 Mini",
    3e-7,
    5e-7
  ],
  [
    "x-ai/grok-3",
    "xAI: Grok 3",
    0.000003,
    0.000015
  ],
  [
    "google/gemini-2.5-pro-preview",
    "Google: Gemini 2.5 Pro Preview 06-05",
    0.00000125,
    0.00001
  ],
  [
    "deepseek/deepseek-r1-distill-qwen-7b",
    "DeepSeek: R1 Distill Qwen 7B",
    1e-7,
    2e-7
  ],
  [
    "deepseek/deepseek-r1-0528-qwen3-8b:free",
    "DeepSeek: Deepseek R1 0528 Qwen3 8B (free)",
    0,
    0
  ],
  [
    "deepseek/deepseek-r1-0528-qwen3-8b",
    "DeepSeek: Deepseek R1 0528 Qwen3 8B",
    1e-8,
    2e-8
  ],
  [
    "deepseek/deepseek-r1-0528:free",
    "DeepSeek: R1 0528 (free)",
    0,
    0
  ],
  [
    "deepseek/deepseek-r1-0528",
    "DeepSeek: R1 0528",
    5e-7,
    0.00000215
  ],
  [
    "anthropic/claude-opus-4",
    "Anthropic: Claude Opus 4",
    0.000015,
    0.000075
  ],
  [
    "anthropic/claude-sonnet-4",
    "Anthropic: Claude Sonnet 4",
    0.000003,
    0.000015
  ],
  [
    "google/gemma-3n-e4b-it:free",
    "Google: Gemma 3n 4B (free)",
    0,
    0
  ],
  [
    "google/gemma-3n-e4b-it",
    "Google: Gemma 3n 4B",
    2e-8,
    4e-8
  ],
  [
    "google/gemini-2.5-flash-preview-05-20",
    "Google: Gemini 2.5 Flash Preview 05-20",
    1.5e-7,
    6e-7
  ],
  [
    "google/gemini-2.5-flash-preview-05-20:thinking",
    "Google: Gemini 2.5 Flash Preview 05-20 (thinking)",
    1.5e-7,
    0.0000035
  ],
  [
    "openai/codex-mini",
    "OpenAI: Codex Mini",
    0.0000015,
    0.000006
  ],
  [
    "google/gemini-2.5-pro-preview-05-06",
    "Google: Gemini 2.5 Pro Preview 05-06",
    0.00000125,
    0.00001
  ],
  [
    "deepseek/deepseek-prover-v2",
    "DeepSeek: DeepSeek Prover V2",
    5e-7,
    0.00000218
  ],
  [
    "meta-llama/llama-guard-4-12b",
    "Meta: Llama Guard 4 12B",
    5e-8,
    5e-8
  ],
  [
    "qwen/qwen3-30b-a3b:free",
    "Qwen: Qwen3 30B A3B (free)",
    0,
    0
  ],
  [
    "qwen/qwen3-30b-a3b",
    "Qwen: Qwen3 30B A3B",
    8e-8,
    2.9e-7
  ],
  [
    "qwen/qwen3-8b:free",
    "Qwen: Qwen3 8B (free)",
    0,
    0
  ],
  [
    "qwen/qwen3-8b",
    "Qwen: Qwen3 8B",
    3.5e-8,
    1.38e-7
  ],
  [
    "qwen/qwen3-14b:free",
    "Qwen: Qwen3 14B (free)",
    0,
    0
  ],
  [
    "qwen/qwen3-14b",
    "Qwen: Qwen3 14B",
    6e-8,
    2.4e-7
  ],
  [
    "qwen/qwen3-32b:free",
    "Qwen: Qwen3 32B (free)",
    0,
    0
  ],
  [
    "qwen/qwen3-32b",
    "Qwen: Qwen3 32B",
    1e-7,
    3e-7
  ],
  [
    "qwen/qwen3-235b-a22b:free",
    "Qwen: Qwen3 235B A22B (free)",
    0,
    0
  ],
  [
    "qwen/qwen3-235b-a22b",
    "Qwen: Qwen3 235B A22B",
    1.3e-7,
    6e-7
  ],
  [
    "google/gemini-2.5-flash-preview",
    "Google: Gemini 2.5 Flash Preview 04-17",
    1.5e-7,
    6e-7
  ],
  [
    "google/gemini-2.5-flash-preview:thinking",
    "Google: Gemini 2.5 Flash Preview 04-17 (thinking)",
    1.5e-7,
    0.0000035
  ],
  [
    "openai/o4-mini-high",
    "OpenAI: o4 Mini High",
    0.0000011,
    0.0000044
  ],
  [
    "openai/o3",
    "OpenAI: o3",
    0.000002,
    0.000008
  ],
  [
    "openai/o4-mini",
    "OpenAI: o4 Mini",
    0.0000011,
    0.0000044
  ],
  [
    "openai/gpt-4.1",
    "OpenAI: GPT-4.1",
    0.000002,
    0.000008
  ],
  [
    "openai/gpt-4.1-mini",
    "OpenAI: GPT-4.1 Mini",
    4e-7,
    0.0000016
  ],
  [
    "openai/gpt-4.1-nano",
    "OpenAI: GPT-4.1 Nano",
    1e-7,
    4e-7
  ],
  [
    "x-ai/grok-3-mini-beta",
    "xAI: Grok 3 Mini Beta",
    3e-7,
    5e-7
  ],
  [
    "x-ai/grok-3-beta",
    "xAI: Grok 3 Beta",
    0.000003,
    0.000015
  ],
  [
    "meta-llama/llama-4-maverick:free",
    "Meta: Llama 4 Maverick (free)",
    0,
    0
  ],
  [
    "meta-llama/llama-4-maverick",
    "Meta: Llama 4 Maverick",
    1.5e-7,
    6e-7
  ],
  [
    "meta-llama/llama-4-scout:free",
    "Meta: Llama 4 Scout (free)",
    0,
    0
  ],
  [
    "meta-llama/llama-4-scout",
    "Meta: Llama 4 Scout",
    8e-8,
    3e-7
  ],
  [
    "deepseek/deepseek-v3-base:free",
    "DeepSeek: DeepSeek V3 Base (free)",
    0,
    0
  ],
  [
    "google/gemini-2.5-pro-exp-03-25",
    "Google: Gemini 2.5 Pro Experimental",
    0,
    0
  ],
  [
    "qwen/qwen2.5-vl-32b-instruct:free",
    "Qwen: Qwen2.5 VL 32B Instruct (free)",
    0,
    0
  ],
  [
    "qwen/qwen2.5-vl-32b-instruct",
    "Qwen: Qwen2.5 VL 32B Instruct",
    9e-7,
    9e-7
  ],
  [
    "deepseek/deepseek-chat-v3-0324:free",
    "DeepSeek: DeepSeek V3 0324 (free)",
    0,
    0
  ],
  [
    "deepseek/deepseek-chat-v3-0324",
    "DeepSeek: DeepSeek V3 0324",
    2.8e-7,
    8.8e-7
  ],
  [
    "openai/o1-pro",
    "OpenAI: o1-pro",
    0.00015,
    0.0006
  ],
  [
    "google/gemma-3-4b-it:free",
    "Google: Gemma 3 4B (free)",
    0,
    0
  ],
  [
    "google/gemma-3-4b-it",
    "Google: Gemma 3 4B",
    2e-8,
    4e-8
  ],
  [
    "google/gemma-3-12b-it:free",
    "Google: Gemma 3 12B (free)",
    0,
    0
  ],
  [
    "google/gemma-3-12b-it",
    "Google: Gemma 3 12B",
    5e-8,
    1e-7
  ],
  [
    "openai/gpt-4o-mini-search-preview",
    "OpenAI: GPT-4o-mini Search Preview",
    1.5e-7,
    6e-7
  ],
  [
    "openai/gpt-4o-search-preview",
    "OpenAI: GPT-4o Search Preview",
    0.0000025,
    0.00001
  ],
  [
    "google/gemma-3-27b-it:free",
    "Google: Gemma 3 27B (free)",
    0,
    0
  ],
  [
    "google/gemma-3-27b-it",
    "Google: Gemma 3 27B",
    9e-8,
    1.7e-7
  ],
  [
    "perplexity/sonar-reasoning-pro",
    "Perplexity: Sonar Reasoning Pro",
    0.000002,
    0.000008
  ],
  [
    "perplexity/sonar-pro",
    "Perplexity: Sonar Pro",
    0.000003,
    0.000015
  ],
  [
    "perplexity/sonar-deep-research",
    "Perplexity: Sonar Deep Research",
    0.000002,
    0.000008
  ],
  [
    "qwen/qwq-32b:free",
    "Qwen: QwQ 32B (free)",
    0,
    0
  ],
  [
    "qwen/qwq-32b",
    "Qwen: QwQ 32B",
    7.5e-8,
    1.5e-7
  ],
  [
    "openai/gpt-4.5-preview",
    "OpenAI: GPT-4.5 (Preview)",
    0.000075,
    0.00015
  ],
  [
    "google/gemini-2.0-flash-lite-001",
    "Google: Gemini 2.0 Flash Lite",
    7.5e-8,
    3e-7
  ],
  [
    "anthropic/claude-3.7-sonnet",
    "Anthropic: Claude 3.7 Sonnet",
    0.000003,
    0.000015
  ],
  [
    "anthropic/claude-3.7-sonnet:thinking",
    "Anthropic: Claude 3.7 Sonnet (thinking)",
    0.000003,
    0.000015
  ],
  [
    "anthropic/claude-3.7-sonnet:beta",
    "Anthropic: Claude 3.7 Sonnet (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "perplexity/r1-1776",
    "Perplexity: R1 1776",
    0.000002,
    0.000008
  ],
  [
    "meta-llama/llama-guard-3-8b",
    "Llama Guard 3 8B",
    2e-8,
    6e-8
  ],
  [
    "openai/o3-mini-high",
    "OpenAI: o3 Mini High",
    0.0000011,
    0.0000044
  ],
  [
    "deepseek/deepseek-r1-distill-llama-8b",
    "DeepSeek: R1 Distill Llama 8B",
    4e-8,
    4e-8
  ],
  [
    "google/gemini-2.0-flash-001",
    "Google: Gemini 2.0 Flash",
    1e-7,
    4e-7
  ],
  [
    "qwen/qwen-vl-plus",
    "Qwen: Qwen VL Plus",
    2.1e-7,
    6.3e-7
  ],
  [
    "qwen/qwen-vl-max",
    "Qwen: Qwen VL Max",
    8e-7,
    0.0000032
  ],
  [
    "qwen/qwen-turbo",
    "Qwen: Qwen-Turbo",
    5e-8,
    2e-7
  ],
  [
    "qwen/qwen2.5-vl-72b-instruct:free",
    "Qwen: Qwen2.5 VL 72B Instruct (free)",
    0,
    0
  ],
  [
    "qwen/qwen2.5-vl-72b-instruct",
    "Qwen: Qwen2.5 VL 72B Instruct",
    2.5e-7,
    7.5e-7
  ],
  [
    "qwen/qwen-plus",
    "Qwen: Qwen-Plus",
    4e-7,
    0.0000012
  ],
  [
    "qwen/qwen-max",
    "Qwen: Qwen-Max ",
    0.0000016,
    0.0000064
  ],
  [
    "openai/o3-mini",
    "OpenAI: o3 Mini",
    0.0000011,
    0.0000044
  ],
  [
    "deepseek/deepseek-r1-distill-qwen-1.5b",
    "DeepSeek: R1 Distill Qwen 1.5B",
    1.8e-7,
    1.8e-7
  ],
  [
    "deepseek/deepseek-r1-distill-qwen-32b",
    "DeepSeek: R1 Distill Qwen 32B",
    7.5e-8,
    1.5e-7
  ],
  [
    "deepseek/deepseek-r1-distill-qwen-14b:free",
    "DeepSeek: R1 Distill Qwen 14B (free)",
    0,
    0
  ],
  [
    "deepseek/deepseek-r1-distill-qwen-14b",
    "DeepSeek: R1 Distill Qwen 14B",
    1.5e-7,
    1.5e-7
  ],
  [
    "perplexity/sonar-reasoning",
    "Perplexity: Sonar Reasoning",
    0.000001,
    0.000005
  ],
  [
    "perplexity/sonar",
    "Perplexity: Sonar",
    0.000001,
    0.000001
  ],
  [
    "deepseek/deepseek-r1-distill-llama-70b:free",
    "DeepSeek: R1 Distill Llama 70B (free)",
    0,
    0
  ],
  [
    "deepseek/deepseek-r1-distill-llama-70b",
    "DeepSeek: R1 Distill Llama 70B",
    1e-7,
    4e-7
  ],
  [
    "deepseek/deepseek-r1:free",
    "DeepSeek: R1 (free)",
    0,
    0
  ],
  [
    "deepseek/deepseek-r1",
    "DeepSeek: R1",
    4.5e-7,
    0.00000215
  ],
  [
    "deepseek/deepseek-chat:free",
    "DeepSeek: DeepSeek V3 (free)",
    0,
    0
  ],
  [
    "deepseek/deepseek-chat",
    "DeepSeek: DeepSeek V3",
    3.8e-7,
    8.9e-7
  ],
  [
    "openai/o1",
    "OpenAI: o1",
    0.000015,
    0.00006
  ],
  [
    "x-ai/grok-2-vision-1212",
    "xAI: Grok 2 Vision 1212",
    0.000002,
    0.00001
  ],
  [
    "x-ai/grok-2-1212",
    "xAI: Grok 2 1212",
    0.000002,
    0.00001
  ],
  [
    "google/gemini-2.0-flash-exp:free",
    "Google: Gemini 2.0 Flash Experimental (free)",
    0,
    0
  ],
  [
    "meta-llama/llama-3.3-70b-instruct:free",
    "Meta: Llama 3.3 70B Instruct (free)",
    0,
    0
  ],
  [
    "meta-llama/llama-3.3-70b-instruct",
    "Meta: Llama 3.3 70B Instruct",
    3.8e-8,
    1.2e-7
  ],
  [
    "qwen/qwq-32b-preview",
    "Qwen: QwQ 32B Preview",
    2e-7,
    2e-7
  ],
  [
    "openai/gpt-4o-2024-11-20",
    "OpenAI: GPT-4o (2024-11-20)",
    0.0000025,
    0.00001
  ],
  [
    "x-ai/grok-vision-beta",
    "xAI: Grok Vision Beta",
    0.000005,
    0.000015
  ],
  [
    "qwen/qwen-2.5-coder-32b-instruct:free",
    "Qwen2.5 Coder 32B Instruct (free)",
    0,
    0
  ],
  [
    "qwen/qwen-2.5-coder-32b-instruct",
    "Qwen2.5 Coder 32B Instruct",
    6e-8,
    1.5e-7
  ],
  [
    "anthropic/claude-3.5-haiku-20241022:beta",
    "Anthropic: Claude 3.5 Haiku (2024-10-22) (self-moderated)",
    8e-7,
    0.000004
  ],
  [
    "anthropic/claude-3.5-haiku-20241022",
    "Anthropic: Claude 3.5 Haiku (2024-10-22)",
    8e-7,
    0.000004
  ],
  [
    "anthropic/claude-3.5-haiku:beta",
    "Anthropic: Claude 3.5 Haiku (self-moderated)",
    8e-7,
    0.000004
  ],
  [
    "anthropic/claude-3.5-haiku",
    "Anthropic: Claude 3.5 Haiku",
    8e-7,
    0.000004
  ],
  [
    "anthropic/claude-3.5-sonnet:beta",
    "Anthropic: Claude 3.5 Sonnet (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "anthropic/claude-3.5-sonnet",
    "Anthropic: Claude 3.5 Sonnet",
    0.000003,
    0.000015
  ],
  [
    "qwen/qwen-2.5-7b-instruct",
    "Qwen2.5 7B Instruct",
    4e-8,
    1e-7
  ],
  [
    "google/gemini-flash-1.5-8b",
    "Google: Gemini 1.5 Flash 8B",
    3.75e-8,
    1.5e-7
  ],
  [
    "meta-llama/llama-3.2-11b-vision-instruct:free",
    "Meta: Llama 3.2 11B Vision Instruct (free)",
    0,
    0
  ],
  [
    "meta-llama/llama-3.2-11b-vision-instruct",
    "Meta: Llama 3.2 11B Vision Instruct",
    4.9e-8,
    4.9e-8
  ],
  [
    "meta-llama/llama-3.2-1b-instruct",
    "Meta: Llama 3.2 1B Instruct",
    5e-9,
    1e-8
  ],
  [
    "meta-llama/llama-3.2-90b-vision-instruct",
    "Meta: Llama 3.2 90B Vision Instruct",
    0.0000012,
    0.0000012
  ],
  [
    "meta-llama/llama-3.2-3b-instruct",
    "Meta: Llama 3.2 3B Instruct",
    3e-9,
    6e-9
  ],
  [
    "qwen/qwen-2.5-72b-instruct:free",
    "Qwen2.5 72B Instruct (free)",
    0,
    0
  ],
  [
    "qwen/qwen-2.5-72b-instruct",
    "Qwen2.5 72B Instruct",
    1.2e-7,
    3.9e-7
  ],
  [
    "openai/o1-mini",
    "OpenAI: o1-mini",
    0.0000011,
    0.0000044
  ],
  [
    "openai/o1-preview-2024-09-12",
    "OpenAI: o1-preview (2024-09-12)",
    0.000015,
    0.00006
  ],
  [
    "openai/o1-mini-2024-09-12",
    "OpenAI: o1-mini (2024-09-12)",
    0.0000011,
    0.0000044
  ],
  [
    "openai/o1-preview",
    "OpenAI: o1-preview",
    0.000015,
    0.00006
  ],
  [
    "qwen/qwen-2.5-vl-7b-instruct",
    "Qwen: Qwen2.5-VL 7B Instruct",
    2e-7,
    2e-7
  ],
  [
    "openai/chatgpt-4o-latest",
    "OpenAI: ChatGPT-4o",
    0.000005,
    0.000015
  ],
  [
    "openai/gpt-4o-2024-08-06",
    "OpenAI: GPT-4o (2024-08-06)",
    0.0000025,
    0.00001
  ],
  [
    "meta-llama/llama-3.1-405b",
    "Meta: Llama 3.1 405B (base)",
    0.000002,
    0.000002
  ],
  [
    "meta-llama/llama-3.1-70b-instruct",
    "Meta: Llama 3.1 70B Instruct",
    1e-7,
    2.8e-7
  ],
  [
    "meta-llama/llama-3.1-405b-instruct",
    "Meta: Llama 3.1 405B Instruct",
    8e-7,
    8e-7
  ],
  [
    "meta-llama/llama-3.1-8b-instruct",
    "Meta: Llama 3.1 8B Instruct",
    1.5e-8,
    2e-8
  ],
  [
    "openai/gpt-4o-mini-2024-07-18",
    "OpenAI: GPT-4o-mini (2024-07-18)",
    1.5e-7,
    6e-7
  ],
  [
    "openai/gpt-4o-mini",
    "OpenAI: GPT-4o-mini",
    1.5e-7,
    6e-7
  ],
  [
    "google/gemma-2-27b-it",
    "Google: Gemma 2 27B",
    8e-7,
    8e-7
  ],
  [
    "google/gemma-2-9b-it:free",
    "Google: Gemma 2 9B (free)",
    0,
    0
  ],
  [
    "google/gemma-2-9b-it",
    "Google: Gemma 2 9B",
    2e-7,
    2e-7
  ],
  [
    "anthropic/claude-3.5-sonnet-20240620:beta",
    "Anthropic: Claude 3.5 Sonnet (2024-06-20) (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "anthropic/claude-3.5-sonnet-20240620",
    "Anthropic: Claude 3.5 Sonnet (2024-06-20)",
    0.000003,
    0.000015
  ],
  [
    "qwen/qwen-2-72b-instruct",
    "Qwen 2 72B Instruct",
    9e-7,
    9e-7
  ],
  [
    "google/gemini-flash-1.5",
    "Google: Gemini 1.5 Flash ",
    7.5e-8,
    3e-7
  ],
  [
    "meta-llama/llama-guard-2-8b",
    "Meta: LlamaGuard 2 8B",
    2e-7,
    2e-7
  ],
  [
    "openai/gpt-4o",
    "OpenAI: GPT-4o",
    0.0000025,
    0.00001
  ],
  [
    "openai/gpt-4o:extended",
    "OpenAI: GPT-4o (extended)",
    0.000006,
    0.000018
  ],
  [
    "openai/gpt-4o-2024-05-13",
    "OpenAI: GPT-4o (2024-05-13)",
    0.000005,
    0.000015
  ],
  [
    "meta-llama/llama-3-8b-instruct",
    "Meta: Llama 3 8B Instruct",
    3e-8,
    6e-8
  ],
  [
    "meta-llama/llama-3-70b-instruct",
    "Meta: Llama 3 70B Instruct",
    3e-7,
    4e-7
  ],
  [
    "openai/gpt-4-turbo",
    "OpenAI: GPT-4 Turbo",
    0.00001,
    0.00003
  ],
  [
    "google/gemini-pro-1.5",
    "Google: Gemini 1.5 Pro",
    0.00000125,
    0.000005
  ],
  [
    "anthropic/claude-3-haiku:beta",
    "Anthropic: Claude 3 Haiku (self-moderated)",
    2.5e-7,
    0.00000125
  ],
  [
    "anthropic/claude-3-haiku",
    "Anthropic: Claude 3 Haiku",
    2.5e-7,
    0.00000125
  ],
  [
    "anthropic/claude-3-sonnet:beta",
    "Anthropic: Claude 3 Sonnet (self-moderated)",
    0.000003,
    0.000015
  ],
  [
    "anthropic/claude-3-sonnet",
    "Anthropic: Claude 3 Sonnet",
    0.000003,
    0.000015
  ],
  [
    "anthropic/claude-3-opus:beta",
    "Anthropic: Claude 3 Opus (self-moderated)",
    0.000015,
    0.000075
  ],
  [
    "anthropic/claude-3-opus",
    "Anthropic: Claude 3 Opus",
    0.000015,
    0.000075
  ],
  [
    "openai/gpt-3.5-turbo-0613",
    "OpenAI: GPT-3.5 Turbo (older v0613)",
    0.000001,
    0.000002
  ],
  [
    "openai/gpt-4-turbo-preview",
    "OpenAI: GPT-4 Turbo Preview",
    0.00001,
    0.00003
  ],
  [
    "anthropic/claude-2:beta",
    "Anthropic: Claude v2 (self-moderated)",
    0.000008,
    0.000024
  ],
  [
    "anthropic/claude-2",
    "Anthropic: Claude v2",
    0.000008,
    0.000024
  ],
  [
    "anthropic/claude-2.1:beta",
    "Anthropic: Claude v2.1 (self-moderated)",
    0.000008,
    0.000024
  ],
  [
    "anthropic/claude-2.1",
    "Anthropic: Claude v2.1",
    0.000008,
    0.000024
  ],
  [
    "openai/gpt-4-1106-preview",
    "OpenAI: GPT-4 Turbo (older v1106)",
    0.00001,
    0.00003
  ],
  [
    "openai/gpt-3.5-turbo-instruct",
    "OpenAI: GPT-3.5 Turbo Instruct",
    0.0000015,
    0.000002
  ],
  [
    "openai/gpt-3.5-turbo-16k",
    "OpenAI: GPT-3.5 Turbo 16k",
    0.000003,
    0.000004
  ],
  [
    "anthropic/claude-2.0:beta",
    "Anthropic: Claude v2.0 (self-moderated)",
    0.000008,
    0.000024
  ],
  [
    "anthropic/claude-2.0",
    "Anthropic: Claude v2.0",
    0.000008,
    0.000024
  ],
  [
    "openai/gpt-4",
    "OpenAI: GPT-4",
    0.00003,
    0.00006
  ],
  [
    "openai/gpt-4-0314",
    "OpenAI: GPT-4 (older v0314)",
    0.00003,
    0.00006
  ]
];
