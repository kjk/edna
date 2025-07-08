<script>
  import { tick } from "svelte";
  import { focus, trapfocus } from "../actions";
  import {
    kModelIDIdx,
    kModelNameIdx,
    kModelProviderIdx,
    kProviderOpenAI,
    kProviderXAI,
    providersInfo,
  } from "../models-short";
  import { findModelByID, getSettings } from "../settings.svelte";
  import { isKeyCtrlDelete, isKeyCtrlEnter, len } from "../util";
  import AiModels from "./AiModels.svelte";

  /** @type {{
    close: () => void,
    startText: string,
    insertResponse: (string) => void,
}}*/
  let { close, startText, insertResponse } = $props();

  const kApiProviderOpenAI = 0;
  const kApiProviderGrok = 1;
  const kApiProviderOpenRouter = 2;
  // const kApiProviderAnthropic = 3;
  // const kApiProviderGoogle = 3;

  function pickApiKeyForProvider(apiProvider) {
    switch (apiProvider) {
      case kApiProviderOpenAI:
        return settings.openAIKey;
      case kApiProviderGrok:
        return settings.grokKey;
      // case kApiProviderAnthropic:
      //   return settings.anthropicKey;
      case kApiProviderOpenRouter:
        return settings.openRouterKey;
      // case kApiProviderGoogle:
      //   return settings.googleAIKey;
      default:
        throw new Error(`no api key for `);
    }
  }

  let forceBadApiKey = false;

  let settings = getSettings();
  let questionText = $state(startText);
  let reqFinished = $state(false);
  let useOpenRouter = $state(false);
  let err = $state("");
  let forceShowingApiKey = $state(false);
  let aiModel = $derived(findModelByID(settings.aiModelID));
  let aiModelName = $derived(aiModel[kModelNameIdx]);
  let apiProvider = $derived(apiProviderForAiModel(aiModel, false));
  let needsOpenAPIKey = $derived(
    apiProvider == kApiProviderOpenAI &&
      (forceShowingApiKey || err || !looksValidOpenAIKey(settings.openAIKey)),
  );
  let needsGrokAPIKey = $derived(
    apiProvider == kApiProviderGrok &&
      (forceShowingApiKey || err || !looksValidGrokKey(settings.grokKey)),
  );
  // let needsGoogleAPIKey = $derived(
  //   apiProvider == kApiProviderGoogle &&
  //     (forceShowingApiKey || err || !looksValidGrokKey(settings.googleAIKey)),
  // );
  let needsOpenRouterAPIKey = $derived(
    (apiProvider == kApiProviderOpenRouter || useOpenRouter) &&
      (forceShowingApiKey || err || !looksValidGrokKey(settings.openRouterKey)),
  );
  let apiKey = $derived(pickApiKeyForProvider(apiProvider));

  const maxTokens = 1000;

  function apiProviderForAiModel(aiModel, ignoreUserOpenRouter = false) {
    if (!ignoreUserOpenRouter && useOpenRouter) {
      return kApiProviderOpenRouter;
    }
    let provider = aiModel[kModelProviderIdx];
    switch (provider) {
      case kProviderOpenAI:
        return kApiProviderOpenAI;
      case kProviderXAI:
        return kApiProviderGrok;
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
    [kApiProviderGrok, "https://api.x.ai/v1/chat/completions"],
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
    // console.warn("askai");
    err = "";
    let baseURL = getApiProviderBaseURL(apiProvider);
    try {
      reqFinished = false;
      reqInProgress = true;
      await streamChatGPTResponse(questionText, apiKey, baseURL);
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
      tick().then(() => {
        btnInsertRef?.focus();
      });
    }
  }

  // heuristc. my openai keys start with "sk-proj-" and are 164 chars in length
  function looksValidOpenAIKey(s) {
    return len(s) > 100;
  }

  // mine is 84 chars
  function looksValidGrokKey(s) {
    return len(s) > 70;
  }

  // mine is 39 chars
  // function looksValidGoogleKey(s) {
  //   return len(s) > 30;
  // }

  function looksValidKey(apiKey) {
    switch (apiProvider) {
      case kApiProviderOpenAI:
        return looksValidOpenAIKey(apiKey);
      case kApiProviderGrok:
        return looksValidGrokKey(apiKey);
      // case kApiProviderAnthropic:
      //   return looksValidAnthropicKey(apiKey);
      // case kApiProviderGoogle:
      //   return looksValidGoogleKey(apiKey);
    }
    return true;
  }

  let responseText = $state("");

  let canSendRequest = $derived(looksValidKey(apiKey));

  let reqInProgress = $state(false);
  let askAIDisabled = $derived(!canSendRequest || reqInProgress);

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
      temperature: 0.7,
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
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    if (isKeyCtrlEnter(ev) && !askAIDisabled) {
      askai();
    }
  }

  /** @type {HTMLElement} */
  let btnInsertRef;

  let showingModels = $state(false);
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  tabindex="-1"
  use:trapfocus
  class="selector z-20 absolute center-x-with-translate top-[1rem] flex flex-col max-h-[78vh] w-[85vw] p-2"
