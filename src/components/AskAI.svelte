<script>
  import { tick } from "svelte";
  import hljs from "highlight.js";
  import markdownIt from "markdown-it";
  import markdownItAnchor from "markdown-it-anchor";
  import { focus, trapfocus } from "../actions";
  import { logAskAI } from "../log";
  import {
    kModelIDIdx,
    kModelNameIdx,
    kModelProviderIdx,
    kProviderOpenAI,
    kProviderXAI,
    providersInfo,
  } from "../models-short";
  import { findModelByID, getSettings } from "../settings.svelte";
  import { isKeyCtrlEnter, len } from "../util";
  import AiModels from "./AiModels.svelte";

  /** @type {{
    close: () => void,
    startText: string,
    insertResponse: (string) => void,
}}*/
  let { close, startText, insertResponse } = $props();

  let outputMarkdownToHTML = true;
  const kApiProviderOpenAI = 0;
  const kApiProviderXAi = 1;
  const kApiProviderOpenRouter = 2;
  // const kApiProviderAnthropic = 3;
  // const kApiProviderGoogle = 3;

  /**
   * @param {number} apiProvider
   * @returns {{maybeValidApiKey, apiProviderToUse}}
   */
  function pickApiKeyForProvider(
    apiProvider,
    openAIKey,
    xAIKey,
    openRouterKey,
  ) {
    if (apiProvider == kApiProviderOpenAI) {
      if (looksValidOpenAIKey(openAIKey)) {
        return {
          maybeValidApiKey: openAIKey,
          apiProviderToUse: kApiProviderOpenAI,
        };
      }
    }
    if (apiProvider == kApiProviderXAi) {
      if (looksValidXAIkKey(xAIKey)) {
        return {
          maybeValidApiKey: xAIKey,
          apiProviderToUse: kApiProviderXAi,
        };
      }
    }
    if (looksValidOpenRouterKey(openRouterKey)) {
      return {
        maybeValidApiKey: openRouterKey,
        apiProviderToUse: kApiProviderOpenRouter,
      };
    }
    return {
      maybeValidApiKey: "",
      apiProviderToUse: kApiProviderOpenRouter,
    };
  }

  let forceBadApiKey = false; // for ad-hoc testing

  let settings = getSettings();
  let questionText = $state(startText);
  let reqFinished = $state(false);
  let err = $state("");
  let forceShowingApiKey = $state(false);
  let aiModel = $derived(findModelByID(settings.aiModelID));
  let aiModelName = $derived(aiModel[kModelNameIdx]);
  let apiProvider = $derived(apiProviderForAiModel(aiModel));
  let apiProviderOpenAI = $derived(apiProvider == kApiProviderOpenAI);
  let apiProviderXAI = $derived(apiProvider == kApiProviderXAi);
  let { maybeValidApiKey, apiProviderToUse } = $derived(
    pickApiKeyForProvider(
      apiProvider,
      settings.openAIKey,
      settings.xAIKey,
      settings.openRouterKey,
    ),
  );
  let hasAPIKey = $derived(maybeValidApiKey != "");

  const maxTokens = 10000;

  function apiProviderForAiModel(aiModel) {
    let provider = aiModel[kModelProviderIdx];
    switch (provider) {
      case kProviderOpenAI:
        return kApiProviderOpenAI;
      case kProviderXAI:
        return kApiProviderXAi;
      // case kProviderGoogle:
      //   return kApiProviderGoogle;
      default:
        return kApiProviderOpenRouter;
    }
  }

  /**
   * @type {[number, string][]}
   */
  const apiProviders = [
    [kApiProviderXAi, "https://api.x.ai/v1/chat/completions"],
    [kApiProviderOpenAI, "https://api.openai.com/v1/chat/completions"],
    [kApiProviderOpenRouter, "https://openrouter.ai/api/v1/chat/completions"],
    // [
    //   kApiProviderGoogle,
    //   "https://generativelanguage.googleapis.com/v1beta/openai/",
    // ],
    // [kApiProviderAnthropic, "https://api.anthropic.com/completions"],
  ];

  /**
   * @param {number} apiProvider
   * @returns {string}
   */
  function getApiProviderBaseURL(apiProvider) {
    for (let p of apiProviders) {
      if (p[0] == apiProvider) {
        return p[1];
      }
    }
    return "";
  }

  async function askai() {
    err = "";
    responseText = "";
    let baseURL = getApiProviderBaseURL(apiProviderToUse);
    try {
      reqFinished = false;
      reqInProgress = true;
      await streamChatGPTResponse(questionText, maybeValidApiKey, baseURL);
      // looks like a valid key, remember it
      reqFinished = true;
    } catch (e) {
      console.error(e);
      console.error(e.cause ? e.cause : "");
      err = e.toString();
      if (e.cause) {
        let r = /** @type {Request} */ (e.cause);
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
      let providerName = "unknown";
      switch (apiProviderToUse) {
        case kApiProviderOpenAI:
          providerName = "openai";
          break;
        case kApiProviderXAi:
          providerName = "xai";
          break;
        case kApiProviderOpenRouter:
          providerName = "openrouter";
          break;
      }
      logAskAI(aiModelName, providerName);
      tick().then(() => {
        btnInsertRef?.focus();
      });
    }
  }

  // heuristc. my openai keys start with "sk-proj-" and are 164 chars in length
  /**
   * @param {string} s
   * @returns {boolean}
   */
  function looksValidOpenAIKey(s) {
    // this might be fragile. the keys start with "sk-proj-" today but they
    // can change it in the future
    return s.startsWith("sk-proj-") && len(s) > 100;
  }

  // mine is 84 chars
  /**
   * @param {string} s
   * @returns {boolean}
   */
  function looksValidXAIkKey(s) {
    // this might be fragile. the keys start with "xai-" today but they
    // can change it in the future
    return s.startsWith("xai-") && len(s) > 70;
  }

  // mine is 73 chars
  /**
   * @param {string} s
   * @returns {boolean}
   */
  function looksValidOpenRouterKey(s) {
    // this might be fragile. the keys start with "sk-or-" today but they
    // can change it in the future
    return s.startsWith("sk-or-") && len(s) > 50;
  }

  let responseText = $state("");

  let reqInProgress = $state(false);
  let askAIDisabled = $derived(!hasAPIKey || reqInProgress);

  function insertRsp() {
    let s = "# Response from " + aiModelName + "\n\n" + responseText + "\n";
    insertResponse(s);
    close();
  }

  async function streamChatGPTResponse(prompt, apiKey, baseURL) {
    // console.warn("streamChatGPTResponse");

    if (forceBadApiKey) {
      apiKey = "g" + apiKey;
    }

    let modelID = settings.aiModelID;
    if (apiProvider == kApiProviderOpenRouter) {
      let providerIdx = aiModel[kModelProviderIdx];
      let prefix = providersInfo[providerIdx][0];
      modelID = prefix + "/" + modelID;
    }

    const requestBody = {
      model: modelID,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      stream: true,
    };

    const response = await fetch(baseURL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      let e = new Error(`HTTP error! status: ${response.status}`);
      e.cause = response;
      throw e;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      // console.log("chunk:", chunk);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              responseText += content;
              // console.log(content);
            }
          } catch (e) {
            // Skip invalid JSON
            console.error(e);
          }
        }
      }
    }
  }

  /**
   * @param {markdownIt} md
   */
  function addTargetBlank(md) {
    // Remember old renderer, if overridden, or proxy to default renderer
    var defaultRender =
      md.renderer.rules.link_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      // If you are using linkify to automatically detect links, you might want to
      // check if it's an external link here. You can do so based on tokens[idx].href

      // Add target="_blank" to links except the internal #foo links
      let token = tokens[idx];
      // console.log("token:", token);
      // console.log("token.attrs:", token.attrs);
      let aidx = token.attrIndex("href");
      let uri = token.attrs[aidx][1];
      if (uri.startsWith("#")) {
        // console.log("skipping uri: ", uri);
        return defaultRender(tokens, idx, options, env, self);
      }
      aidx = token.attrIndex("target");
      if (aidx < 0) {
        token.attrPush(["target", "_blank"]); // add new attribute
      } else {
        token.attrs[aidx][1] = "_blank"; // replace existing attribute
      }
      // console.log("added to uri: ", uri);
      // pass token to default renderer.
      return defaultRender(tokens, idx, options, env, self);
    };
  }

  /**
   * @param {string} md
   * @returns {string}
   */
  function mdToHTML(md) {
    let mdIt = markdownIt({
      linkify: true,
      highlight: function (str, lang) {
        try {
          if (lang && hljs && hljs.getLanguage(lang)) {
            return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
          }
        } catch (__) {}
        // fallback: escape HTML
        return `<pre class="hljs"><code>${mdIt.utils.escapeHtml(str)}</code></pre>`;
      },
    });
    mdIt.use(addTargetBlank);
    mdIt.use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.headerLink(),
    });

    let html = mdIt.render(md);
    return html;
  }

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    if (isKeyCtrlEnter(ev) && !askAIDisabled) {
      askai();
    }
  }

  /** @type {HTMLElement} */
  let btnInsertRef;
  /** @type {HTMLElement} */
  let textAreaRef;

  let showingModels = $state(false);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  tabindex="-1"
  use:trapfocus
  class="selector z-20 absolute center-x-with-translate top-[1rem] flex flex-col max-h-[78vh] w-[85vw] p-2"
