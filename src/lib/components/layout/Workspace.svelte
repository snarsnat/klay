<script lang="ts">
  import ThinkingBar from './ThinkingBar.svelte';
  import MarkdownRenderer from '$lib/components/chat/MarkdownRenderer.svelte';
  import { workspaceStore, isStreaming, streamStartTime, thinkingStartTime, pendingCommands, projectRoot, deepThinking, registerStopStream, clearStopStream, stopStream } from '$lib/stores/workspace';
  import { modeStore, activeMode, activeColor } from '$lib/stores/modes';
  import { settingsStore } from '$lib/stores/settings';
  import { streamChat, checkHealth, executeCommand } from '$lib/services/api';
  import { get } from 'svelte/store';
  import ApiConfigModal from '$lib/components/settings/ApiConfigModal.svelte';
  import { Settings2, ChevronDown, ChevronRight, Hexagon, Code2, Sparkles, Paintbrush, Search, Zap, Circle, Square, Brain, Play } from 'lucide-svelte';
  import { slide, fade } from 'svelte/transition';
  import { tick } from 'svelte';
  import type { CommandRequest } from '$lib/types';
  import { modelSupportsThinking } from '$lib/types';

  // ID of the message currently being streamed (for circle indicator)
  let streamingMessageId = $state<string | null>(null);

  let thinkingAvailable = $derived(modelSupportsThinking($settingsStore.defaultModel || ''));

  let inputText = $state('');
  let chatContainer: HTMLDivElement;
  let isFocused = $state(false);
  let showApiConfig = $state(false);
  let showModeMenu = $state(false);

  const modeIconMap: Record<string, any> = { Hexagon, Code2, Sparkles, Paintbrush, Search, Zap };
  function getModeIcon(name: string) { return modeIconMap[name] || Circle; }

  function selectMode(id: string) {
    modeStore.setActiveMode(id);
    showModeMenu = false;
  }

  function closeModeMenu(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.mode-menu-anchor')) showModeMenu = false;
  }

  const suggestions: Record<string, string[]> = {
    reasoning: ['Analyze this architecture', 'Debug a complex issue', 'Optimize this algorithm'],
    coding: ['Write a Rust module', 'Refactor this TypeScript', 'Add error handling'],
    creative: ['Brainstorm feature ideas', 'Design a new UI concept', 'Generate creative copy'],
    design: ['Review UI component', 'Suggest layout improvements', 'Create style guide'],
    research: ['Research best practices', 'Compare technologies', 'Find documentation'],
    execution: ['Run build commands', 'Deploy application', 'Execute test suite'],
  };

  function getSuggestions(modeId: string): string[] {
    return suggestions[modeId] || ['Start a conversation'];
  }

  // Command approval — resolvers keyed by command id
  const commandResolvers = new Map<string, (output: string) => void>();

  function handleCommandRun(cmdId: string) {
    pendingCommands.update(cmds =>
      cmds.map(c => c.id === cmdId ? { ...c, status: 'running' } : c)
    );
    const cmd = get(pendingCommands).find(c => c.id === cmdId);
    if (!cmd) return;
    executeCommand(cmd.command, get(projectRoot)).then(res => {
      pendingCommands.update(cmds =>
        cmds.map(c => c.id === cmdId ? { ...c, status: 'done', output: res.output } : c)
      );
      commandResolvers.get(cmdId)?.(res.output);
      commandResolvers.delete(cmdId);
    });
  }

  function handleCommandCancel(cmdId: string) {
    pendingCommands.update(cmds =>
      cmds.map(c => c.id === cmdId ? { ...c, status: 'cancelled' } : c)
    );
    commandResolvers.get(cmdId)?.('User cancelled');
    commandResolvers.delete(cmdId);
  }

  // Handle run command from MarkdownRenderer (inline code block)
  function handleInlineCommand(event: CustomEvent<{ command: string; description: string }>) {
    const id = crypto.randomUUID();
    const cmd: CommandRequest = {
      id,
      command: event.detail.command,
      description: event.detail.description,
      status: 'pending',
    };
    pendingCommands.update(cmds => [...cmds, cmd]);
    handleCommandRun(id);
  }

  function expandSlashCommand(raw: string): string {
    const videoMatch = raw.match(/^\/video\s+(.*)/is);
    if (videoMatch) {
      return `Generate a video with Higgsfield AI using the generate_video tool. Prompt: ${videoMatch[1].trim()}`;
    }
    const imageMatch = raw.match(/^\/image\s+(.*)/is);
    if (imageMatch) {
      return `Generate an image with Higgsfield AI using the generate_image tool. Prompt: ${imageMatch[1].trim()}`;
    }
    return raw;
  }

  async function handleSubmit() {
    const raw = inputText.trim();
    if (!raw) return;
    const text = expandSlashCommand(raw);

    workspaceStore.addMessage({ role: 'user', content: raw, mode: $modeStore.activeModeId });
    inputText = '';
    workspaceStore.startThinking(`${$activeMode?.name || 'Active'} mode processing...`);

    const s = get(settingsStore);
    const model = s.defaultModel || '';
    const apiKey = s.apiKeys ? Object.values(s.apiKeys)[0] : undefined;
    const messages = $workspaceStore.messages.map((m, i, arr) =>
      // Replace last user message with slash-command-expanded text for the AI
      (m.role === 'user' && i === arr.length - 1)
        ? { role: m.role, content: text }
        : { role: m.role, content: m.content }
    );
    const backendAlive = await checkHealth();

    if (!backendAlive) {
      workspaceStore.addMessage({ role: 'assistant', content: 'Backend not running. Start with: `uvicorn backend.main:app --reload --port 8000`' });
      workspaceStore.stopThinking();
      return;
    }

    if (!model) {
      workspaceStore.addMessage({ role: 'assistant', content: '⚠️ No model selected. Open Settings to choose a model.' });
      workspaceStore.stopThinking();
      return;
    }

    // Add assistant placeholder
    workspaceStore.addMessage({ role: 'assistant', content: '', mode: $modeStore.activeModeId });

    // Track which message is streaming for the circle indicator
    const allMsgs = $workspaceStore.messages;
    const lastMsg = allMsgs[allMsgs.length - 1];
    streamingMessageId = lastMsg?.id ?? null;

    // Timing
    const thinkStart = Date.now();
    thinkingStartTime.set(thinkStart);
    let responseStart = 0;
    let assistantContent = '';
    let thinkingContent = '';
    let thinkingDoneCollapsed = false;

    isStreaming.set(true);
    streamStartTime.set(Date.now());

    const stopFn = streamChat(
      {
        model,
        messages,
        temperature: 0.7,
        deepThinking: $deepThinking,
        agentic: true,
        projectRoot: get(projectRoot),
      },
      {
        onChunk(chunk) {
          if (responseStart === 0) {
            responseStart = Date.now();
            // Auto-collapse thinking block when content starts arriving
            if (thinkingContent && !thinkingDoneCollapsed) {
              thinkingDoneCollapsed = true;
              if (streamingMessageId) workspaceStore.toggleMessageThinking(streamingMessageId);
            }
          }
          assistantContent += chunk;
          workspaceStore.updateLastMessage(assistantContent);
        },
        onThinking(text) {
          thinkingContent += text;
          workspaceStore.updateLastMessageThinking(thinkingContent);
        },
        async onToolCall(id, command, description) {
          const cmdId = crypto.randomUUID();
          const cmd: CommandRequest = { id: cmdId, command, description, status: 'pending' };
          pendingCommands.update(cmds => [...cmds, cmd]);
          // Append command block notice to chat
          assistantContent += `\n\n> Running: \`${command}\`\n`;
          workspaceStore.updateLastMessage(assistantContent);
          return new Promise<string>(resolve => {
            commandResolvers.set(cmdId, resolve);
          });
        },
        onToolExecuted(tool, result) {
          assistantContent += `\n\n> ✓ ${tool}: \`${result.slice(0, 120)}\`\n`;
          workspaceStore.updateLastMessage(assistantContent);
        },
        onDone(usage) {
          workspaceStore.stopThinking();
          isStreaming.set(false);
          streamingMessageId = null;
          clearStopStream();
        },
        onError(err) {
          workspaceStore.updateLastMessage(assistantContent + `\n\n⚠️ **Error**\n\n${err}`);
          workspaceStore.stopThinking();
          isStreaming.set(false);
          streamingMessageId = null;
          clearStopStream();
        },
      },
      apiKey as string | undefined,
    );

    registerStopStream(() => {
      stopFn();
      streamingMessageId = null;
      const now = Date.now();
      const thinkMs = (responseStart > 0 ? responseStart : now) - thinkStart;
      const respMs = responseStart > 0 ? now - responseStart : 0;
      workspaceStore.update(state => {
        const msgs = [...state.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') {
            msgs[i] = { ...msgs[i], stopped: true, stopStats: { thinkingMs: thinkMs, responseMs: respMs } };
            break;
          }
        }
        return { ...state, messages: msgs, isThinking: false };
      });
      isStreaming.set(false);
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit().catch(console.error);
    }
  }

  $effect(() => {
    // Subscribe to messages and streaming to trigger scroll
    const _ = $workspaceStore.messages.length;
    const __ = $isStreaming;
    tick().then(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    });
  });

  function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }
