<script lang="ts">
  import { focus } from "../actions";
  import { getNotesCount } from "../notes";
  import { len } from "../util";

  /** @type { {
    onclose: () => void,
    onpassword: (newName: string) => void,
}}*/
  let { onclose, onpassword } = $props();

  let password = $state("");

  let validPassword = $derived.by(() => {
    return len(password.trim()) >= 8;
  });
  let pwdError = $derived.by(() => {
    if (len(password.trim()) > 8) {
      return "";
    }
    return "password must be at least 8 characters long";
  });

  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    let key = ev.key;

    if (key === "Enter") {
      emitGotPassword();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
  }

  function emitGotPassword() {
    onpassword(password);
  }
  let hidePassword = $state(true);

  /** @type {HTMLElement} */
  let inputRef;
  function onchange(ev) {
    inputRef.focus();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  tabindex="-1"
  {onkeydown}
  class="selector z-20 absolute center-x-with-translate top-[4rem] flex flex-col max-w-full p-3"
>
  <div class="text-lg">Enter password to encrypt files:</div>
  <input
    bind:this={inputRef}
    bind:value={password}
    type={hidePassword ? "password" : "text"}
    use:focus
    class="py-1 px-2 bg-white mt-2 rounded-xs w-[80ch]"
  />
  <label class="mt-2 ml-1.5">
    <input type="checkbox" bind:checked={hidePassword} {onchange} />
    Hide password
  </label>
  {#if pwdError}
    <div class="text-red-500 mt-2 ml-1">{pwdError}</div>
  {:else}
    <div class="mt-2 ml-1 font-bold">Note: if you lose the password, you'll lose access to notes.</div>
  {/if}
  <div class="flex items-baseline mt-2">
    <a target="_blank" href="/help#encryption" class="ml-1 text-lg link text-blue-700">about encryption</a>
    <div class="grow"></div>
    <button onclick={onclose} class="mr-4 px-4 py-1 border border-black hover:bg-gray-100">Cancel</button>
    <button
      onclick={() => emitGotPassword()}
      disabled={!validPassword}
      class="px-4 py-1 border border-black hover:bg-gray-100 disabled:hover:bg-white disabled:text-gray-400 disabled:border-gray-400 default:bg-slate-700"
      >Encrypt {getNotesCount()} notes</button
    >
  </div>
</div>

<style lang="postcss">
  input[type="checkbox"] {
    position: relative;
    top: 2px;
    left: -3px;
  }
</style>
