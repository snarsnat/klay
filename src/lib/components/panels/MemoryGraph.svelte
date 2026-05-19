<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getMemoryGraph, searchMemory, storeMemory } from '$lib/services/api';
  import { workspaceStore } from '$lib/stores/workspace';
  import { activeColor } from '$lib/stores/modes';
  import type { MemoryGraph, MemoryNode } from '$lib/types';
  import { X, Search, Save, RotateCw, Network } from 'lucide-svelte';

  let graph: MemoryGraph = { nodes: [], edges: [] };
  let searchQuery = '';
  let searchResults: MemoryNode[] = [];
  let newMemoryContent = '';
  let isLoading = false;
  let isSearching = false;


  // Layout state
  let positions: Map<string, { x: number; y: number }> = new Map();

  function layoutGraph() {
    if (graph.nodes.length === 0) return;

    const centerX = 300;
    const centerY = 200;
    const radius = 150;

    graph.nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / graph.nodes.length - Math.PI / 2;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });
  }

  async function loadGraph() {
    isLoading = true;
    try {
      graph = await getMemoryGraph();
      layoutGraph();
    } catch (e) {
      console.error('Failed to load graph:', e);
    }
    isLoading = false;
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    isSearching = true;
    try {
      searchResults = await searchMemory(searchQuery);
    } catch (e) {
      console.error('Search failed:', e);
    }
    isSearching = false;
  }

  async function saveMemory() {
    if (!newMemoryContent.trim()) return;
    try {
      await storeMemory(newMemoryContent, {
        type: 'idea',
        timestamp: Date.now(),
      });
      newMemoryContent = '';
      await loadGraph();
    } catch (e) {
      console.error('Save failed:', e);
    }
  }

  function getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      concept: '#8b5cf6',
      file: '#10b981',
      idea: '#f59e0b',
      decision: '#3b82f6',
    };
    return colors[type] || '#8d8d91';
  }

  function getNodeSize(type: string): number {
    const sizes: Record<string, number> = {
      concept: 8,
      file: 6,
      idea: 7,
      decision: 9,
    };
    return sizes[type] || 6;
  }

  onMount(() => {
    loadGraph();
  });

  onDestroy(() => {
    // Cleanup
  });
</script>

<div class="flex flex-col h-full bg-deep">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-sidebar/80">
    <div class="flex items-center gap-2">
      <Network size={14} class="text-muted" />
      <span class="text-xs font-mono text-muted">Memory Graph</span>
    </div>
    <div class="flex items-center gap-1.5">
      <button
        class="p-1 text-muted hover:text-main rounded transition-colors"
        onclick={loadGraph}
        title="Refresh"
      >
        <RotateCw size={12} />
      </button>
      <button
        class="p-1 text-muted hover:text-main rounded transition-colors"
        onclick={() => workspaceStore.toggleMemoryGraph()}
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  </div>

  <div class="flex-1 flex overflow-hidden">
    <!-- Graph visualization -->
    <div class="flex-1 relative">
      {#if isLoading}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="flex items-center gap-2">
            <div class="animate-spin w-4 h-4 border border-muted border-t-transparent rounded-full"></div>
            <span class="text-xs text-muted font-mono">Loading...</span>
          </div>
        </div>
      {:else if graph.nodes.length === 0}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center space-y-2">
            <Network size={24} class="text-muted mx-auto" />
            <p class="text-xs text-muted">No memories yet</p>
            <p class="text-[10px] text-muted">Save ideas and context below</p>
          </div>
        </div>
      {:else}
        <svg class="w-full h-full" viewBox="0 0 600 400">
          <!-- Edges -->
          {#each graph.edges as edge}
            {@const fromPos = positions.get(edge.source)}
            {@const toPos = positions.get(edge.target)}
            {#if fromPos && toPos}
              <line
                x1={fromPos.x} y1={fromPos.y}
                x2={toPos.x} y2={toPos.y}
                stroke="#1f1f23"
                stroke-width={edge.strength * 3 + 1}
                stroke-dasharray={edge.strength > 0.5 ? '0' : '4,3'}
              />
              <text
                x={(fromPos.x + toPos.x) / 2}
                y={(fromPos.y + toPos.y) / 2 - 6}
                fill="#5a5a5e"
                font-size="8"
                font-family="JetBrains Mono, monospace"
                text-anchor="middle"
              >
                {edge.label}
              </text>
            {/if}
          {/each}

          <!-- Nodes -->
          {#each graph.nodes as node}
            {@const pos = positions.get(node.id)}
            {#if pos}
              <g>
                <circle
                  cx={pos.x} cy={pos.y}
                  r={getNodeSize(node.type)}
                  fill={getNodeColor(node.type)}
                  opacity="0.8"
                >
                  <title>{node.label}</title>
                </circle>
                <text
                  x={pos.x}
                  y={pos.y + getNodeSize(node.type) + 12}
                  fill="#8d8d91"
                  font-size="8"
                  font-family="JetBrains Mono, monospace"
                  text-anchor="middle"
                >
                  {node.label.length > 20 ? node.label.slice(0, 20) + '...' : node.label}
                </text>
              </g>
            {/if}
          {/each}
        </svg>
      {/if}

      <!-- Stats overlay -->
      {#if graph.nodes.length > 0}
        <div class="absolute top-2 left-2 bg-sidebar/80 rounded-lg px-2 py-1">
          <span class="text-[9px] text-muted font-mono">
            {graph.nodes.length} nodes · {graph.edges.length} connections
          </span>
        </div>
      {/if}
    </div>

    <!-- Side panel -->
    <div class="w-56 border-l border-border flex flex-col">
      <!-- Search -->
      <div class="p-2 border-b border-border">
        <div class="flex gap-1">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search memories..."
            class="flex-1 bg-deep border border-border rounded px-2 py-1 text-[10px] font-mono text-main placeholder:text-muted/40 focus:outline-none focus:border-white/10"
            onkeydown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            class="p-1 text-muted hover:text-main rounded transition-colors"
            onclick={handleSearch}
          >
            <Search size={12} />
          </button>
        </div>
        {#if isSearching}
          <div class="animate-spin w-3 h-3 border border-muted border-t-transparent rounded-full mt-1 mx-auto"></div>
        {/if}
        {#if searchResults.length > 0}
          <div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {#each searchResults as result}
              <div class="p-1.5 rounded bg-white/[0.02] border border-border">
                <p class="text-[9px] text-muted font-mono truncate">{result.content.slice(0, 60)}</p>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Save new memory -->
      <div class="flex-1 p-2 flex flex-col gap-2">
        <p class="text-[9px] uppercase tracking-wider text-muted font-bold">Save Context</p>
        <textarea
          bind:value={newMemoryContent}
          placeholder="Paste a note, idea, or decision..."
          class="w-full bg-deep border border-border rounded-lg px-2 py-1.5 text-[10px] font-mono text-main placeholder:text-muted/40 focus:outline-none focus:border-white/10 resize-none flex-1 min-h-[60px]"
        ></textarea>
        <button
          class="w-full py-1 rounded text-[10px] font-mono transition-colors disabled:opacity-30 flex items-center justify-center gap-1"
          style="background-color: {$activeColor}15; color: {$activeColor}"
          onclick={saveMemory}
          disabled={!newMemoryContent.trim()}
        >
          <Save size={10} />
          Save
        </button>
      </div>
    </div>
  </div>
</div>
