<script lang="ts">
  import ThinkingBar from './ThinkingBar.svelte';
  import { workspaceStore } from '$lib/stores/workspace';
  import { modeStore, activeMode, activeColor } from '$lib/stores/modes';
  import { afterUpdate } from 'svelte';

  let inputText = '';
  let chatContainer: HTMLDivElement;
  let isFocused = false;

  const suggestions: Record<string, string[]> = {
    reasoning: ['Analyze this architecture', 'Debug a complex issue', 'Optimize this algorithm'],
    coding: ['Write a Rust module', 'Refactor this TypeScript', 'Add error handling'],
    creative: ['Brainstorm feature ideas', 'Design a new UI concept', 'Generate creative copy'],
    design: ['Review UI component', 'Suggest layout improvements', 'Create style guide'],
    research: ['Research best practices', 'Compare technologies', 'Find documentation'],
    execution: ['Run build commands', 'Deploy application', 'Execute test suite']
  };

  function getSuggestions(modeId: string): string[] {
    return suggestions[modeId] || ['Start a conversation'];
  }

  function handleSubmit() {
    const text = inputText.trim();
    if (!text) return;

    workspaceStore.addMessage({
      role: 'user',
      content: text,
      mode: $modeStore.activeModeId
    });

    inputText = '';

    workspaceStore.startThinking(`${$activeMode?.name || 'Active'} mode processing...`);

    setTimeout(() => {
      const hybridInfo = $modeStore.hybridModeIds.length > 0
        ? ` Also leveraging: ${$modeStore.hybridModeIds.map(id => {
            const m = $modeStore.modes.find(mode => mode.id === id);
            return m?.name || id;
          }).join(', ')}.`
        : '';

      workspaceStore.addMessage({
        role: 'assistant',
        content: `I'm processing your request in **${$activeMode?.name || 'Active'}** mode.${hybridInfo}\n\nHow would you like me to help?`,
        mode: $modeStore.activeModeId
      });
      workspaceStore.stopThinking();
    }, 1500);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function setSuggestion(text: string) {
    inputText = text;
  }

  afterUpdate(() => {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });
</script>

<div class="flex-1 flex flex-col h-full bg-deep relative">
  <div class="h-0.5 w-full transition-colors duration-500" style="background-color: {$activeColor}33"></div>

  <div class="flex-1 overflow-y-auto p-8 space-y-6" bind:this={chatContainer}>
    <div class="max-w-3xl mx-auto w-full">
      {#if $workspaceStore.messages.length === 0}
        <div class="space-y-4">
          <h2 class="text-2xl font-bold font-sans flex items-center gap-3">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: {$activeColor}"></span>
            Good morning.
          </h2>
          <p class="text-muted">How can KLAY help you mold your project today?</p>
        </div>

        <div class="mt-8 space-y-2">
          <p class="text-[10px] uppercase tracking-widest text-muted font-bold">Suggestions</p>
          <div class="flex flex-wrap gap-2">
            {#each getSuggestions($workspaceStore.activeModeId) as suggestion}
              <button
                class="px-3 py-1.5 text-xs text-muted border border-border rounded-lg hover:border-white/10 hover:text-main transition-colors"
                onclick={() => setSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#each $workspaceStore.messages as msg (msg.id)}
        <div class="flex gap-4 {msg.role === 'user' ? 'mt-8' : 'mt-6'}">
          {#if msg.role === 'user'}
            <div class="w-8 h-8 rounded flex items-center justify-center text-xs font-mono shrink-0 bg-white/5">U</div>
          {:else}
            <div class="w-8 h-8 rounded flex items-center justify-center text-xs font-mono shrink-0" style="background-color: {$activeColor}15">K</div>
          {/if}
          <div class="flex-1 space-y-2 min-w-0">
            <p class="text-sm text-main leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            {#if msg.mode}
              <div class="flex items-center gap-2 mt-2">
                <span
                  class="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style="background-color: {$activeColor}15; color: {$activeColor}"
                >
                  {msg.mode}
                </span>
                <span class="text-[10px] text-muted">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="p-6 border-t border-border bg-deep/50">
    <div class="max-w-3xl mx-auto relative">
      <div
        class="relative rounded-xl border transition-all duration-200 {isFocused ? 'border-white/15' : 'border-white/[0.08]'}"
        style="background-color: rgba(255,255,255,0.02)"
      >
        <textarea
          bind:value={inputText}
          onkeydown={handleKeydown}
          onfocus={() => isFocused = true}
          onblur={() => isFocused = false}
          placeholder="Type a message or '/' for commands..."
          class="w-full bg-transparent border-0 px-4 py-3 text-sm focus:outline-none resize-none min-h-[60px] max-h-[200px] text-main placeholder:text-muted/50"
          rows="1"
        ></textarea>

        <div class="flex items-center justify-between px-3 pb-2">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded" style="background-color: {$activeColor}12; color: {$activeColor}">
              {$activeMode?.name || 'Ready'}
            </span>
            {#if $modeStore.hybridModeIds.length > 0}
              <span class="text-[10px] text-muted font-mono">+{$modeStore.hybridModeIds.length}</span>
            {/if}
          </div>
          <button
            onclick={handleSubmit}
            disabled={!inputText.trim()}
            class="px-3 py-1 text-xs font-mono rounded-lg transition-all duration-150 disabled:opacity-30"
            style="background-color: {$activeColor}20; color: {$activeColor}"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  </div>

  <ThinkingBar />
</div>
