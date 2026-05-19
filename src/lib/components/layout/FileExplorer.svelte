<script lang="ts">
  import { onMount } from 'svelte';
  import FileTreeNode from './FileTreeNode.svelte';
  import { fileExplorerStore } from '$lib/stores/files';
  import { RefreshCw, Search } from 'lucide-svelte';
  import type { FileNode } from '$lib/types';

  onMount(() => {
    fileExplorerStore.loadFileTree();
  });

  let totalFiles = 0;

  function countFiles(node: FileNode | null): number {
    if (!node || node.type === 'file') return 1;
    return (node.children || []).reduce((sum, child) => sum + countFiles(child), 0);
  }

  function refresh() {
    fileExplorerStore.loadFileTree();
  }

  // Update total when file tree loads
  $: {
    const root = $fileExplorerStore.root;
    totalFiles = root ? countFiles(root) : 0;
  }
</script>

<aside class="w-[280px] bg-sidebar flex flex-col h-full border-l border-border shrink-0 overflow-hidden">
  <div class="p-4 border-b border-border">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-semibold font-sans text-main">Files</h2>
      <div class="flex items-center gap-1">
        <button
          class="p-1.5 text-muted hover:text-main rounded transition-colors"
          onclick={refresh}
          title="Refresh file tree"
        >
          <RefreshCw size={14} />
        </button>
        <button class="p-1.5 text-muted hover:text-main rounded transition-colors" title="Search files">
          <Search size={14} />
        </button>
      </div>
    </div>
    <div class="relative">
      <input
        type="text"
        placeholder="Search files..."
        class="w-full bg-deep border border-border rounded-lg px-3 py-1.5 text-xs text-main placeholder:text-muted/40 focus:outline-none focus:border-white/10 transition-colors"
      />
      <Search size={12} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-2">
    {#if $fileExplorerStore.loading}
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin w-4 h-4 border border-muted border-t-transparent rounded-full"></div>
      </div>
    {:else if $fileExplorerStore.root}
      <div class="space-y-0.5">
        {#each $fileExplorerStore.root.children || [] as node}
          <FileTreeNode {node} depth={0} />
        {/each}
      </div>
    {:else if $fileExplorerStore.error}
      <p class="text-xs text-red-400 text-center py-8">{$fileExplorerStore.error}</p>
    {:else}
      <p class="text-xs text-muted text-center py-8">No files found</p>
    {/if}
  </div>

  <div class="p-3 border-t border-border">
    <div class="flex items-center justify-between text-[10px] text-muted font-mono">
      <span>Project root</span>
      <span>{totalFiles} files</span>
    </div>
  </div>
</aside>