>
  <div class="flex items-center">
    <div class="p-1 font-bold text-lg">Ask AI</div>
    <a
      target="_blank"
      class="ml-4 button-link"
      href="help#quick-access-ui-for-starred%2C-recent-notes">learn more</a
    >
    <button
      onclick={(ev) => {
        forceShowingApiKey = !forceShowingApiKey;
        // console.warn("forceShowingApiKey:", forceShowingApiKey);
        ev.preventDefault();
        ev.stopPropagation();
      }}
      class="ml-4 button-link hover:text-gray-900"
      >{forceShowingApiKey ? "hide" : "show"} api key</button
    >
    {#if apiProviderForAiModel(aiModel, true) != kApiProviderOpenRouter}
      <label
        class="mt-1 ml-4 flex select-none whitespace-nowrap"
        title="Use OpenRouter instead of Grok / OpenAI APIs"
      >
        <input type="checkbox" bind:checked={useOpenRouter} />
        <div class="ml-1.5">Use OpenRouter</div>
      </label>
    {/if}
    <div class="grow"></div>
    <div class="flex ml-1 mt-2 items-baseline">
      <div class="px-1">model:</div>
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

  {#if needsOpenAPIKey && !useOpenRouter}
    <div class="flex py-1 items-center ml-1">
      <div>OpenAI API Key:</div>
      <input
        use:focus
        bind:value={settings.openAIKey}
        class="ml-2 grow px-1 py-[1px]"
      />
    </div>
  {/if}

  {#if needsGrokAPIKey && !useOpenRouter}
    <div class="flex py-1 items-center ml-1">
      <div>Grok API Key:</div>
      <input
        use:focus
        bind:value={settings.grokKey}
        class="ml-2 grow px-1 py-[1px]"
      />
    </div>
  {/if}

  {#if needsOpenRouterAPIKey}
    <div class="flex py-1 items-center ml-1">
      <div>OpenRouter API Key:</div>
      <input
        use:focus
        bind:value={settings.openRouterKey}
        class="ml-2 grow px-1 py-[1px]"
      />
    </div>
  {/if}

  <textarea
    bind:value={questionText}
    use:focus
    {onkeydown}
    class="mt-1 w-full min-h-[10rem] max-h-[70vh] field-sizing-content border border-gray-950/20 outline-gray-950/50 p-1.5"
  ></textarea>
  {#if len(responseText) > 0}
    <div
      tabindex="-1"
      class="mt-2 font-mono whitespace-pre-wrap h-auto w-full overflow-auto border border-gray-950/20 outline-gray-950/20 p-1.5"
    >
      {responseText}
    </div>
  {/if}
  {#if err}
    <div
      class="flex mt-2 text-red-600 px-2 py-[2px] whitespace-pre-line overflow-auto"
    >
      {err}
    </div>
  {/if}
  <div class="flex mt-2 items-center">
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
      >Ask AI</button
    >
    <button onclick={close} class="button-outline ml-2"
      >{#if reqFinished}Close{:else}Cancel{/if}</button
    >
  </div>
</form>
