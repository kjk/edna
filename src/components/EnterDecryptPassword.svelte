<script lang="ts">
  import { focus } from "../actions";
  import { len } from "../util";

  interface Props {
    msg: string;
    onpassword: (newName: string) => void;
  }
  let { msg, onpassword }: Props = $props();

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

  function onkeydown(ev: KeyboardEvent) {
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

  let inputRef: HTMLElement;
  function onchange(ev: Event) {
    inputRef.focus();
  }

  $effect(() => {
    console.log("EnterDecryptPassword did mount, input:", inputRef);
    if (inputRef) {
      inputRef.focus();
    }
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  tabindex="-1"
  {onkeydown}
  class="dlg z-20 absolute center-x-with-translate top-16 flex flex-col max-w-full p-3"
>
  <div class="text-lg">Enter password to decrypt files:</div>
  {#if msg}
    <div class="text-red-500 text-sm my-2">{msg}</div>
  {/if}
  <input
    bind:this={inputRef}
    bind:value={password}
    type={hidePassword ? "password" : "text"}
    class="py-1 px-2 bg-white mt-2 rounded-xs w-[80ch]"
  />
  <label class="mt-2 ml-1.5">
    <input type="checkbox" bind:checked={hidePassword} {onchange} />
    Hide password
  </label>
  {#if pwdError}
    <div class="text-red-500 mt-2 ml-1">{pwdError}</div>
  {/if}
  <div class="flex items-baseline mt-2">
    <a target="_blank" href="/help#encryption" class="ml-1 text-lg link text-blue-700">about encryption</a>
    <div class="grow"></div>
    <button
      onclick={() => emitGotPassword()}
      disabled={!validPassword}
      class="px-4 py-1 border border-black hover:bg-gray-100 disabled:hover:bg-white disabled:text-gray-400 disabled:border-gray-400 default:bg-slate-700"
      >Ok</button
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
