<script lang="ts">
  import { onMount } from "svelte";
  import { focus } from "../actions";
  import { convertArgValues, type ArgSpec } from "../functions";
  import Dialog from "./Dialog.svelte";

  // form for entering arguments of a function (#60)
  interface Props {
    title: string; // name of the function
    specs: ArgSpec[];
    // values converted to their types, or null if cancelled
    onanswer: (values: Record<string, string | number | boolean> | null) => void;
  }
  let { title, specs, onanswer }: Props = $props();

  // svelte-ignore state_referenced_locally
  let raw: Record<string, string | boolean> = $state(Object.fromEntries(specs.map((s) => [s.name, s.type === "boolean" ? false : ""])));
  let error = $state("");

  onMount(() => {
    let el = document.getElementById("fn-arg-0");
    if (el) {
      focus(el);
    }
  });

  function submit() {
    let res = convertArgValues(specs, raw);
    if ("error" in res) {
      error = res.error;
      return;
    }
    onanswer(res.values);
  }

  function onkeydown(ev: KeyboardEvent) {
    if (ev.key !== "Enter") {
      return;
    }
    // Enter in a multi-line input adds a new line, Ctrl + Enter submits
    let inTextArea = (ev.target as HTMLElement).tagName === "TEXTAREA";
    if (inTextArea && !(ev.ctrlKey || ev.metaKey)) {
      return;
    }
    ev.preventDefault();
    submit();
  }
</script>

<Dialog {onkeydown}>
  <div class="text-lg mb-2">{title}</div>
  <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-baseline">
    {#each specs as spec, i (spec.name)}
      <label for="fn-arg-{i}" class="font-semibold whitespace-nowrap">{spec.name}</label>
      <div class="flex flex-col">
        {#if spec.type === "boolean"}
          <input id="fn-arg-{i}" type="checkbox" class="self-start" bind:checked={raw[spec.name] as boolean} />
        {:else if spec.type === "text"}
          <textarea id="fn-arg-{i}" rows="4" class="py-1 px-2 bg-white border border-gray-300 dark:border-gray-600 rounded-xs w-[60ch] max-w-[80vw]" bind:value={raw[spec.name]}
          ></textarea>
        {:else}
          <input
            id="fn-arg-{i}"
            type="text"
            inputmode={spec.type === "number" ? "decimal" : undefined}
            class="py-1 px-2 bg-white rounded-xs w-[60ch] max-w-[80vw]"
            bind:value={raw[spec.name]}
          />
        {/if}
        {#if spec.description}
          <div class="text-sm text-gray-500 dark:text-gray-400">{spec.description}</div>
        {/if}
      </div>
    {/each}
  </div>
  {#if error}
    <div class="text-red-500 mt-2">{error}</div>
  {/if}
  <div class="flex mt-3">
    <div class="grow"></div>
    <button onclick={() => onanswer(null)} class="mr-4 px-4 py-1 border border-black hover:bg-gray-100">Cancel</button>
    <button onclick={submit} class="px-4 py-1 border border-black hover:bg-gray-100">Run</button>
  </div>
</Dialog>
