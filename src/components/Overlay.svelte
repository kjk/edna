<script>
  import { smartfocus, trapfocus } from "../actions";
  import { throwIf } from "../util";

  /**
   * @type {{
   onclose?: () => void, // if given, will call it when clicked on overlay (but not on children)
   noCloseOnEsc?: boolean, // disable close() on Esc
   children: Function,
   blur?: boolean,
}} */
  let {
    onclose = null,
    noCloseOnEsc = false,
    blur = false,
    children,
  } = $props();

  // if noCloseOnEsc is false, we must have onclose
  throwIf(!onclose && !noCloseOnEsc);

  /**
   * @param {MouseEvent} ev
   */
  function onclick(ev) {
    // console.log("onclick", ev);
    if (!onclose) {
      return;
    }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    onclose();
  }

  function onkeydown(ev) {
    // console.log("onkeydown:", ev);
    if (!onclose || noCloseOnEsc) {
      return;
    }
    let key = ev.key;
    if (key === "Escape") {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      onclose();
      return;
    }
  }
</script>

<div class="fixed inset-0 overflow-hidden">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="z-10" {onkeydown} tabindex="-1" use:smartfocus use:trapfocus>
    {@render children()}
  </div>
  <!-- this captures the click outside of the actual element -->
  <button
    {onclick}
    class="absolute inset-0 z-10"
    class:bg-blur={blur}
    aria-label="close"
  ></button>
</div>

<style>
  @reference "../main.css";

  .bg-blur {
    @apply dark:bg-gray-400/30 bg-black/50;
  }
</style>
