<script module>
  let modalMessageHTML = $state("");
  /** @type {Timer} */
  let timerID;

  class ModalMessageState {
    isShowing = $state(false);
  }

  export let modalMessageState = new ModalMessageState();

  /**
   * @param {string} msgHTML
   * @param {number} delay
   */
  export function showModalMessageHTML(msgHTML, delay) {
    clearTimeout(timerID);
    timerID = null;
    if (delay <= 0) {
      modalMessageHTML = msgHTML;
      modalMessageState.isShowing = msgHTML != "";
      return;
    }
    timerID = setTimeout(() => {
      modalMessageHTML = msgHTML;
      modalMessageState.isShowing = msgHTML != "";
    }, delay);
  }

  export function clearModalMessage() {
    modalMessageHTML = "";
    clearTimeout(timerID);
    timerID = null;
    modalMessageState.isShowing = false;
  }
</script>

<form
  tabindex="-1"
  class="fixed flex justify-center items-center z-30 pointer-events-none select-none inset-0 bg-black bg-opacity-20"
>
  <button class="bg-white focus:outline-hidden min-w-[75vw]">
    <div class="text-lg text-black px-4 py-2 text-center">
      {@html modalMessageHTML}
    </div>
  </button>
</form>
