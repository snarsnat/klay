<script lang="ts">
  import { workspaceStore } from '$lib/stores/workspace';
  import { activeColor } from '$lib/stores/modes';
  import { startBrowser, stopBrowser, getBrowserState, browserNavigate, browserClick, browserType, takeScreenshot, browserExecuteJS } from '$lib/services/api';
  import type { BrowserState } from '$lib/types';
  import { X, Globe, MousePointer2, Keyboard, Maximize2, RefreshCw, ExternalLink, Play, Square } from 'lucide-svelte';

  let url = 'https://example.com';
  let state: BrowserState = { connected: false, currentUrl: '', title: '' };
  let screenshot: string | null = null;
  let isLoading = false;
  let jsCode = 'document.title';
  let jsResult: string | null = null;
  let activeTab: 'browse' | 'execute' = 'browse';

  async function connect() {
    isLoading = true;
    try {
      state = await startBrowser();
      screenshot = await takeScreenshot();
    } catch (e) {
      console.error('Browser start failed:', e);
    }
    isLoading = false;
  }

  async function disconnect() {
    await stopBrowser();
    state = { connected: false, currentUrl: '', title: '' };
    screenshot = null;
  }

  async function navigate() {
    if (!state.connected) await connect();
    isLoading = true;
    try {
      const result = await browserNavigate(url);
      state = result.state;
      screenshot = result.screenshot;
    } catch (e) {
      console.error('Navigation failed:', e);
    }
    isLoading = false;
  }

  async function handleScreenshotClick(e: MouseEvent) {
    if (!state.connected) return;
    const img = e.currentTarget as HTMLElement;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Scale coordinates to viewport
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    
    try {
      const result = await browserClick(x * scaleX, y * scaleY);
      screenshot = result.screenshot;
    } catch (e) {
      console.error('Click failed:', e);
    }
  }

  async function refresh() {
    if (!state.connected) return;
    try {
      screenshot = await takeScreenshot();
      state = await getBrowserState();
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }

  async function executeJS() {
    try {
      const result = await browserExecuteJS(jsCode);
      jsResult = JSON.stringify(result, null, 2);
    } catch (e) {
      jsResult = `Error: ${e}`;
    }
  }

  // Keyboard shortcut for URL bar
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && activeTab === 'browse') {
      navigate();
    }
  }
</script>

<div class="flex flex-col h-full bg-deep">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-sidebar/80">
    <div class="flex items-center gap-1.5">
      <Globe size={14} class="text-muted" />
      <span class="text-xs font-mono text-muted">Browser Control</span>
    </div>
    <div class="flex items-center gap-1.5">
      {#if state.connected}
        <span class="text-[9px] text-green-400 font-mono">Connected</span>
        <button class="p-1 text-muted hover:text-main rounded transition-colors" onclick={disconnect} title="Disconnect">
          <Square size={12} />
        </button>
      {:else}
        <button
          class="px-2 py-1 text-[10px] font-mono rounded transition-colors"
          style="background-color: {$activeColor}15; color: {$activeColor}"
          onclick={connect}
        >
          Connect
        </button>
      {/if}
      <button
        class="p-1 text-muted hover:text-main rounded transition-colors"
        onclick={() => workspaceStore.toggleComputerControl()}
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  </div>

  <!-- Tab bar -->
  <div class="flex border-b border-border">
    <button
      class="flex-1 py-1.5 text-[10px] font-mono transition-colors {activeTab === 'browse' ? 'text-main border-b-2' : 'text-muted hover:text-main'}"
      style="border-color: {activeTab === 'browse' ? $activeColor : 'transparent'}"
      onclick={() => activeTab = 'browse'}
    >
      Browse
    </button>
    <button
      class="flex-1 py-1.5 text-[10px] font-mono transition-colors {activeTab === 'execute' ? 'text-main border-b-2' : 'text-muted hover:text-main'}"
      style="border-color: {activeTab === 'execute' ? $activeColor : 'transparent'}"
      onclick={() => activeTab = 'execute'}
    >
      Execute
    </button>
  </div>

  {#if activeTab === 'browse'}
    <!-- URL Bar -->
    <div class="p-2 flex gap-1 border-b border-border">
      <input
        type="text"
        bind:value={url}
        onkeydown={handleKeydown}
        placeholder="Enter URL..."
        class="flex-1 bg-deep border border-border rounded px-2 py-1 text-xs text-main placeholder:text-muted/40 focus:outline-none focus:border-white/10 font-mono"
      />
      <button
        class="px-2 py-1 rounded text-[10px] font-mono transition-colors disabled:opacity-30"
        style="background-color: {$activeColor}15; color: {$activeColor}"
        onclick={navigate}
        disabled={isLoading}
      >
        Go
      </button>
      <button
        class="p-1 text-muted hover:text-main rounded transition-colors"
        onclick={refresh}
        disabled={!state.connected}
      >
        <RefreshCw size={12} />
      </button>
    </div>

    <!-- Screenshot / Browser view -->
    <div class="flex-1 overflow-hidden relative bg-deep/50">
      {#if isLoading}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="flex items-center gap-2">
            <div class="animate-spin w-4 h-4 border border-muted border-t-transparent rounded-full"></div>
            <span class="text-xs text-muted font-mono">Loading...</span>
          </div>
        </div>
      {:else if screenshot}
        <div class="p-2 h-full overflow-auto">
          <img
            src="data:image/png;base64,{screenshot}"
            alt="Browser screenshot"
            class="w-full rounded-lg border border-border cursor-crosshair"
            onclick={handleScreenshotClick}
          />
        </div>
        <div class="absolute bottom-3 left-3 right-3 flex gap-1 justify-center">
          <span class="text-[9px] text-muted font-mono bg-sidebar/80 px-2 py-1 rounded-full">
            Click on the page to interact
          </span>
        </div>
      {:else}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center space-y-2">
            <Globe size={24} class="text-muted mx-auto" />
            <p class="text-xs text-muted">Connect to start browsing</p>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <!-- JS Execute Tab -->
    <div class="flex-1 p-3 flex flex-col gap-2">
      <textarea
        bind:value={jsCode}
        placeholder="Enter JavaScript..."
        class="w-full bg-deep border border-border rounded-lg px-3 py-2 text-xs font-mono text-main placeholder:text-muted/40 focus:outline-none focus:border-white/10 resize-none h-24"
      ></textarea>
      <button
        class="self-start px-3 py-1 rounded text-[10px] font-mono transition-colors disabled:opacity-30"
        style="background-color: {$activeColor}15; color: {$activeColor}"
        onclick={executeJS}
        disabled={!state.connected}
      >
        Run
      </button>
      {#if jsResult !== null}
        <div class="flex-1 bg-deep border border-border rounded-lg p-3 overflow-auto">
          <pre class="text-[10px] font-mono text-main whitespace-pre-wrap">{jsResult}</pre>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Status bar -->
  {#if state.connected}
    <div class="px-3 py-1 border-t border-border bg-sidebar/60">
      <p class="text-[9px] text-muted font-mono truncate">
        {state.title || state.currentUrl || 'Connected'}
      </p>
    </div>
  {/if}
</div>
