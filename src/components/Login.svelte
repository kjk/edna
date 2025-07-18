<script>
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import GitHub from "./GitHub.svelte";

  /** @type { {
    onclose: () => void,
}}*/
  let { onclose } = $props();

  let waitingForMagicLink = $state(false);

  let email = $state("");
  let loginCode = $state("");

  let isValidEmail = $derived.by(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  });

  let canSendMagicLink = $derived.by(() => {
    return email.trim() !== "" && isValidEmail;
  });

  let emailError = $derived.by(() => {
    if (email.trim() === "") {
      return "";
    }
    if (!isValidEmail) {
      return "Please enter a valid email address";
    }
    return "";
  });

  /**
   * @param {string} email
   */
  function handleSendMagicLink(email) {
    // TODO: Implement magic link sending
    console.log("Sending magic link to:", email);
    waitingForMagicLink = true;
  }
  /**
   * @param {KeyboardEvent} ev
   */
  function onkeydown(ev) {
    let key = ev.key;

    if (key === "Escape") {
      onclose();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (canSendMagicLink && key === "Enter") {
      emitSendMagicLink();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
  }

  function emitSendMagicLink() {
    handleSendMagicLink(email.trim());
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  tabindex="0"
  {onkeydown}
  class="selector z-20 absolute center-x-with-translate top-[4rem] flex flex-col max-w-full p-8 text-sm"
>
  <div class="flex justify-between items-baseline">
    <div></div>
    <div class="self-center font-semibold mb-4">Login to Elaris</div>
    <div class="kbd mt-[4px]">Esc</div>
  </div>

  <div class="mb-4">
    <a
      href="/auth/ghlogin"
      class="relative flex items-center justify-center w-full py-2 px-4 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors font-medium"
    >
      <GitHub class="mr-2" />
      Login with GitHub
    </a>
  </div>

  <div class="text-center text-gray-500 dark:text-gray-400">or</div>

  <div class="mt-1">
    <label
      for="email"
      class="block font-medium text-gray-700 dark:text-gray-300"
    >
      Login with email address:
    </label>
    <input
      id="email"
      type="email"
      bind:value={email}
      use:focus
      placeholder="Enter your email"
      class="mt-2 w-full py-1 px-1 bg-white rounded-xs min-w-[40ch]"
    />
    {#if emailError}
      <div class="text-red-500 text-sm mt-1">{emailError}</div>
    {/if}
  </div>
  {#if waitingForMagicLink}
    <label for="loginCode" class="mt-2">
      Check your email for login code:
    </label>
    <input
      id="loginCode"
      type="text"
      class="mt-2 w-full py-1 px-1 bg-white rounded-xs min-w-[40ch]"
      bind:value={loginCode}
      use:focus
      placeholder="Enter your login code"
    />
  {/if}
  <div class="mt-4">
    <button
      onclick={emitSendMagicLink}
      disabled={!canSendMagicLink}
      class="w-full cursor-pointer py-2 px-4 button-outline"
    >
      {#if waitingForMagicLink}
        Re-send login code
      {:else}
        Get login code
      {/if}
    </button>
  </div>
</div>
