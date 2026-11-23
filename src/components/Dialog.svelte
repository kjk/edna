<script lang="ts">
  import type { Snippet } from "svelte";

  // centered dialog box shell shared by simple input dialogs
  interface Props {
    onkeydown: (ev: KeyboardEvent) => void;
    tabindex?: number;
    children: Snippet;
  }
  let { onkeydown, tabindex = -1, children }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  {tabindex}
  {onkeydown}
  class="dlg z-20 absolute center-x-with-translate top-16 flex flex-col max-w-full p-3"
>
  {@render children()}
</div>
