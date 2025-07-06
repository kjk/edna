<script>
  import { tick } from "svelte";
  import { focus } from "../actions";
  import { getSettings } from "../settings.svelte";
  import { len } from "../util";

  /** @type {{
    close: () => void,
    startText: string,
    insertResponse: (string) => void,
}}*/
  let { close, startText, insertResponse } = $props();

  let questionText = $state(startText);
  let reqFinished = $state(false);
  let err = $state("");
  let aiModel = "gpt-3.5-turbo";
  const maxTokens = 1000;

  async function askai() {
    console.warn("askai");
    err = "";
    settings.openAIKey = settings.openAIKey.trim();
    openAIKey = openAIKey.trim();
    let apiKey = "";
    if (looksValidOpenAIKey(settings.openAIKey)) {
      apiKey = settings.openAIKey;
    } else if (looksValidOpenAIKey(openAIKey)) {
      apiKey = openAIKey;
    } else {
      throw new Error(`no openai api key`);
    }

    let ok = true;
    try {
      reqFinished = false;
      reqInProgress = true;
      await streamChatGPTResponse(questionText, apiKey);
      // looks like a valid key, remember it
      reqFinished = true;
      if (!looksValidOpenAIKey(settings.openAIKey)) {
        settings.openAIKey = apiKey;
      }
    } catch (e) {
      console.error(e);
      ok = false;
      err = e.toString();
    } finally {
      reqInProgress = false;
    }
    if (ok) {
      tick().then(() => {
        if (btnInsertRef) {
          btnInsertRef.focus();
        } else {
          console.warn("NO btnInsertRef");
        }
      });
    }
  }

  let settings = getSettings();
  let openAIKey = $state("");
  // heuristc. my openai keys start with "sk-proj-" and are 164 chars in length
  function looksValidOpenAIKey(s) {
    return len(s) > 100;
  }

  let responseText = $state("");

  let canSendRequest = $derived(
    looksValidOpenAIKey(settings.openAIKey) || looksValidOpenAIKey(openAIKey),
  );

  let reqInProgress = $state(false);
  let askAIDisabled = $derived(!canSendRequest || reqInProgress);

  function insertRsp() {
    let s = "# Response from " + aiModel + "\n\n" + responseText + "\n";
    insertResponse(s);
    close();
  }

  async function streamChatGPTResponse(prompt, apiKey) {
    console.warn("streamChatGPTResponse");

    const requestBody = {
      model: aiModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
    };

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        console.log("chunk:", chunk);
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
    } catch (error) {
      console.error("Error:", error.message);
    }
    console.warn("finished");
  }

  /** @type {HTMLElement} */
  let btnInsertRef;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  tabindex="-1"
  class="selector z-20 absolute center-x-with-translate top-[2rem] flex flex-col max-h-[80vh] w-[75vw] p-2"
>
  <div class="p-1 font-bold text-lg">Ask AI</div>
  <textarea
    bind:value={questionText}
    use:focus
    class="w-full min-h-[10rem] max-h-[70vh] field-sizing-content border border-gray-950/20 outline-gray-950/50 p-1.5"
  ></textarea>
  {#if settings.openAIKey == ""}
    <div class="flex py-1 text-sm items-center">
      <div>OpenAI API Key:</div>
      <input bind:value={openAIKey} class="ml-2 grow px-1 py-[2px]" />
    </div>
  {/if}
  <div class="flex py-1 text-sm">
    <div>model: {aiModel}</div>
  </div>
  {#if len(responseText) > 0}
    <div
      tabindex="-1"
      class="mt-2 font-mono whitespace-pre-wrap h-auto w-full overflow-auto border border-gray-950/20 outline-gray-950/20 p-1.5"
    >
      {responseText}
    </div>
  {/if}
  {#if err}
    <div class="flex mt-2 text-red-600 px-2 py-[2px]">
      {err}
    </div>
  {/if}
  <div class="flex mt-2">
    {#if reqInProgress}
      <div>thinking...</div>
    {/if}
    <div class="grow"></div>
    <button
      bind:this={btnInsertRef}
      onclick={insertRsp}
      class="button-outline {reqFinished ? 'visible' : 'invisible'}"
      >Insert response as block</button
    >
    <button onclick={close} class="button-outline ml-2">Cancel</button>
    <button onclick={askai} disabled={askAIDisabled} class="ml-2 button-outline"
      >Ask AI</button
    >
  </div>
</form>
