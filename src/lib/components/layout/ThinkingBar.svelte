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

<!-- Thinking is now shown inline in the chat window -->

<style>
  @keyframes thinking-progress {
    0% { transform: translateX(-100%); width: 30%; }
    50% { transform: translateX(0%); width: 60%; }
    100% { transform: translateX(300%); width: 30%; }
  }
</style>
