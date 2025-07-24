<script module>
  import { onMount } from "svelte";
  import { len } from "../util";

  /** @type {Timer} */
  let timerID;

  class ModalInfoState {
    isShowing = $state(false);
    messages = $state([]);
    /** @type {HTMLElement} */
    listBoxRef = $state(null);

    /**
     * @param {string} msgHTML
     */
    addMsg(msgHTML) {
      this.messages.push(msgHTML);
      this.isShowing = true;
      // scroll to bottom
      if (this.listBoxRef) {
        this.listBoxRef.scrollTop = this.listBoxRef.scrollHeight;
      }
    }
    /**
     * @param {string} msgHTML
     * @param {number} delay
     */
    addMessage(msgHTML, delay = 0) {
      clearTimeout(timerID);
      timerID = null;
      if (delay <= 0) {
        this.addMsg(msgHTML);
        return;
      }
      timerID = setTimeout(() => {
        this.addMsg(msgHTML);
      }, delay);
    }

    hide() {
      this.messages = [];
      clearTimeout(timerID);
      timerID = null;
      this.isShowing = false;
    }
  }

  export let modalInfoState = new ModalInfoState();
</script>

<script>
  import { focus, smartfocus, trapfocus } from "../actions";

  function autoAddMessage() {
    setTimeout(() => {
      let n = len(modalInfoState.messages) + 1;
      modalInfoState.addMessage(`Auto-added message ${n}`);
      if (n < 100) {
        autoAddMessage();
      }
    }, 1000);
  }

  onMount(() => {
    // autoAddMessage();
  });
</script>

<div class="fixed inset-0 overflow-hidden">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="z-10" tabindex="-1" use:smartfocus use:trapfocus>
    <form
      class="selector center-x-with-translate z-20 absolute top-[2rem] min-w-[75vw] h-[20vh] max-h-[40vh]"
    >
      <div
        bind:this={modalInfoState.listBoxRef}
        class="bg-white overflow-y-auto px-2 py-4 max-h-[100%]"
      >
        {#each modalInfoState.messages as message, idx (idx)}
          <div class="text-sm text-black px-4">
            {@html message}
          </div>
        {/each}
      </div>
    </form>
  </div>
  <!-- this captures the click outside of the actual element -->
  <button class="absolute inset-0 z-10" class:bg-blur={true} aria-label="close"
  ></button>
</div>

<style>
  @reference "../main.css";

  .bg-blur {
    @apply dark:bg-gray-400/30 bg-black/50;
  }
</style>
