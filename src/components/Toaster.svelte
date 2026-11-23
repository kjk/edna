<script module lang="ts">
  interface Toast {
    msg: string;
    id: number;
    type: number;
    timeoutMs: number;
  }

  export let defaultTimeout = 4000;
  const kToastRegular = 0;
  const kToastWarning = 1;
  const kToastError = 2;

  let toasts: Toast[] = $state([]);

  let nextId = 0;

  function removeToast(id: number) {
    // it's ok if not found: can be called by timer after it was removed manually
    arrayRemoveAt(toasts, toasts.findIndex((t) => t.id === id));
  }

  // runs save(); on failure shows an error (naming the note if given) and returns false
  export async function saveOrShowError(save: () => Promise<unknown>, noteName?: string): Promise<boolean> {
    try {
      await save();
      return true;
    } catch (e) {
      showSaveError(e, noteName);
      return false;
    }
  }

  export function showSaveError(e: unknown, noteName?: string) {
    let name = noteName ? ` '${noteName}'` : "";
    showError(`Failed to save note${name}: ${e}`);
  }

  // messages of toasts currently shown (for tests)
  export function getToastMessages(): string[] {
    return toasts.map((t) => t.msg);
  }

  export function showWarning(msg: string, timeoutMs: number = -1) {
    showToastEx(msg, kToastWarning, timeoutMs);
  }

  export function showError(msg: string, timeoutMs: number = -1) {
    showToastEx(msg, kToastError, timeoutMs);
  }

  export function showToast(msg: string, timeoutMs: number = -1) {
    showToastEx(msg, kToastRegular, timeoutMs);
  }

  function showToastEx(msg: string, type: number, timeoutMs: number = -1) {
    if (timeoutMs < 0) {
      timeoutMs = defaultTimeout;
    }
    nextId++;
    let t = {
      msg: msg,
      type: type,
      id: nextId,
      timeoutMs: timeoutMs,
    };
    toasts.push(t);
    if (timeoutMs > 0) {
      // could remember timer on Toast and clear on manual removal
      // but not necessary
      setTimeout(() => {
        removeToast(t.id);
      }, timeoutMs);
    }
  }
</script>

<script lang="ts">
  import { arrayRemoveAt, len, scrollbarOffsetStyle } from "../util";

  let style = $state("");
  $effect(() => {
    style = scrollbarOffsetStyle();
  });
  function bgClass(type: number) {
    let res = "bg-white dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-500";
    if (type === kToastWarning) {
      res = "bg-yellow-100 dark:bg-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-500";
    }
    if (type === kToastError) {
      res =
        "bg-yellow-100 dark:bg-gray-700 text-red-500 dark:text-red-300 border-gray-300 dark:border-gray-500 font-semibold";
    }
    return res;
  }
</script>

{#if len(toasts) > 0}
  <div class="toast-wrap fixed top-10 right-4.75 text-sm" {style}>
    {#each toasts as t}
      <div
        class="flex justify-between items-center mb-4 border rounded-md py-2 pl-4 pr-2 min-w-[14ch] {bgClass(t.type)}"
      >
        <div class="">
          {t.msg}
        </div>
        <button class="px-2 py-0.5 ml-2 hover:bg-gray-200" onclick={() => removeToast(t.id)}>x</button>
      </div>
    {/each}
  </div>
{/if}

<style lang="postcss">
  .toast-wrap {
    max-width: calc(min(120ch, 40%));
  }
</style>
