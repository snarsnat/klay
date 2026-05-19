<script lang="ts">
  import { Hexagon, Code2, Sparkles, Paintbrush, Search, Zap, Plus, Layers, Circle, Lightbulb, Image, Monitor, Network } from 'lucide-svelte';
  import { modeStore, activeMode, activeColor, allModes, hybridModes } from '$lib/stores/modes';
  import { workspaceStore } from '$lib/stores/workspace';

  // Icon mapping for dynamic mode icons
  const iconMap: Record<string, any> = {
    Hexagon, Code2, Sparkles, Paintbrush, Search, Zap, FileText: Circle, Layers
  };

  function getIcon(iconName: string) {
    return iconMap[iconName] || Circle;
  }
</script>

<aside class="w-60 bg-sidebar flex flex-col h-full border-r border-border shrink-0">
  <!-- Brand -->
  <div class="p-6">
    <h1 class="text-xl font-bold tracking-tight font-sans flex items-center gap-3">
      <span class="w-2 h-2 rounded-full" style="background-color: {$activeColor}"></span>
      KLAY
    </h1>
    <p class="text-xs text-muted mt-1">Mold your projects</p>
  </div>

  <!-- Modes Section -->
  <nav class="flex-1 px-3 space-y-1 overflow-y-auto">
    <div class="flex items-center justify-between px-3 mb-2">
      <span class="text-[10px] uppercase tracking-widest text-muted font-bold">Modes</span>
      {#if $hybridModes.length > 0}
        <span class="text-[9px] text-muted bg-white/5 px-1.5 py-0.5 rounded font-mono">
          +{$hybridModes.length}
        </span>
      {/if}
    </div>

    {#each $allModes as mode}
      {@const isActive = $modeStore.activeModeId === mode.id}
      {@const isHybrid = $modeStore.hybridModeIds.includes(mode.id)}

      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group relative
          {isActive ? 'text-main shadow-sm' : 'text-muted hover:text-main hover:bg-white/[0.03]'}"
        style="background-color: {isActive ? `${mode.color}12` : 'transparent'}"
        onclick={() => {
          if (isActive) {
            modeStore.toggleHybridMode(mode.id);
          } else {
            modeStore.setActiveMode(mode.id);
            workspaceStore.setThinkingStatus(`${mode.name} Mode active`);
          }
        }}
        oncontextmenu={() => { modeStore.toggleHybridMode(mode.id); }}
      >
        <!-- Active indicator bar -->
        {#if isActive}
          <span class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style="background-color: {mode.color}"></span>
        {/if}

        <svelte:component
          this={getIcon(mode.icon)}
          size={16}
          strokeWidth={isActive ? 2.5 : 2}
          color={isActive ? mode.color : undefined}
        />

        <span class="flex-1 text-left">{mode.name}</span>

        {#if isHybrid}
          <span class="w-1.5 h-1.5 rounded-full" style="background-color: {mode.color}" title="Hybrid mode active"></span>
        {/if}
      </button>
    {/each}
  </nav>

  <!-- Workspace Panels -->
  <div class="px-3 mt-2 mb-1">
    <span class="text-[10px] uppercase tracking-widest text-muted px-3 font-bold">Workspace</span>
  </div>
  <div class="px-3 space-y-0.5 mb-2">
    <button
      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted hover:text-main hover:bg-white/[0.03] transition-all duration-150"
      onclick={() => workspaceStore.toggleIdeaBoard()}
    >
      <Lightbulb size={14} />
      <span>Idea Board</span>
    </button>
    <button
      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted hover:text-main hover:bg-white/[0.03] transition-all duration-150"
      onclick={() => workspaceStore.toggleImageEditor()}
    >
      <Image size={14} />
      <span>Image Editor</span>
    </button>
    <button
      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted hover:text-main hover:bg-white/[0.03] transition-all duration-150"
      onclick={() => workspaceStore.toggleComputerControl()}
    >
      <Monitor size={14} />
      <span>Browser Control</span>
    </button>
    <button
      class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted hover:text-main hover:bg-white/[0.03] transition-all duration-150"
      onclick={() => workspaceStore.toggleMemoryGraph()}
    >
      <Network size={14} />
      <span>Memory Graph</span>
    </button>
  </div>

  <!-- Bottom Actions -->
  <div class="p-4 border-t border-border space-y-2 mt-auto">
    <!-- Custom Mode Creator -->
    <button
      class="w-full flex items-center gap-2 py-2 px-3 text-xs text-muted hover:text-main border border-dashed border-border rounded-lg transition-colors hover:border-white/10"
    >
      <Plus size={14} />
      <span>New Mode</span>
    </button>

    <!-- Hybrid mode indicator -->        {#if $hybridModes.length > 0}
          {@const hybridNames = $hybridModes.map(m => m.name).join(' + ')}
          <div class="flex items-center gap-2 px-3 py-1.5">
            <Layers size={12} class="text-muted shrink-0" />
            <span class="text-[10px] text-muted font-mono">
              {hybridNames}
            </span>
          </div>
        {/if}
  </div>
</aside>
