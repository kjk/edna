<script lang="ts">
  import { requestHandlePermission } from "../fileutil";

  /** @type {{
   close: (boolean) => void,
   fileHandle: FileSystemHandle,
  }}*/
  let { close, fileHandle } = $props();

  // svelte-ignore state_referenced_locally
  let fileName = $state(fileHandle.name);

  async function requestPermissions() {
    let ok = false;
    try {
      ok = await requestHandlePermission(fileHandle, true);
    } catch (e) {
      console.log(e);
      ok = false;
    }
    console.log("reqeustPermissions: ok:", ok);
    close(ok);
  }

  function cancel() {
    console.log("cancel()");
    close(false);
  }
</script>

<div
  class="z-20 absolute center-x-with-translate top-[4rem] px-8 py-4 flex flex-col items-center shadow-xl2 bg-white text-base w-[90vw]"
>
  <div>We need permission to write to file <b>{fileName}</b> on disk.</div>
  <div class="flex flex-col mt-4 mb-8 text-sm">
    <button
      onclick={requestPermissions}
      class="mt-4 px-4 py-1 border border-black hover:bg-gray-100"
      >Allow Edna to write to a file <span class="font-bold">{fileName}</span
      ></button
    >
    <button
      onclick={cancel}
      class="mt-4 px-2 py-1 border border-black hover:bg-gray-100"
      >Cancel</button
    >
    <!-- <a
        class="mt-4 self-center link"
        target="_blank"
        href="/help#storing-notes-on-disk">learn more</a
      > -->
  </div>
</div>