>
  <div class="flex items-center">
    <div class="p-1 font-bold text-lg">Ask AI</div>
    <a target="_blank" class="ml-4 link" href="/help#ask-ai">learn more</a>
    {#if hasAPIKey}
      <button
        onclick={(ev) => {
          forceShowingApiKey = !forceShowingApiKey;
          // console.warn("forceShowingApiKey:", forceShowingApiKey);
          ev.preventDefault();
          ev.stopPropagation();
        }}
        class="ml-4 link hover:text-gray-900"
        >{forceShowingApiKey ? "hide" : "show"} api key</button
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
        class="hover:bg-gray-100 cursor-pointer px-1 relative"
      >
        {aiModelName}&nbsp;⏷
        {#if showingModels}
          <AiModels
            close={() => {
              showingModels = false;
              textAreaRef?.focus();
            }}
            selectModel={(model) => {
              settings.aiModelID = model[kModelIDIdx];
              showingModels = false;
            }}
          ></AiModels>
        {/if}
      </button>
    </div>
  </div>

  {#if forceShowingApiKey || !hasAPIKey}
    {#if apiProviderOpenAI}
      <div class="flex flex-col gap-1.5 py-1 ml-1">
        <div class="flex">
          <div class="grow">
            To use {aiModelName} you need
            <a class="link" target="_blank" href="/help#getting-openai-api-key"
              >OpenAI API Key</a
            >:
          </div>
          <a class="link" target="_blank" href="/help#getting-openai-api-key"
            >learn more</a
          >
        </div>
        <input
          placeholder="Enter OpenAI API key"
          use:focus
          bind:value={settings.openAIKey}
          class="px-1 py-[1px]"
        />
      </div>
    {/if}

    {#if apiProviderXAI}
      <div class="flex flex-col gap-1.5 py-1 ml-1">
        <div class="flex">
          <div class="grow">
            To use {aiModelName} you need
            <a
              class="link"
              target="_blank"
              href="/help#getting-xai-(grok)-api-key">xAI API Key</a
            >
            :
          </div>

          <a
            class="link"
            target="_blank"
            href="/help#getting-xai-(grok)-api-key">learn more</a
          >
        </div>
        <input
          placeholder="Enter xAI API key"
          use:focus
          bind:value={settings.xAIKey}
          class="px-1 py-[1px]"
        />
      </div>
    {/if}

    <div class="flex flex-col gap-1.5 py-1 ml-1">
      {#if apiProviderOpenAI || apiProviderXAI}
        <div class="flex">
          <div class="grow">
            Or <a
              class="link"
              target="_blank"
              href="/help#getting-openrouter-api-key">OpenRouter API Key</a
            >
            :
          </div>
          <a
            class="link"
            target="_blank"
            href="/help#getting-openrouter-api-key">learn more</a
          >
        </div>
      {:else}
        <div class="flex">
          <div class="grow">
            To use {aiModelName} you need
            <a
              class="link"
              target="_blank"
              href="/help#getting-openrouter-api-key">OpenRouter API Key</a
            >:
          </div>
          <a
            class="link"
            target="_blank"
            href="/help#getting-openrouter-api-key">learn more</a
          >
        </div>
      {/if}
      <input
        use:focus
        bind:value={settings.openRouterKey}
        placeholder="Enter OpenRouter API key"
        class="px-1 py-[1px]"
      />
    </div>
  {/if}

  <textarea
    bind:value={questionText}
    bind:this={textAreaRef}
    use:focus
    {onkeydown}
    class="mt-1 w-full min-h-[10rem] max-h-[70vh] field-sizing-content border border-gray-950/20 outline-gray-950/50 p-1.5"
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
    <div
      class="flex mt-2 text-red-600 px-2 py-[2px] whitespace-pre-line overflow-auto"
    >
      {err}
    </div>
  {/if}
  <div class="flex mt-2 items-center">
    {#if !hasAPIKey}
      <div class=" text-red-600 ml-2 whitespace-pre-line overflow-auto">
        Need a valid API key
      </div>
      <a target="_blank" class="ml-2 link" href="/help#ask-ai">learn more</a>
    {/if}
    {#if reqInProgress}
      <div class="ml-2 font-bold">thinking...</div>
    {:else}{/if}
    <div class="grow"></div>
    <button
      bind:this={btnInsertRef}
      onclick={insertRsp}
      class="button-outline {reqFinished ? 'visible' : 'invisible'}"
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
