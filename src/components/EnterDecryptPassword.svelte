<script lang="ts">
  import { PasswordInput } from "../password-input.svelte";
  import PasswordFields from "./PasswordFields.svelte";

  interface Props {
    msg: string;
    onpassword: (newName: string) => void;
  }
  let { msg, onpassword }: Props = $props();

  const pwd = new PasswordInput((password) => onpassword(password));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  tabindex="-1"
  onkeydown={pwd.onkeydown}
  class="dlg z-20 absolute center-x-with-translate top-16 flex flex-col max-w-full p-3"
>
  <div class="text-lg">Enter password to decrypt files:</div>
  {#if msg}
    <div class="text-red-500 text-sm my-2">{msg}</div>
  {/if}
  <PasswordFields {pwd} />
  {#if pwd.error}
    <div class="text-red-500 mt-2 ml-1">{pwd.error}</div>
  {/if}
  <div class="flex items-baseline mt-2">
    <a target="_blank" href="/help#encryption" class="ml-1 text-lg link text-blue-700">about encryption</a>
    <div class="grow"></div>
    <button
      onclick={() => pwd.submit()}
      disabled={!pwd.valid}
      class="px-4 py-1 border border-black hover:bg-gray-100 disabled:hover:bg-white disabled:text-gray-400 disabled:border-gray-400 default:bg-slate-700"
      >Ok</button
    >
  </div>
</div>
