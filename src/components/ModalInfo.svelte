<script module lang="ts">
  import { onMount } from "svelte";
  import { len } from "../util";

  /** @type {Timer} */
  let timerID;

  class ModalInfoState {
    isShowing = $state(false);
    messages = $state([]);
    /** @type {HTMLElement} */
    listBoxRef = $state(null);
    title = $state("");
    canClose = $state(false);

    /** @type {HTMLElement} */
    overlayRef = $state(null);
    /** @type {HTMLButtonElement} */
    closeButtonRef = $state(null);

    /**
     * @param {string} msgHTML
     */
    addMessage(msgHTML) {
      this.messages.unshift(msgHTML);
      this.isShowing = true;
      // scroll to bottom
      if (this.listBoxRef) {
        // this.listBoxRef.scrollTop = this.listBoxRef.scrollHeight;
      }
    }

    /**
     * @param {string} msgHTML
     * @param {number} delay
     */
    addMessageDeilayed(msgHTML, delay) {
      clearTimeout(timerID);
      timerID = null;
      if (delay <= 0) {
        this.addMessage(msgHTML);
        return;
      }
      timerID = setTimeout(() => {
        this.addMessage(msgHTML);
      }, delay);
    }

    clear() {
      this.messages = [];
      clearTimeout(timerID);
      timerID = null;
    }

    hide() {
      this.isShowing = false;
    }
    show() {
      this.isShowing = true;
    }
  }

  export let modalInfoState = new ModalInfoState();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<script lang="ts">
  import { focus, smartfocus, trapfocus } from "../actions";

  let msg = "Auto added message";
  function autoAddMessage() {
    setTimeout(() => {
      let n = len(modalInfoState.messages) + 1;
      modalInfoState.addMessage(`${msg}`);
      if (n < 14) {
        msg += " lalabore";
      }
      if (n < 100) {
        autoAddMessage();
      }
    }, 200);
  }

  onMount(() => {
    // autoAddMessage();
  });

  $effect(() => {
    if (modalInfoState && modalInfoState.canClose) {
      modalInfoState.closeButtonRef.focus();
    }
  });

  function maybeClose() {
    if (modalInfoState.canClose) {
      modalInfoState.hide();
    }
  }

  /**
   * @param {MouseEvent} ev
   */
  function onclick(ev) {
    if (ev.target === modalInfoState.overlayRef) {
      maybeClose();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  {onclick}
  bind:this={modalInfoState.overlayRef}
  tabindex="-1"
  use:smartfocus
  use:trapfocus
  class="fixed inset-0 overflow-hidden z-10 bg-blur flex flex-col justify-center items-center"
>
  <div
    class="w-fit h-[60ch] max-h-[80vh] min-w-[40ch] max-w-[90vw] flex flex-col bg-white px-4 py-4"
  >
    <div class="text-lg font-semibold py-2 pl-4 self-center">
      {modalInfoState.title}
    </div>

    <div
      bind:this={modalInfoState.listBoxRef}
      class="w-fit grow flex flex-col-reverse overflow-scroll px-2 py-4"
    >
      {#each modalInfoState.messages as message, idx (idx)}
        <div class="text-sm px-4">
          {@html message}
        </div>
      {/each}
    </div>
    {#if modalInfoState.canClose}
      <div class="flex justify-end py-2">
        <button
          bind:this={modalInfoState.closeButtonRef}
          class="button-outline"
          onclick={maybeClose}>Close</button
        >
      </div>
    {/if}
  </div>
</div>

<style>
  @reference "../main.css";

  .bg-blur {
    @apply dark:bg-gray-400/30 bg-black/50;
  }
</style>
