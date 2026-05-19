<script lang="ts">
  import type { FileNode } from '$lib/types';
  import { fileExplorerStore } from '$lib/stores/files';
  import { Folder, File, ChevronRight, ChevronDown } from 'lucide-svelte';

  export let node: FileNode;
  export let depth: number = 0;

  let isExpanded = false;
  $: isExpanded = $fileExplorerStore.expandedPaths.has(node.path);

  function toggle() {
    if (node.type === 'directory') {
      fileExplorerStore.togglePath(node.path);
    }
  }

  function getExtension(path: string): string | undefined {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : undefined;
  }

  function getFileColor(ext?: string): string | undefined {
    const colors: Record<string, string> = {
      ts: '#3178c6', js: '#f7df1e', svelte: '#ff3e00',
      rs: '#dea584', py: '#3776ab', json: '#8d8d91',
      md: '#8d8d91', css: '#1572b6', html: '#e34f26',
      toml: '#8d8d91',
    };
    return ext ? colors[ext] : undefined;
  }
</script>

<div>
  <button
    class="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-white/[0.03] group"
    style="padding-left: {8 + depth * 16}px"
    onclick={toggle}
  >
    {#if node.type === 'directory'}
      <span class="text-muted shrink-0">
        {#if isExpanded}
          <ChevronDown size={12} />
        {:else}
          <ChevronRight size={12} />
        {/if}
      </span>
      <Folder size={13} class="shrink-0" color="#8d8d91" />
    {:else}
      <span class="w-4 shrink-0"></span>
      {@const ext = getExtension(node.path)}
      {@const color = getFileColor(ext)}
      <File size={13} class="shrink-0" color={color || '#5a5a5e'} />
    {/if}
    <span class="truncate text-main/80 group-hover:text-main transition-colors">
      {node.name}
    </span>
  </button>

  {#if node.type === 'directory' && isExpanded && node.children}
    <div class="transition-all duration-200">
      {#each node.children as child}
        <svelte:self node={child} {depth} />
      {/each}
    </div>
  {/if}
</div>
