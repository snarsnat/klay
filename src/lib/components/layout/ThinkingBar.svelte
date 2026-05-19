<script lang="ts">
  import { workspaceStore } from '$lib/stores/workspace';
  import { activeMode, activeColor } from '$lib/stores/modes';
  import { fade, scale } from 'svelte/transition';
  import { Hexagon, Code2, Sparkles, Paintbrush, Search, Zap, Circle } from 'lucide-svelte';

  const iconMap: Record<string, any> = {
    Hexagon, Code2, Sparkles, Paintbrush, Search, Zap, FileText: Circle
  };

  function getIcon(name: string) {
    return iconMap[name] || Circle;
  }

  // Loading bar animation classes based on mode
  function getBarStyle(color: string) {
    return `background: linear-gradient(90deg, transparent, ${color}88, ${color}, ${color}88, transparent)`;
  }

  const statusTexts = [
    'Analyzing context...',
    'Retrieving knowledge...',
    'Processing request...',
    'Formulating response...',
    'Synthesizing insights...'
  ];
  let currentStatusIndex = 0;
  let statusInterval: ReturnType<typeof setInterval>;

  // Rotate status text while thinking
  $: if ($workspaceStore.isThinking) {
    statusInterval = setInterval(() => {
      currentStatusIndex = (currentStatusIndex + 1) % statusTexts.length;
    }, 2000);
  } else {
    if (statusInterval) clearInterval(statusInterval);
    currentStatusIndex = 0;
  }
</script>

{#if $workspaceStore.isThinking}
  <div
    class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 rounded-full z-50 transition-all duration-300"
    style="background-color: rgba(15,15,18,0.9); border: 1px solid {$activeColor}22;"
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
  >
    <!-- Pulsing dot -->
    <div class="relative flex h-2.5 w-2.5">
      <div
        class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
        style="background-color: {$activeColor}"
      ></div>
      <div
        class="relative inline-flex rounded-full h-2.5 w-2.5"
        style="background-color: {$activeColor}"
      ></div>
    </div>

    <!-- Icon & Status -->
    <div class="flex items-center gap-2">
      <svelte:component this={getIcon($activeMode?.icon || 'Circle')} size={12} color={$activeColor} />
      <span class="text-xs text-main/90 font-mono tracking-tight">
        {$workspaceStore.thinkingStatus}
      </span>
    </div>

    <!-- Progress bar -->
    <div class="h-1 w-16 rounded-full overflow-hidden" style="background-color: rgba(255,255,255,0.04)">
      <div
        class="h-full rounded-full animate-[thinking-progress_1.5s_ease-in-out_infinite]"
        style={getBarStyle($activeColor)}
      ></div>
    </div>

    <!-- Mode badge -->
    <div class="text-[9px] font-mono px-1.5 py-0.5 rounded" style="background-color: {$activeColor}12; color: {$activeColor}">
      {$activeMode?.name || 'Ready'}
    </div>
  </div>
{/if}

<style>
  @keyframes thinking-progress {
    0% { transform: translateX(-100%); width: 30%; }
    50% { transform: translateX(0%); width: 60%; }
    100% { transform: translateX(300%); width: 30%; }
  }
</style>
