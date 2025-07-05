<script>
  import { focus } from "../actions";

  let { close, startText } = $props();

  function askai() {
    console.warn("askai");
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form
  tabindex="-1"
  class="selector z-20 absolute center-x-with-translate top-[2rem] flex flex-col max-h-[90vh] w-[75vw] p-2"
>
  <div class="p-1">AskAI</div>
  <textarea
    use:focus
    class="w-full min-h-[10rem] max-h-[70vh] field-sizing-content border border-gray-950/20 outline-gray-950/20 p-1.5"
    >{startText}</textarea
  >
  <div class="flex justify-end mt-2">
    <button onclick={close} class="button-outline">Cancel</button>
    <button onclick={askai} class="button-outline">Ask AI</button>
  </div>
</form>
