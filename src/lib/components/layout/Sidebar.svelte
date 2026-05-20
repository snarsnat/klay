<script lang="ts">
  import { Plus, Lightbulb, Image, Monitor, Network, MessageSquare, Trash2 } from 'lucide-svelte';
  import { activeColor } from '$lib/stores/modes';
  import { workspaceStore, chatSessions } from '$lib/stores/workspace';
  import type { ChatSession } from '$lib/types';

  function newChat() {
    const msgs = $workspaceStore.messages;
    if (msgs.length > 0) {
      const session: ChatSession = {
        id: crypto.randomUUID(),
        title: msgs[0]?.content?.slice(0, 40) || 'Chat',
        createdAt: Date.now(),
        messages: [...msgs],
      };
      chatSessions.update(s => [session, ...s].slice(0, 50));
    }
    workspaceStore.clearMessages();
  }

  function loadSession(session: ChatSession) {
    workspaceStore.clearMessages();
    for (const msg of session.messages) {
      workspaceStore.addMessage(msg);
    }
  }

  function deleteSession(id: string) {
    chatSessions.update(s => s.filter(x => x.id !== id));
  }
</script>

<aside class="w-60 bg-sidebar flex flex-col h-full border-r border-border shrink-0">
  <!-- Brand -->
  <div class="p-5 pb-3">
    <h1 class="text-xl font-bold tracking-tight font-sans flex items-center gap-3">
      <span class="w-2 h-2 rounded-full" style="background-color: {$activeColor}"></span>
      KLAY
    </h1>
    <p class="text-[10px] text-muted mt-0.5">Mold your projects</p>
  </div>

  <!-- New Chat -->
  <div class="px-3 mb-2">
    <button
      onclick={newChat}
      class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted hover:text-main border border-dashed border-border hover:border-white/10 transition-all duration-150"
    >
      <Plus size={13} />
      <span>New Chat</span>
    </button>
  </div>

  <!-- Scrollable area: history + modes -->
  <div class="flex-1 overflow-y-auto px-3 space-y-px">
    {#if $chatSessions.length > 0}
      <p class="text-[9px] uppercase tracking-widest text-muted px-2 pb-1 pt-1 font-bold">History</p>
      {#each $chatSessions as session}
        <div class="group flex items-center gap-1 rounded-lg hover:bg-white/[0.03] transition-colors">
          <button
            class="flex-1 flex items-center gap-2 px-2 py-1.5 text-left min-w-0"
            onclick={() => loadSession(session)}
          >
            <MessageSquare size={11} class="text-muted shrink-0" />
            <span class="text-[11px] text-muted truncate">{session.title}</span>
          </button>
          <button
            onclick={() => deleteSession(session.id)}
            class="opacity-0 group-hover:opacity-100 pr-2 text-muted hover:text-red-400 transition-all"
          >
            <Trash2 size={11} />
          </button>
        </div>
      {/each}
    {/if}

  </div>

  <!-- Workspace tools -->
  <div class="px-3 py-2 border-t border-border space-y-px">
    <p class="text-[9px] uppercase tracking-widest text-muted px-2 pb-1 font-bold">Workspace</p>
    {#each [
      { label: 'Idea Board', icon: Lightbulb, action: () => workspaceStore.toggleIdeaBoard() },
      { label: 'Image Editor', icon: Image, action: () => workspaceStore.toggleImageEditor() },
      { label: 'Browser Control', icon: Monitor, action: () => workspaceStore.toggleComputerControl() },
      { label: 'Memory Graph', icon: Network, action: () => workspaceStore.toggleMemoryGraph() },
    ] as item}
      <button
        class="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-muted hover:text-main hover:bg-white/[0.03] transition-all duration-150"
        onclick={item.action}
      >
        <item.icon size={13} />
        <span>{item.label}</span>
      </button>
    {/each}
  </div>
</aside>
