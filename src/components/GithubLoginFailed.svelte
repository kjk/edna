<script>
  import { onMount } from "svelte";

  let err;

  onMount(() => {
    console.log("onMount");
    let q = new URLSearchParams(window.location.search);
    err = q.get("err");
  });
</script>

<div class="flex flex-col items-center mt-4 text-lg">
  <div class="font-semibold">GitHub Login failed.</div>

  {#if err}
    <div>Error: <span class="text-red-500 font-bold">{err}</span></div>
  {/if}

  <a href="/" class="underline mt-4">Home</a>
</div>
