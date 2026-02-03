<script module lang="ts">
  /**
   * @typedef {Object} Toast
   * @property {string} msg
   * @property {number} id
   * @property {number} type
   * @property {number} timeoutMs
   */

  export let defaultTimeout = 4000;
  const kToastRegular = 0;
  const kToastWarning = 1;
  const kToastError = 1;

  /** @type {Toast[]} */
  let toasts = $state([]);

  let nextId = 0;

  /**
   * @param {number} id
   */
  function removeToast(id) {
    console.log("removeToast:", id);
    let idx = -1;
    for (let i = 0; i < len(toasts); i++) {
      if (toasts[i].id === id) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      // it's ok, can be called by timer but was removed manually
      return;
    }
    toasts.splice(idx, 1);
  }

  /**
   * @param {string} msg
   * @param {number} [timeoutMs]
   */
  export function showWarning(msg, timeoutMs = -1) {
    showToastEx(msg, kToastWarning, timeoutMs);
  }

  /**
   * @param {string} msg
   * @param {number} [timeoutMs]
   */
  export function showError(msg, timeoutMs = -1) {
    showToastEx(msg, kToastError, timeoutMs);
  }

  /**
   * @param {string} msg
   * @param {number} [timeoutMs]
   */
  export function showToast(msg, timeoutMs = -1) {
    showToastEx(msg, kToastRegular, timeoutMs);
  }

  /**
   * @param {string} msg
   * @param {number} type
   * @param {number} [timeoutMs]
   */
  function showToastEx(msg, type, timeoutMs = -1) {
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
  import { len } from "../util";
  import { getScrollbarWidth } from "../util";

  let style = $state("");
  $effect(() => {
    let dx = getScrollbarWidth();
    style = `right: ${dx}px`;
  });
  if (false) {
    showToast("hello");
    showWarning("what is my purpose", 500);
    showError("this is my ever-lasting love");
    // showToast(
    //   "this is a vary, vyer, very, very long toast of london and munification so why are we even considering this as if this is not concernings on every level",
    //   0,
    // );
  }
  function bgClass(type) {
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
  <div class="toast-wrap fixed top-10 right-[19px] text-sm" {style}>
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
