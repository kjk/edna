<script lang="ts">
  import { focus } from "../actions";
  import { appState } from "../appstate.svelte";
  import { IconGitHub } from "./Icons.svelte";

  let { onclose }: { onclose: () => void } = $props();

  let waitingForMagicLink = $state(false);

  let email = $state("");
  let loginCode = $state("");
  let error = $state("");
  let hasLoginCode = $derived.by(() => {
    let s = loginCode.trim();
    // check if login code is 6 characters long and contains only numbers
    return s.length === 6 && /^\d+$/.test(s);
  });

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

  function onkeydown(ev: KeyboardEvent): void {
    let key = ev.key;

    if (key === "Escape") {
      onclose();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }

    if (canSendMagicLink && key === "Enter") {
      sendEmailWithLoginCode();
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
  }

  async function loginWithCode() {
    console.log("Logging in with code");
    let uri = "/api/verify_login_code?code=" + encodeURIComponent(loginCode);
    try {
      let rsp = await fetch(uri);
      if (!rsp.ok) {
        let js = await rsp.json();
        error = js.error || "can't verify login code";
      }
      window.location.pathname = `/login/${loginCode}`;
    } catch (e) {
      console.error(e);
      error = e.toString();
    }
  }

  async function sendEmailWithLoginCode() {
    console.log("Sending email with login code to:", email);
    waitingForMagicLink = true;
    let uri =
      "/api/send_login_in_email" + "?email=" + encodeURIComponent(email);
    try {
      let rsp = await fetch(uri);
      if (!rsp.ok) {
        error = "failed to send email";
      }
    } catch (e) {
      console.error(e);
      error = e.toString();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="dialog"
  tabindex="0"
  {onkeydown}
  class="selector z-20 absolute center-x-with-translate top-16 flex flex-col max-w-full p-8 text-sm"
>
  <div class="flex justify-between items-baseline">
    <div></div>
    <div class="self-center font-semibold mb-4">Login to Elaris</div>
    <button title="Close" onclick={() => onclose()} class="kbd-btn mt-1"
      >Esc</button
    >
  </div>

  <div class="mb-4">
    <a
      href="/auth/ghlogin"
      class="relative flex items-center justify-center w-full py-1 px-4 text-gray-600 rounded-md hover:bg-gray-100 transition-colors font-medium border border-gray-600"
    >
      {@render IconGitHub("mr-2")}
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
    <button
      onclick={loginWithCode}
      disabled={!hasLoginCode}
      class="mt-4 w-full cursor-pointer py-2 px-4 button-outline"
    >
      Login
    </button>
  {/if}
  {#if error}
    <div class="mt-2 text-red-500 text-sm">{error}</div>
  {/if}
  <button
    onclick={sendEmailWithLoginCode}
    disabled={!canSendMagicLink}
    class="mt-4 w-full cursor-pointer py-2 px-4 button-outline"
  >
    {#if waitingForMagicLink}
      Re-send login code
    {:else}
      Get login code
    {/if}
  </button>
</div>
