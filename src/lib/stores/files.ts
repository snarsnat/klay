import { writable, type Writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import type { FileNode } from '$lib/types';

interface FileExplorerState {
  root: FileNode | null;
  expandedPaths: Set<string>;
  loading: boolean;
  error: string | null;
}

function createFileExplorerStore() {
  const initial: FileExplorerState = {
    root: null,
    expandedPaths: new Set(),
    loading: false,
    error: null
  };

  const { subscribe, set, update }: Writable<FileExplorerState> = writable(initial);

  return {
    subscribe,

    /** Load the project file tree */
    async loadFileTree() {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const tree: FileNode = await invoke('get_file_tree', { rootPath: '.' });
        update(state => ({ ...state, root: tree, loading: false }));
      } catch (err) {
        update(state => ({ ...state, loading: false, error: String(err) }));
      }
    },

    /** Toggle directory expansion */
    togglePath(path: string) {
      update(state => {
        const next = new Set(state.expandedPaths);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return { ...state, expandedPaths: next };
      });
    },

    /** Reset */
    reset() {
      set(initial);
    }
  };
}

export const fileExplorerStore = createFileExplorerStore();
