<script lang="ts">
  import { requestWritePermission } from "../fileutil";

  interface Props {
    directory: FileSystemDirectoryHandle;
    boot: () => Promise<void>;
    switchToDirectory: () => Promise<void>;
    switchToBrowserStorage: () => Promise<void>;
    error?: string;
  }
  let { directory, boot, switchToDirectory, switchToBrowserStorage, error = "" }: Props = $props();

  async function allowDirAccess() {
    if (await requestWritePermission(directory)) {
      await boot();
    }
  }
</script>

<div class="fixed inset-0 overflow-hidden bg-gray-50">
  <div class="mt-8 mx-auto px-8 py-4 flex flex-col items-center shadow-2xl bg-white text-base w-fit">
    <div class="mt-2 self-center">
      You're storing notes on disk in directory <span class="font-bold">{directory.name}</span>
    </div>

    {#if error}
      <div class="text-red-600">Failed to read notes in that directory: {error}</div>
    {:else}
      <div>We need permission to access files in that directory.</div>
    {/if}
    <div class="flex flex-col mt-4 mb-8 text-sm">
      {#if error}
        <button onclick={() => boot()} class="mt-4 px-4 py-1 border border-black hover:bg-gray-100">Try again</button>
      {:else}
        <button onclick={allowDirAccess} class="mt-4 px-4 py-1 border border-black hover:bg-gray-100"
          >Allow Edna to access files in directory <span class="font-bold">{directory.name}</span></button
        >
      {/if}
      <button onclick={switchToDirectory} class="mt-4 px-2 py-1 border border-black hover:bg-gray-100"
        >Pick another directory with notes</button
      >
      <button onclick={switchToBrowserStorage} class="mt-4 px-2 py-1 border border-black hover:bg-gray-100"
        >Switch to storing notes in browser</button
      >
      <a class="mt-4 self-center link" target="_blank" href="/help#storing-notes-on-disk">learn more</a>
    </div>
  </div>
</div>
