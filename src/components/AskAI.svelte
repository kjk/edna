<script lang="ts">
  import { tick } from "svelte";
  import hljs from "highlight.js";
  import type { MarkdownIt } from "markdown-it";
  import {
    aiProviders,
    findModel,
    getAiProvider,
    modelKey,
    providerKey,
    type AiModel,
    type AiProvider,
  } from "../ai-models";
  import { aiModelsState, refreshAiModels } from "../ai-models-state.svelte";
  import { parseChatStreamData } from "../ai-stream";
  import { focus, trapfocus } from "../actions";
  import { logAskAI } from "../log";
  import { newMarkdownIt } from "../markdown-util";
  import { getSettings } from "../settings.svelte";
  import { isKeyCtrlEnter, len } from "../util";
  import AiModels from "./AiModels.svelte";
  import { IconGrokIconDown } from "./Icons.svelte";

  interface Props {
    close: () => void;
    startText: string;
    insertResponse: (s: string) => boolean;
  }
  let { close, startText, insertResponse }: Props = $props();

  let outputMarkdownToHTML = true;

  let forceBadApiKey = false; // for ad-hoc testing

  let settings = getSettings();
  // svelte-ignore state_referenced_locally
  let questionText = $state(startText);
  let reqFinished = $state(false);
  let err = $state("");
  let forceShowingApiKey = $state(false);
  let aiModel: AiModel | undefined = $derived(findModel(settings.aiModelID, aiModelsState.models));
  let aiModelName = $derived(aiModel ? aiModel.name : aiModelsState.loading ? "loading..." : "no model");
  let aiProvider = $derived(aiModel ? getAiProvider(aiModel.provider) : undefined);
  let apiKey = $derived(aiProvider ? providerKey(settings, aiProvider) : "");
  let hasAPIKey = $derived(aiProvider !== undefined && aiProvider.looksValidKey(apiKey));
  let hasAnyAPIKey = $derived(aiProviders.some((p) => p.looksValidKey(providerKey(settings, p))));

  // lists of models depend on API keys: (re-)load when they change. Lists
  // are cached for a day so this usually doesn't make requests
  let keysSig = $derived(aiProviders.map((p) => settings[p.keySetting] || "").join("\n"));
  $effect(() => {
    keysSig;
    // debounce typing / pasting a key
    let timer = setTimeout(() => refreshAiModels(settings), 300);
    return () => clearTimeout(timer);
  });

  const maxTokens = 10000;

  // aborted when the dialog closes (A-I1)
  let abortController: AbortController | undefined;
  $effect(() => {
    return () => {
      abortController?.abort();
    };
  });

  // name of the model that produced responseText (A-I2)
  let responseModelName = "";

  async function askai() {
    err = "";
    responseText = "";
    let model = aiModel;
    let provider = aiProvider;
    if (!model || !provider) {
      err = "No AI model selected";
      return;
    }
    responseModelName = model.name;
    abortController?.abort();
    abortController = new AbortController();
    let signal = abortController.signal;
    try {
      reqFinished = false;
      reqInProgress = true;
      await streamChatGPTResponse(questionText, model, provider, apiKey, signal);
      reqFinished = true;
    } catch (e: any) {
      if (signal.aborted) {
        return;
      }
      console.error(e);
      console.error(e.cause ? e.cause : "");
      err = e.toString();
      if (e.cause) {
        let r = e.cause as Response;
        try {
          let rsp = await r.text();
          err += rsp;
        } catch (e) {
          console.error(e);
        }
      }
    } finally {
      reqInProgress = false;
    }
    if (err == "") {
      logAskAI(model.name, provider.id);
      tick().then(() => {
        btnInsertRef?.focus();
      });
    }
  }

  let responseText = $state("");

  let reqInProgress = $state(false);
  let askAIDisabled = $derived(!hasAPIKey || reqInProgress);

  function insertRsp() {
    let s = "# Response from " + responseModelName + "\n\n" + responseText + "\n";
    if (!insertResponse(s)) {
      err = "Can't insert the response: the note is read-only";
      return;
    }
    close();
  }

  async function streamChatGPTResponse(
    prompt: string,
    model: AiModel,
    provider: AiProvider,
    apiKey: string,
    signal: AbortSignal,
  ) {
    if (forceBadApiKey) {
      apiKey = "g" + apiKey;
    }

    // model ids come from the provider's list of models so they're valid for it
    const requestBody: Record<string, unknown> = {
      model: model.id,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    };

    // openai api uses max_completion_tokens, others max_tokens
    // https://platform.openai.com/docs/api-reference/chat/create#chat_create-max_completion_tokens
    if (provider.id === "openai") {
      requestBody.max_completion_tokens = maxTokens;
    } else {
      requestBody.max_tokens = maxTokens;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (provider.id === "anthropic") {
      // Anthropic's API only allows requests from a browser (CORS) with this header
      headers["anthropic-dangerous-direct-browser-access"] = "true";
    }
    const response = await fetch(provider.chatURL, {
      signal,
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      let e = new Error(`HTTP error! status: ${response.status}`);
      e.cause = response;
      throw e;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    // a chunk can end in the middle of a line (or a multi-byte character)
    // so we keep the incomplete last line for the next chunk
    let pending = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop()!;

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          // throws on an error sent in the stream
          responseText += parseChatStreamData(data);
        }
      }
    }
  }

  // creating markdown-it instance is expensive and mdToHTML() is called for every streamed token
  let mdItCached: MarkdownIt | undefined;
  function getMarkdownIt(): MarkdownIt {
    if (mdItCached) {
      return mdItCached;
    }
    let mdIt: MarkdownIt = newMarkdownIt({
      highlight: function (str: string, lang: string) {
        try {
          if (lang && hljs && hljs.getLanguage(lang)) {
            return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
          }
        } catch (__) {}
        // fallback: escape HTML
        return `<pre class="hljs"><code>${mdIt.utils.escapeHtml(str)}</code></pre>`;
      },
    });
    mdItCached = mdIt;
    return mdIt;
  }

  function mdToHTML(md: string): string {
    return getMarkdownIt().render(md);
  }

  function onkeydown(ev: KeyboardEvent) {
    if (isKeyCtrlEnter(ev) && !askAIDisabled) {
      askai();
    }
  }

  let btnInsertRef: HTMLElement;
  let textAreaRef: HTMLElement;

  let showingModels = $state(false);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  tabindex="-1"
  use:trapfocus
  class="dlg z-20 absolute center-x-with-translate top-4 flex flex-col max-h-[78vh] w-[85vw] p-2"
