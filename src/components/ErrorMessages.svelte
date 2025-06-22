<script>
  import { useErrorStore } from "../stores/error-store.svelte";

  const errorStore = useErrorStore();

  function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural;
  }

  // $effect(() => {
  //   console.log("errorStore.errors:", $state.snapshot(errorStore.errors));
  // });
</script>

{#if errorStore.errors && errorStore.errors.length > 0}
  <div class="fixed inset-0">
    <div
      class="box-border z-[2] absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[200px] max-w-full max-h-full flex flex-col rounded-[5px] bg-white text-gray-800 shadow-[0_0_25px_rgba(0,0,0,0.2)] overflow-y-auto focus:border-none focus:outline-none focus-visible:border-none focus-visible:outline-none active:border-none active:outline-none dark:bg-gray-800 dark:text-gray-200 dark:shadow-[0_0_25px_rgba(0,0,0,0.3)]"
    >
      <div class="flex-grow p-[30px]">
        <h1 class="text-sm font-bold block mb-4">Error</h1>
        <p>
          {errorStore.errors[0]}
        </p>
      </div>
      <div
        class="rounded-b-[5px] bg-gray-200 px-5 py-2.5 flex items-center dark:bg-gray-900"
      >
        <div class="flex-grow">
          {#if errorStore.errors.length > 1}
            <div class="count">
              {errorStore.errors.length - 1} more {pluralize(
                errorStore.errors.length - 1,
                "error",
                "errors",
              )}
            </div>
          {/if}
        </div>
        <button onclick={() => errorStore.popError()} class="h-7">Close</button>
      </div>
    </div>
    <div class="z-[1] absolute inset-0 bg-black/50"></div>
  </div>
{/if}
