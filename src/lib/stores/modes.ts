import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { Mode, ModeId, ModeState } from '$lib/types';
import { MODE_META } from '$lib/types';

/** Default built-in mode metadata */
function getDefaultModes(): Mode[] {
  return Object.entries(MODE_META).map(([id, meta]) => ({
    id,
    name: meta.name,
    content: '',
    color: meta.color,
    icon: meta.icon
  }));
}

function createModeStore() {
  const initial: ModeState = {
    modes: getDefaultModes(),
    activeModeId: 'reasoning',
    hybridModeIds: [],
    loading: false,
    error: null
  };

  const { subscribe, set, update }: Writable<ModeState> = writable(initial);

  return {
    subscribe,

    /** Set the active mode */
    setActiveMode(id: string) {
      update(state => ({ ...state, activeModeId: id }));
    },

    /** Toggle a hybrid mode on/off */
    toggleHybridMode(id: string) {
      update(state => {
        const isActive = state.hybridModeIds.includes(id);
        return {
          ...state,
          hybridModeIds: isActive
            ? state.hybridModeIds.filter(m => m !== id)
            : [...state.hybridModeIds, id]
        };
      });
    },

    /** Start loading modes from backend */
    async loadModes() {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        // Try loading via Tauri command first
        let fileModes: Mode[] = [];
        try {
          fileModes = await invoke('load_modes');
        } catch {
          // Fall back to built-in modes
        }

        update(state => {
          // Merge loaded file modes with defaults — file modes override
          const modeMap = new Map(state.modes.map(m => [m.id, m]));
          for (const mode of fileModes) {
            // Preserve default colors/icons for known modes
            const defaults = MODE_META[mode.id];
            if (defaults) {
              mode.color = defaults.color;
              mode.icon = defaults.icon;
            }
            modeMap.set(mode.id, mode);
          }
          return {
            ...state,
            modes: Array.from(modeMap.values()),
            loading: false
          };
        });
      } catch (err) {
        update(state => ({
          ...state,
          loading: false,
          error: String(err)
        }));
      }
    },

    /** Reset to defaults */
    reset() {
      set(initial);
    }
  };
}

export const modeStore = createModeStore();

/** Derived: current active mode object */
export const activeMode: Readable<Mode | undefined> = derived(
  modeStore,
  ($store) => $store.modes.find(m => m.id === $store.activeModeId)
);

/** Derived: currently active color */
export const activeColor: Readable<string> = derived(
  activeMode,
  ($mode) => $mode?.color ?? '#ffffff'
);

/** Derived: list of all modes */
export const allModes: Readable<Mode[]> = derived(
  modeStore,
  ($store) => $store.modes
);

/** Derived: whether any modes are loading */
export const modesLoading: Readable<boolean> = derived(
  modeStore,
  ($store) => $store.loading
);

/** Derived: hybrid mode objects */
export const hybridModes: Readable<Mode[]> = derived(
  modeStore,
  ($store) => $store.modes.filter(m => $store.hybridModeIds.includes(m.id))
);
