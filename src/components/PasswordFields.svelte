<script lang="ts">
  import { focus } from "../actions";
  import type { PasswordInput } from "../password-input.svelte";

  interface Props {
    pwd: PasswordInput;
  }
  let { pwd }: Props = $props();

  let inputRef: HTMLElement;
  // keep focus in the password input after toggling "Hide password"
  function onchange(ev: Event) {
    inputRef.focus();
  }
</script>

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

<style lang="postcss">
  input[type="checkbox"] {
    position: relative;
    top: 2px;
    left: -3px;
  }
</style>
