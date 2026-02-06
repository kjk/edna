<script lang="ts">
  import { requestHandlePermission } from "../fileutil";
  import { boot } from "../main";
  import {
    clearStorageFS,
    dbDelDirHandle,
    dbGetDirHandle,
    pickAnotherDirectory,
    preLoadAllNotes,
    setStorageFS,
  } from "../notes";

  let dirName = $state("");

  $effect(() => {
    console.log("AskFSPermissions");
    dbGetDirHandle().then((dh?: FileSystemDirectoryHandle) => {
      console.log("dh:", dh);
      if (!dh) return;
      dirName = dh.name;
    });
  });
  async function requestPermissions() {
    let dh = await dbGetDirHandle();
    let ok = await requestHandlePermission(dh, true);
    if (ok) {
      console.log("trying to mount app now");
      await boot();
    } else {
      clearStorageFS();
    }
  }

  async function pickAnotherDirectory2() {
    let ok = await pickAnotherDirectory();
    if (!ok) {
      return;
    }
    await boot();
    await preLoadAllNotes();
  }

  async function switchToBrowserStorage() {
    await dbDelDirHandle();
    await boot();
  }
</script>

<div class="fixed inset-0 overflow-hidden bg-gray-50">
  <div class="mt-8 mx-auto px-8 py-4 flex flex-col items-center shadow-xl2 bg-white text-base w-fit">
    <div class="mt-2 self-center">
      Your're storing notes on disk in directory <span class="font-bold">{dirName}</span>
    </div>

    <div>We need permission to access files in that directory.</div>
    <div class="flex flex-col mt-4 mb-8 text-sm">
      <button onclick={requestPermissions} class="mt-4 px-4 py-1 border border-black hover:bg-gray-100"
        >Allow Edna to access files in directory <span class="font-bold">{dirName}</span></button
      >
      <button onclick={pickAnotherDirectory2} class="mt-4 px-2 py-1 border border-black hover:bg-gray-100"
        >Pick another directory with notes</button
      >
      <button onclick={switchToBrowserStorage} class="mt-4 px-2 py-1 border border-black hover:bg-gray-100"
        >Switch to storing notes in browser</button
      >
      <a class="mt-4 self-center link" target="_blank" href="/help#storing-notes-on-disk">learn more</a>
    </div>
  </div>
</div>