>
  <div class="flex items-center">
    <div class="p-1 font-bold text-lg">Ask AI</div>
    <a target="_blank" class="ml-4 link" href="/help#ask-ai">learn more</a>
    {#if hasAnyAPIKey}
      <button
        onclick={(ev) => {
          forceShowingApiKey = !forceShowingApiKey;
          // console.warn("forceShowingApiKey:", forceShowingApiKey);
          ev.preventDefault();
          ev.stopPropagation();
        }}
        class="ml-4 link hover:text-gray-900">{forceShowingApiKey ? "hide" : "show"} api keys</button
      >
    {/if}
    <div class="grow"></div>
    <div class="flex ml-1 mt-2 items-baseline">
      <div class="px-1 font-bold">model:</div>
      <button
        onclick={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          showingModels = true;
        }}
        class="hover:bg-gray-100 flex items-center cursor-pointer px-1 relative"
      >
        <div>{aiModelName}</div>
        <div class="ml-1.5">{@render IconGrokIconDown()}</div>
        {#if showingModels}
          <AiModels
            close={() => {
              showingModels = false;
              textAreaRef?.focus();
            }}
            selectModel={(model) => {
              settings.aiModelID = modelKey(model);
              showingModels = false;
            }}
          ></AiModels>
        {/if}
      </button>
    </div>
  </div>

  {#if forceShowingApiKey || !hasAnyAPIKey}
    <div class="flex flex-col gap-1.5 py-1 ml-1">
      <div class="flex">
        <div class="grow">
          Enter API key for one or more AI providers. We'll show models available with those keys.
        </div>
        <a class="link" target="_blank" href="/help#api-keys">learn more</a>
      </div>
      {#each aiProviders as p (p.id)}
        <label class="flex items-baseline gap-2">
          <a class="link w-[12ch] shrink-0" target="_blank" href={p.helpURL}>{p.name}</a>
          <input
            placeholder="Enter {p.name} API key"
            bind:value={settings[p.keySetting]}
            class="px-1 py-px grow"
          />
        </label>
      {/each}
    </div>
  {/if}
  {#each aiModelsState.errors as e}
    <div class="ml-1 text-red-600">{e}</div>
  {/each}

  <textarea
    bind:value={questionText}
    bind:this={textAreaRef}
    use:focus
    {onkeydown}
    class="mt-1 w-full min-h-40 max-h-[70vh] field-sizing-content border border-gray-950/20 outline-gray-950/50 p-1.5"
  ></textarea>
  {#if len(responseText) > 0}
    {#if outputMarkdownToHTML}
      <div
        tabindex="-1"
        class="markdown-body mt-2 h-auto w-full overflow-auto border border-gray-950/20 outline-gray-950/20 p-1.5"
      >
        {@html mdToHTML(responseText)}
      </div>
    {:else}
      <div
        tabindex="-1"
        class="mt-2 font-mono whitespace-pre-wrap h-auto w-full overflow-auto border border-gray-950/20 outline-gray-950/20 p-1.5"
      >
        {responseText}
      </div>
    {/if}
  {/if}
  {#if err}
    <div class="flex mt-2 text-red-600 px-2 py-0.5 whitespace-pre-line overflow-auto">
      {err}
    </div>
  {/if}
  <div class="flex mt-2 items-center">
    {#if !hasAnyAPIKey}
      <div class=" text-red-600 ml-2 whitespace-pre-line overflow-auto">Need a valid API key</div>
      <a target="_blank" class="ml-2 link" href="/help#api-keys">learn more</a>
    {/if}
    {#if reqInProgress}
      <div class="ml-2 font-bold">thinking...</div>
    {/if}
    <div class="grow"></div>
    <button bind:this={btnInsertRef} onclick={insertRsp} class="button-outline {reqFinished ? 'visible' : 'invisible'}"
      >Insert response as block</button
    >
    <button onclick={askai} disabled={askAIDisabled} class="ml-2 button-outline"
      >{#if reqFinished}Ask AI Again{:else}Ask AI{/if}</button
    >
    <button onclick={close} class="button-outline ml-2"
      >{#if reqFinished}Close{:else}Cancel{/if}</button
    >
  </div>
</div>
