<script module lang="ts">
  // A "busy" message (e.g. "Loading note...", "running code"). Overlapping
  // operations each own their message (identified by key) and clear only their
  // own; the most recently shown message is displayed (issue 15c in
  // docs/state-machines.md).

  interface Msg {
    key: string;
    html: string;
    visible: boolean; // false until the delay passes
    timer: ReturnType<typeof setTimeout> | null;
  }

  let messages: Msg[] = $state([]);

  class ModalMessageState {
    get isShowing(): boolean {
      return messages.some((m) => m.visible);
    }
  }

  export let modalMessageState = new ModalMessageState();

  function removeMessage(key: string) {
    let m = messages.find((m) => m.key === key);
    if (m?.timer) {
      clearTimeout(m.timer);
    }
    messages = messages.filter((m) => m.key !== key);
  }

  // shows message msgHTML owned by key after delay ms. msgHTML is rendered as HTML:
  // build it with html`...` (util.ts) so interpolated names are escaped (U1).
  // Replaces the previous message with the same key.
  export function showModalMessageHTML(msgHTML: string, delay: number, key = "default") {
    removeMessage(key);
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (delay > 0) {
      timer = setTimeout(() => {
        let m = messages.find((x) => x.key === key);
        if (m) {
          m.visible = true;
          m.timer = null;
        }
      }, delay);
    }
    messages.push({ key, html: msgHTML, visible: delay <= 0, timer });
  }

  // clears message owned by key
  export function clearModalMessage(key = "default") {
    removeMessage(key);
  }

  function currentHTML(): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.visible) {
        return messages[i]!.html;
      }
    }
    return "";
  }
</script>

<form
  tabindex="-1"
  class="fixed flex justify-center items-center z-30 pointer-events-none select-none inset-0 bg-black/20"
>
  <button class="bg-white focus:outline-hidden min-w-[75vw]">
    <div class="text-lg text-black px-4 py-2 text-center">
      {@html currentHTML()}
    </div>
  </button>
</form>
