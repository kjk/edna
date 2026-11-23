<script lang="ts">
  import type { Snippet } from "svelte";
  import { focus } from "../actions";
  import { submitOnEnter } from "../util";
  import Dialog from "./Dialog.svelte";

  // dialog for entering a note name (create, rename)
  interface Props {
    name: string;
    errorHTML: string; // shown when !canSubmit
    canSubmit: boolean;
    submit: () => void;
    header: Snippet;
    status: Snippet; // shown when canSubmit
    buttons: Snippet;
  }
  let { name = $bindable(), errorHTML, canSubmit, submit, header, status, buttons }: Props = $props();
</script>

<Dialog tabindex={0} onkeydown={(ev) => submitOnEnter(ev, canSubmit, submit)}>
  {@render header()}
  <input bind:value={name} use:focus class="py-1 px-2 bg-white mt-2 rounded-xs w-[80ch]" />
  <div class=" text-sm mt-2">
    {#if canSubmit}
      {@render status()}
    {:else}
      <span class="text-red-500">{@html errorHTML}</span>
    {/if}
  </div>
  <div class="flex justify-end mt-2">
    {@render buttons()}
  </div>
</Dialog>
