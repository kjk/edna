<script lang="ts">
  import { onMount } from "svelte";
  import { newMarkdownIt } from "../markdown-util";
  import { IconTablerX } from "./Icons.svelte";

  // floating panel showing markdown rendered as HTML (#49). Can be moved by
  // dragging the title bar and resized; remembers its position and size
  interface Props {
    // markdown to show; null if the current block isn't markdown
    markdown: string | null;
    onclose: () => void;
  }
  let { markdown, onclose }: Props = $props();

  const kRectKey = "edna.markdownPreviewRect";
  const kMinSize = 160;

  interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  // keeps rect inside the window
  function clampRect(r: Rect): Rect {
    let vw = window.innerWidth;
    let vh = window.innerHeight;
    let w = Math.max(kMinSize, Math.min(r.w, vw));
    let h = Math.max(kMinSize, Math.min(r.h, vh));
    let x = Math.max(0, Math.min(r.x, vw - w));
    let y = Math.max(0, Math.min(r.y, vh - h));
    return { x, y, w, h };
  }

  function defaultRect(): Rect {
    let w = window.innerWidth * 0.5;
    let h = window.innerHeight * 0.8;
    return { x: window.innerWidth - w - 16, y: window.innerHeight * 0.1, w, h };
  }

  function loadRect(): Rect {
    try {
      let r = JSON.parse(localStorage.getItem(kRectKey) || "null");
      if (r && [r.x, r.y, r.w, r.h].every((v) => Number.isFinite(v))) {
        return clampRect(r);
      }
    } catch {
      // storage may be unavailable or the value damaged: use the default
    }
    return clampRect(defaultRect());
  }

  function saveRect() {
    try {
      localStorage.setItem(kRectKey, JSON.stringify(rect));
    } catch {
      // not remembering the position is fine
    }
  }

  let rect: Rect = $state(loadRect());
  let panelRef: HTMLElement;
  let bodyRef: HTMLElement;

  const md = newMarkdownIt();
  // rendering is debounced so that typing in a large block stays fast
  let html = $state("");
  let renderTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    let s = markdown;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => (html = s === null ? "" : md.render(s)), html ? 150 : 0);
  });

  // drag by the title bar
  let drag: { dx: number; dy: number } | null = null;
  function onpointerdown(ev: PointerEvent) {
    if ((ev.target as HTMLElement).closest("button")) {
      return;
    }
    drag = { dx: ev.clientX - rect.x, dy: ev.clientY - rect.y };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    ev.preventDefault();
  }
  function onpointermove(ev: PointerEvent) {
    if (drag) {
      rect = clampRect({ ...rect, x: ev.clientX - drag.dx, y: ev.clientY - drag.dy });
    }
  }
  function onpointerup() {
    if (drag) {
      drag = null;
      saveRect();
    }
  }

  // #foo links go to headings in the preview; they must not change the URL,
  // whose hash is the name of the note
  function onclick(ev: MouseEvent) {
    let a = (ev.target as HTMLElement).closest("a");
    let href = a?.getAttribute("href");
    if (!href?.startsWith("#")) {
      return;
    }
    ev.preventDefault();
    let id = decodeURIComponent(href.slice(1));
    bodyRef.querySelector(`[id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "start" });
  }

  onMount(() => {
    // the user resizes the panel with the native resize handle
    let ro = new ResizeObserver(() => {
      let w = panelRef.offsetWidth;
      let h = panelRef.offsetHeight;
      if (w !== rect.w || h !== rect.h) {
        rect = { ...rect, w, h };
        saveRect();
      }
    });
    ro.observe(panelRef);
    let onresize = () => (rect = clampRect(rect));
    window.addEventListener("resize", onresize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onresize);
      clearTimeout(renderTimer);
    };
  });
</script>

<div
  bind:this={panelRef}
  class="preview fixed z-10 flex flex-col bg-white dark:bg-gray-800 shadow-lg border border-gray-300 dark:border-gray-600"
  style:left="{rect.x}px"
  style:top="{rect.y}px"
  style:width="{rect.w}px"
  style:height="{rect.h}px"
>
  <div
    class="flex items-center px-2 py-1 text-sm cursor-move select-none bg-gray-100 dark:bg-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600"
    role="toolbar"
    tabindex="-1"
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
  >
    <div class="grow">Markdown preview</div>
    <button class="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xs p-0.5" title="Close" onclick={onclose}
      >{@render IconTablerX()}</button
    >
  </div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div bind:this={bodyRef} class="grow overflow-auto p-3" {onclick}>
    {#if markdown === null}
      <div class="italic text-gray-500 dark:text-gray-400">Move the cursor to a markdown block to see its preview</div>
    {:else}
      <div class="markdown-body">{@html html}</div>
    {/if}
  </div>
</div>

<style>
  .preview {
    resize: both;
    overflow: hidden;
    min-width: 160px;
    min-height: 160px;
  }

  .preview :global(.markdown-body > :first-child) {
    margin-top: 0;
  }
</style>
