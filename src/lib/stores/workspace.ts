import { writable, type Writable } from 'svelte/store';
import type { WorkspaceState, ChatMessage } from '$lib/types';

function createWorkspaceStore() {
  const initial: WorkspaceState = {
    isThinking: false,
    thinkingStatus: 'Ready',
    activeModeId: 'reasoning',
    messages: [],
    showIdeaBoard: false,
    showImageEditor: false,
    showComputerControl: false,
    showMemoryGraph: false
  };

  const { subscribe, set, update }: Writable<WorkspaceState> = writable(initial);

  return {
    subscribe,

    /** Start thinking state */
    startThinking(status: string = 'Thinking...') {
      update(state => ({ ...state, isThinking: true, thinkingStatus: status }));
    },

    /** Stop thinking state */
    stopThinking() {
      update(state => ({ ...state, isThinking: false, thinkingStatus: 'Ready' }));
    },

    /** Update thinking status text */
    setThinkingStatus(status: string) {
      update(state => ({ ...state, thinkingStatus: status }));
    },

    /** Add a message */
    addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>) {
      const msg: ChatMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      };
      update(state => ({
        ...state,
        messages: [...state.messages, msg]
      }));
    },

    /** Clear all messages */
    clearMessages() {
      update(state => ({ ...state, messages: [] }));
    },

    /** Toggle idea board */
    toggleIdeaBoard() {
      update(state => ({ ...state, showIdeaBoard: !state.showIdeaBoard }));
    },

    toggleImageEditor() {
      update(state => ({ ...state, showImageEditor: !state.showImageEditor }));
    },

    toggleComputerControl() {
      update(state => ({ ...state, showComputerControl: !state.showComputerControl }));
    },

    toggleMemoryGraph() {
      update(state => ({ ...state, showMemoryGraph: !state.showMemoryGraph }));
    },

    /** Reset workspace */
    reset() {
      set(initial);
    }
  };
}

export const workspaceStore = createWorkspaceStore();