</script>

<div class="flex-1 flex flex-col h-full bg-deep relative" onclick={closeModeMenu} role="presentation">
  <div class="h-0.5 w-full transition-colors duration-500" style="background-color: {$activeColor}33"></div>

  <div class="flex-1 overflow-y-auto min-h-0 p-8 space-y-6" bind:this={chatContainer}>
    <div class="max-w-3xl mx-auto w-full">
      {#if $workspaceStore.messages.length === 0}
        <div class="space-y-4">
          <h2 class="text-2xl font-bold font-sans flex items-center gap-3">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: {$activeColor}"></span>
            Good morning.
          </h2>
          <p class="text-muted text-sm">How can KLAY help you mold your project today?</p>
        </div>
        <div class="mt-8 space-y-2">
          <p class="text-[10px] uppercase tracking-widest text-muted font-bold">Suggestions</p>
          <div class="flex flex-wrap gap-2">
            {#each getSuggestions($workspaceStore.activeModeId) as suggestion}
              <button
                class="px-3 py-1.5 text-xs text-muted border border-border rounded-lg hover:border-white/10 hover:text-main transition-colors"
                onclick={() => { inputText = suggestion; }}
              >{suggestion}</button>
            {/each}
          </div>
        </div>
      {/if}

      {#each $workspaceStore.messages as msg (msg.id)}
        {@const isThisStreaming = streamingMessageId === msg.id}
        {@const isThisProcessing = isThisStreaming && !msg.content}
        <div class="flex gap-4 {msg.role === 'user' ? 'mt-8' : 'mt-6'}">
          {#if msg.role === 'user'}
            <div class="w-8 h-8 rounded flex items-center justify-center text-xs shrink-0 bg-white/5 text-muted">U</div>
          {:else}
            <!-- AI circle indicator -->
            <div class="w-8 h-8 shrink-0 flex items-center justify-center relative">
              <!-- Pulse rings when processing (waiting for first token) -->
              {#if isThisProcessing}
                <span class="absolute w-8 h-8 rounded-full animate-ping opacity-20" style="background-color: {$activeColor}"></span>
                <span class="absolute w-5 h-5 rounded-full animate-ping opacity-30" style="background-color: {$activeColor}; animation-delay: 0.3s"></span>
              {/if}
              <!-- Core circle -->
              <span
                class="w-4 h-4 rounded-full transition-all duration-300 {isThisStreaming ? 'opacity-90 scale-110' : 'opacity-40'}"
                style="background-color: {$activeColor}"
              ></span>
            </div>
          {/if}
          <div class="flex-1 min-w-0 space-y-2">
            <!-- Thinking block -->
            {#if msg.thinking}
              <div class="mb-2">
                <button
                  class="flex items-center gap-1.5 text-[10px] font-mono text-white/25 hover:text-white/40 transition-colors"
                  onclick={() => workspaceStore.toggleMessageThinking(msg.id)}
                >
                  {#if msg.thinkingCollapsed}
                    <ChevronRight size={9} />
                    <span>thought</span>
                  {:else}
                    <ChevronDown size={9} />
                    <span>thinking</span>
                  {/if}
                </button>
                {#if !msg.thinkingCollapsed}
                  <div transition:slide={{ duration: 150 }} class="mt-1.5 pl-3 border-l border-white/[0.07] space-y-1">
                    <p class="text-[11px] text-white/20 leading-relaxed whitespace-pre-wrap">{msg.thinking}</p>
                  </div>
                {/if}
              </div>
            {/if}

            <!-- Message content -->
            {#if msg.role === 'assistant'}
              <MarkdownRenderer content={msg.content} on:runCommand={handleInlineCommand} />
            {:else}
              <p class="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            {/if}

            <!-- Stop stats -->
            {#if msg.stopped && msg.stopStats}
              <div class="flex items-center gap-3 pt-1">
                <span class="text-[10px] font-mono text-white/15">stopped</span>
                <span class="text-[10px] font-mono text-white/15">thinking {formatMs(msg.stopStats.thinkingMs)}</span>
                <span class="text-[10px] font-mono text-white/15">response {formatMs(msg.stopStats.responseMs)}</span>
              </div>
            {/if}

            <!-- Metadata -->
            {#if msg.mode}
              <div class="flex items-center gap-2 mt-1">
                <span class="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded" style="background-color: {$activeColor}15; color: {$activeColor}">
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

      <!-- Pending command blocks -->
      {#each $pendingCommands.filter(c => c.status === 'pending') as cmd (cmd.id)}
        <div class="ml-12 mt-4 rounded-xl overflow-hidden border border-amber-500/15 bg-amber-500/[0.03]">
          <div class="flex items-center justify-between px-3 py-2 bg-amber-500/[0.05] border-b border-amber-500/10">
            <span class="text-[10px] font-mono text-amber-400/60 uppercase tracking-wider">Command Permissions</span>
          </div>
          <pre class="px-3 py-2 text-xs font-mono text-amber-200/70 overflow-x-auto">{cmd.command}</pre>
          <div class="flex items-center justify-between px-3 py-2 border-t border-amber-500/08">
            <span class="text-[10px] text-white/20 font-mono">{cmd.description}</span>
            <div class="flex gap-2">
              <button onclick={() => handleCommandCancel(cmd.id)} class="text-[10px] font-mono text-white/25 hover:text-white/40 transition-colors">cancel</button>
              <button onclick={() => handleCommandRun(cmd.id)} class="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300/80 hover:bg-amber-500/25 transition-colors">
                <Play size={9} />Run
              </button>
            </div>
          </div>
        </div>
      {/each}

      <!-- Circle + status when streaming but no message yet (edge case) -->
      {#if $isStreaming && !streamingMessageId}
        <div class="flex gap-4 mt-6" transition:fade={{ duration: 150 }}>
          <div class="w-8 h-8 shrink-0 flex items-center justify-center relative">
            <span class="absolute w-8 h-8 rounded-full animate-ping opacity-20" style="background-color: {$activeColor}"></span>
            <span class="w-4 h-4 rounded-full" style="background-color: {$activeColor}"></span>
          </div>
          <div class="flex-1 min-w-0 pt-2.5">
            <span class="text-[11px] text-white/20">{$workspaceStore.thinkingStatus}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Chat input bar -->
  <div class="p-6 border-t border-border bg-deep/50" role="presentation">
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
          disabled={$isStreaming}
        ></textarea>

        <div class="flex items-center justify-end px-3 pb-2 gap-2">
          <!-- Deep thinking toggle -->
          <button
            onclick={() => { if (thinkingAvailable) deepThinking.update(v => !v); }}
            class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono rounded-lg transition-all duration-150
              {thinkingAvailable ? 'hover:bg-white/5 cursor-pointer' : 'cursor-not-allowed opacity-30'}
              {$deepThinking && thinkingAvailable ? 'text-purple-400' : thinkingAvailable ? 'text-muted' : 'text-white/30'}"
            title={thinkingAvailable ? 'Toggle deep thinking' : 'Deep thinking not available for this model'}
          >
            <Brain size={12} />
            {#if $deepThinking && thinkingAvailable}<span>deep</span>{/if}
          </button>

          <!-- Mode selector -->
          <div class="relative mode-menu-anchor">
            <button
              onclick={(e) => { e.stopPropagation(); showModeMenu = !showModeMenu; }}
              class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono rounded-lg transition-all duration-150 hover:bg-white/5"
              style="color: {$activeColor}"
              title="Switch mode"
            >
              {#each [getModeIcon($activeMode?.icon || '')] as ModeIcon}
                <ModeIcon size={11} />
              {/each}
              {$activeMode?.name || 'Mode'}
              <ChevronDown size={9} />
            </button>

            {#if showModeMenu}
              <div
                class="absolute bottom-full right-0 mb-2 w-44 rounded-xl border border-white/[0.08] overflow-hidden z-50"
                style="background-color: #0f0f12"
                transition:slide={{ duration: 120 }}
                onclick={(e) => e.stopPropagation()}
                role="menu"
                tabindex="-1"
              >
                {#each $modeStore.modes as mode}
                  {@const ItemIcon = getModeIcon(mode.icon || '')}
                  <button
                    role="menuitem"
                    onclick={() => selectMode(mode.id)}
                    class="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-white/[0.04] {$modeStore.activeModeId === mode.id ? 'text-main' : 'text-muted'}"
                  >
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: {mode.color}"></span>
                    <ItemIcon size={11} color={$modeStore.activeModeId === mode.id ? mode.color : undefined} />
                    <span class="font-mono">{mode.name}</span>
                    {#if $modeStore.activeModeId === mode.id}
                      <span class="ml-auto w-1 h-1 rounded-full" style="background-color: {mode.color}"></span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <button
            onclick={() => showApiConfig = true}
            class="px-2 py-1 text-xs rounded-lg transition-all duration-150 text-muted hover:text-main hover:bg-white/5"
            title="API Configuration"
          >
            <Settings2 size={14} />
          </button>

          <!-- Stop / Send -->
          {#if $isStreaming}
            <button
              onclick={() => stopStream()}
              class="flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-all duration-150 bg-red-500/15 text-red-400 hover:bg-red-500/25"
            >
              <Square size={10} />Stop
            </button>
          {:else}
            <button
              onclick={handleSubmit}
              disabled={!inputText.trim()}
              class="px-3 py-1 text-xs font-mono rounded-lg transition-all duration-150 disabled:opacity-30"
              style="background-color: {$activeColor}20; color: {$activeColor}"
            >
              Send
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <ThinkingBar />
</div>

{#if showApiConfig}
  <ApiConfigModal onClose={() => showApiConfig = false} />
{/if}
