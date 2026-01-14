<script lang="ts">
  let {
    message,
    undoAction,
    undoText,
  }: {
    message: string;
    undoAction: (ev: any) => void;
    undoText: string;
  } = $props();
</script>

<div class="flex self-center grow justify-between items-center my-1 pl-2">
  <div class="">
    {message}
  </div>
  <button
    onclick={undoAction}
    class="border border-white px-2 py-1 hover:bg-white hover:text-blue-600"
  >
    {undoText || "Undo"}
  </button>
</div>
