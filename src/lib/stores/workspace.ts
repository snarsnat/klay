import { writable, type Writable } from 'svelte/store';
import type { WorkspaceState, ChatMessage, CommandRequest, ChatSession } from '$lib/types';

// Streaming control
let _stopStream: (() => void) | null = null;
export function registerStopStream(fn: () => void) { _stopStream = fn; }
export function clearStopStream() { _stopStream = null; }
export function stopStream() { _stopStream?.(); _stopStream = null; }

// Chat sessions (persisted in memory for this session)
export const chatSessions = writable<ChatSession[]>([]);
export const isStreaming = writable(false);
export const streamStartTime = writable<number>(0);
export const thinkingStartTime = writable<number>(0);
export const pendingCommands = writable<CommandRequest[]>([]);
export const projectRoot = writable<string>('.');
export const deepThinking = writable<boolean>(false);

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

    /** Update the last assistant message (for streaming) */
    updateLastMessage(content: string) {
      update(state => {
        const msgs = [...state.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') {
            msgs[i] = { ...msgs[i], content };
            break;
          }
        }
        return { ...state, messages: msgs };
      });
    },

    /** Append thinking text to the last assistant message */
    updateLastMessageThinking(thinking: string) {
      update(state => {
        const msgs = [...state.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') {
            msgs[i] = { ...msgs[i], thinking };
            break;
          }
        }
        return { ...state, messages: msgs };
      });
    },

    /** Toggle thinking collapsed on a message */
    toggleMessageThinking(id: string) {
      update(state => ({
        ...state,
        messages: state.messages.map(m =>
          m.id === id ? { ...m, thinkingCollapsed: !m.thinkingCollapsed } : m
        )
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
    },

    /** Expose raw update for complex transforms */
    update,
  };
}

export const workspaceStore = createWorkspaceStore();
