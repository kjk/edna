<script lang="ts">
  interface Props {
    class?: string;
  }
  let { class: klass = "" }: Props = $props();
</script>

<div class="flex items-center justify-center h-full w-full {klass}">
  <span class="text-2xl">Hello</span>
</div>
