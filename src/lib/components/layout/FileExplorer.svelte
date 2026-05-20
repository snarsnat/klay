<script lang="ts">
  import { onMount } from 'svelte';
  import FileTreeNode from './FileTreeNode.svelte';
  import { fileExplorerStore } from '$lib/stores/files';
  import { projectRoot } from '$lib/stores/workspace';
  import { RefreshCw, FolderOpen } from 'lucide-svelte';
  import type { FileNode } from '$lib/types';

  let searchQuery = $state('');
  let editingRoot = $state(false);
  let rootInput = $state($projectRoot);

  onMount(() => {
    // Don't auto-load — user must set a project root first
    // so we don't accidentally show klay's own source files
  });

  function refresh() {
    fileExplorerStore.loadFileTree($projectRoot);
  }

  function setRoot() {
    projectRoot.set(rootInput);
    editingRoot = false;
    fileExplorerStore.loadFileTree(rootInput);
  }

  function countFiles(node: FileNode | null): number {
    if (!node) return 0;
    if (node.type === 'file') return 1;
    return (node.children || []).reduce((sum, child) => sum + countFiles(child), 0);
  }

  let totalFiles = $derived(countFiles($fileExplorerStore.root));

  function filterNode(node: FileNode, q: string): FileNode | null {
    if (!q) return node;
    if (node.type === 'file') {
      return node.name.toLowerCase().includes(q.toLowerCase()) ? node : null;
    }
    const children = (node.children || []).map(c => filterNode(c, q)).filter(Boolean) as FileNode[];
    if (children.length === 0 && !node.name.toLowerCase().includes(q.toLowerCase())) return null;
    return { ...node, children };
  }

  let displayRoot = $derived(
    $fileExplorerStore.root && searchQuery
      ? filterNode($fileExplorerStore.root, searchQuery)
      : $fileExplorerStore.root
  );
</script>

<aside class="w-[280px] bg-sidebar flex flex-col h-full border-l border-border shrink-0 overflow-hidden">
  <div class="p-4 border-b border-border">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-semibold font-sans text-main">Files</h2>
      <div class="flex items-center gap-1">
        <button
          class="p-1.5 text-muted hover:text-main rounded transition-colors"
          onclick={() => { editingRoot = !editingRoot; rootInput = $projectRoot; }}
          title="Set project root"
        >
          <FolderOpen size={14} />
        </button>
        <button
          class="p-1.5 text-muted hover:text-main rounded transition-colors"
          onclick={refresh}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </div>

    {#if editingRoot}
      <div class="mb-2 flex gap-1">
        <input
          type="text"
          bind:value={rootInput}
          placeholder="/path/to/project"
          class="flex-1 bg-deep border border-border rounded-lg px-2 py-1 text-xs text-main placeholder:text-muted/40 focus:outline-none focus:border-white/10 font-mono"
          onkeydown={(e) => { if (e.key === 'Enter') setRoot(); if (e.key === 'Escape') editingRoot = false; }}
        />
        <button
          onclick={setRoot}
          class="px-2 py-1 text-xs rounded-lg bg-white/5 text-muted hover:text-main transition-colors"
        >go</button>
      </div>
    {/if}

    <div class="relative">
      <input
        type="text"
        placeholder="Search files..."
        bind:value={searchQuery}
        class="w-full bg-deep border border-border rounded-lg px-3 py-1.5 text-xs text-main placeholder:text-muted/40 focus:outline-none focus:border-white/10 transition-colors"
      />
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-2">
    {#if $fileExplorerStore.loading}
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin w-4 h-4 border border-muted border-t-transparent rounded-full"></div>
      </div>
    {:else if displayRoot}
      <div class="space-y-0.5">
        {#each displayRoot.children || [] as node}
          <FileTreeNode {node} depth={0} />
        {/each}
      </div>
    {:else if $fileExplorerStore.error}
      <div class="py-8 px-3 text-center space-y-2">
        <p class="text-xs text-muted">{$fileExplorerStore.error}</p>
        <button
          onclick={() => { editingRoot = true; }}
          class="text-xs text-white/30 hover:text-white/50 underline transition-colors"
        >Set project root</button>
      </div>
    {:else}
      <div class="py-8 px-3 text-center space-y-2">
        <p class="text-xs text-muted">No project loaded</p>
        <button
          onclick={() => { editingRoot = true; }}
          class="text-xs text-white/30 hover:text-white/50 underline transition-colors"
        >Set project root</button>
      </div>
    {/if}
  </div>

  <div class="p-3 border-t border-border">
    <div class="flex items-center justify-between text-[10px] text-muted font-mono">
      <span class="truncate max-w-[160px]" title={$projectRoot}>{$projectRoot}</span>
      <span>{totalFiles} files</span>
    </div>
  </div>
</aside>
