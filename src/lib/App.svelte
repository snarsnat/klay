<script lang="ts">
  import Sidebar from './components/layout/Sidebar.svelte';
  import Workspace from './components/layout/Workspace.svelte';
  import FileExplorer from './components/layout/FileExplorer.svelte';
  import IdeaBoard from './components/canvas/IdeaBoard.svelte';
  import ImageEditor from './components/canvas/ImageEditor.svelte';
  import ComputerControl from './components/panels/ComputerControl.svelte';
  import MemoryGraph from './components/panels/MemoryGraph.svelte';
  import OnboardingWizard from './components/onboarding/OnboardingWizard.svelte';
  import './styles/app.css';
  import { onMount } from 'svelte';
  import { modeStore } from '$lib/stores/modes';
  import { workspaceStore } from '$lib/stores/workspace';
  import { settingsStore, isConfigured } from '$lib/stores/settings';
  import { fade, scale } from 'svelte/transition';

  onMount(() => {
    modeStore.loadModes();
  });
</script>

{#if !$isConfigured}
  <OnboardingWizard />
{:else}
  <div class="klay-app">
    <!-- Main layout -->
    <Sidebar />
    <main class="main-workspace">
      <Workspace />
    </main>
    <FileExplorer />

    <!-- Overlay Panels -->
    {#if $workspaceStore.showIdeaBoard}
      <div
        class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
        transition:fade={{ duration: 150 }}
        onclick={() => workspaceStore.toggleIdeaBoard()}
        role="presentation"
      >
        <div
          class="w-[90vw] h-[85vh] max-w-6xl rounded-2xl overflow-hidden border border-border shadow-2xl"
          style="background-color: #0a0a0c"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Idea Board"
        >
          <IdeaBoard />
        </div>
      </div>
    {/if}

    {#if $workspaceStore.showImageEditor}
      <div
        class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
        transition:fade={{ duration: 150 }}
        onclick={() => workspaceStore.toggleImageEditor()}
        role="presentation"
      >
        <div
          class="w-[90vw] h-[85vh] max-w-6xl rounded-2xl overflow-hidden border border-border shadow-2xl"
          style="background-color: #0a0a0c"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Image Editor"
        >
          <ImageEditor />
        </div>
      </div>
    {/if}

    {#if $workspaceStore.showComputerControl}
      <div
        class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
        transition:fade={{ duration: 150 }}
        onclick={() => workspaceStore.toggleComputerControl()}
        role="presentation"
      >
        <div
          class="w-[90vw] h-[85vh] max-w-5xl rounded-2xl overflow-hidden border border-border shadow-2xl"
          style="background-color: #0a0a0c"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Computer Control"
        >
          <ComputerControl />
        </div>
      </div>
    {/if}

    {#if $workspaceStore.showMemoryGraph}
      <div
        class="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
        transition:fade={{ duration: 150 }}
        onclick={() => workspaceStore.toggleMemoryGraph()}
        role="presentation"
      >
        <div
          class="w-[90vw] h-[85vh] max-w-5xl rounded-2xl overflow-hidden border border-border shadow-2xl"
          style="background-color: #0a0a0c"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Memory Graph"
        >
          <MemoryGraph />
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    height: 100%;
    background: #0a0a0c;
    color: #e2e2e6;
    font-family: 'JetBrains Mono', monospace;
  }

  .klay-app {
    display: grid;
    grid-template-columns: 240px 1fr 280px;
    height: 100vh;
    overflow: hidden;
    position: relative;
  }

  .main-workspace {
    border-left: 1px solid #1f1f23;
    border-right: 1px solid #1f1f23;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    height: 100vh;
  }
</style>
