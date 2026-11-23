<script lang="ts">
  import { focus } from "../actions";
  import { PasswordInput } from "../password-input.svelte";
  import Dialog from "./Dialog.svelte";

  // password entry dialog shared by encrypt / decrypt
  interface Props {
    title: string;
    submitLabel: string;
    onpassword: (password: string) => void;
    msg?: string; // error shown above the input
    note?: string; // shown below the input when the password is valid
    onclose?: () => void; // if set, shows Cancel button
  }
  let { title, submitLabel, onpassword, msg = "", note = "", onclose }: Props = $props();

  const pwd = new PasswordInput((password) => onpassword(password));

  let inputRef: HTMLElement;
  // keep focus in the password input after toggling "Hide password"
  function onchange(ev: Event) {
    inputRef.focus();
  }
</script>

<Dialog onkeydown={pwd.onkeydown}>
  <div class="text-lg">{title}</div>
  {#if msg}
    <div class="text-red-500 text-sm my-2">{msg}</div>
  {/if}
  <input
    bind:this={inputRef}
    bind:value={pwd.password}
    type={pwd.hidePassword ? "password" : "text"}
    use:focus
    class="py-1 px-2 bg-white mt-2 rounded-xs w-[80ch]"
  />
  <label class="mt-2 ml-1.5">
    <input type="checkbox" bind:checked={pwd.hidePassword} {onchange} />
    Hide password
  </label>
  {#if pwd.error}
    <div class="text-red-500 mt-2 ml-1">{pwd.error}</div>
  {:else if note}
    <div class="mt-2 ml-1 font-bold">{note}</div>
  {/if}
  <div class="flex items-baseline mt-2">
    <a target="_blank" href="/help#encryption" class="ml-1 text-lg link text-blue-700">about encryption</a>
    <div class="grow"></div>
    {#if onclose}
      <button onclick={onclose} class="mr-4 px-4 py-1 border border-black hover:bg-gray-100">Cancel</button>
    {/if}
    <button
      onclick={() => pwd.submit()}
      disabled={!pwd.valid}
      class="px-4 py-1 border border-black hover:bg-gray-100 disabled:hover:bg-white disabled:text-gray-400 disabled:border-gray-400 default:bg-slate-700"
      >{submitLabel}</button
    >
  </div>
</Dialog>

<style lang="postcss">
  input[type="checkbox"] {
    position: relative;
    top: 2px;
    left: -3px;
  }
</style>
