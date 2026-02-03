<script lang="ts">
  interface Props {
    message: string;
    undoAction: (ev: Event) => void;
    undoText: string;
  }
  let { message, undoAction, undoText }: Props = $props();
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
