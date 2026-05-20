import { writable, type Writable } from 'svelte/store';
import type { FileNode } from '$lib/types';

interface FileExplorerState {
  root: FileNode | null;
  expandedPaths: Set<string>;
  loading: boolean;
  error: string | null;
}

/**
 * Try to get Tauri invoke if available (desktop only).
 * In browser dev mode, falls back to building tree from known files.
 */
async function tauriInvoke(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke(cmd, args);
  } catch {
    throw new Error('Tauri not available — file tree works in the desktop app');
  }
}

function createFileExplorerStore() {
  const initial: FileExplorerState = {
    root: null,
    expandedPaths: new Set(),
    loading: false,
    error: null
  };

  const { subscribe, set, update }: Writable<FileExplorerState> = writable(initial);

  /** Build a basic tree from the known project files */
  function buildBrowserTree(): FileNode {
    const known = [
      'src/lib', 'src/lib/components', 'src/lib/stores', 'src/lib/services',
      'src/lib/styles', 'src/lib/components/layout', 'src/lib/components/canvas',
      'src/lib/components/panels', 'src/lib/components/onboarding',
      'src/routes', 'src-tauri/src', 'src-tauri/src/commands',
      'backend', 'modes',
    ];
    const files = [
      'package.json', 'vite.config.js', 'svelte.config.js', 'tsconfig.json',
      'tailwind.config.js', 'postcss.config.js', '.gitignore',
      'src/app.html', 'src/routes/+layout.ts', 'src/routes/+page.svelte',
      'src/lib/App.svelte', 'src/lib/types.ts', 'src/lib/styles/app.css',
      'src/lib/stores/modes.ts', 'src/lib/stores/workspace.ts',
      'src/lib/stores/files.ts', 'src/lib/stores/settings.ts',
      'src/lib/services/api.ts',
      'src/lib/components/layout/Sidebar.svelte',
      'src/lib/components/layout/Workspace.svelte',
      'src/lib/components/layout/FileExplorer.svelte',
      'src/lib/components/layout/FileTreeNode.svelte',
      'src/lib/components/layout/ThinkingBar.svelte',
      'src/lib/components/canvas/IdeaBoard.svelte',
      'src/lib/components/canvas/ImageEditor.svelte',
      'src/lib/components/panels/ComputerControl.svelte',
      'src/lib/components/panels/MemoryGraph.svelte',
      'src/lib/components/onboarding/OnboardingWizard.svelte',
      'backend/main.py',
      'src-tauri/Cargo.toml', 'src-tauri/tauri.conf.json',
      'src-tauri/src/lib.rs', 'src-tauri/src/main.rs',
      'src-tauri/src/commands/mod.rs', 'src-tauri/src/commands/modes.rs',
      'src-tauri/src/commands/files.rs', 'src-tauri/src/commands/ai.rs',
      'modes/coding.md', 'modes/creative.md', 'modes/reasoning.md',
    ];

    const root: FileNode = { name: 'klay', path: '.', type: 'directory', children: [] };
    const dirMap: Record<string, FileNode> = { '.': root };

    for (const dir of known) {
      const parts = dir.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const path = parts.slice(0, i + 1).join('/');
        if (!dirMap[path]) {
          const node: FileNode = {
            name: parts[i],
            path,
            type: 'directory',
            children: [],
          };
          current.children = current.children || [];
          current.children.push(node);
          dirMap[path] = node;
        }
        current = dirMap[path];
      }
    }

    for (const file of files) {
      const parts = file.split('/');
      const fileName = parts.pop()!;
      const dirPath = parts.join('/') || '.';
      const parent = dirMap[dirPath];
      if (parent) {
        parent.children = parent.children || [];
        const ext = fileName.includes('.') ? fileName.split('.').pop() : undefined;
        parent.children.push({
          name: fileName,
          path: file,
          type: 'file',
          extension: ext,
        });
      }
    }

    return root;
  }

  return {
    subscribe,

    /** Load the project file tree from backend or Tauri */
    async loadFileTree(root = '.') {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const tree = await tauriInvoke('get_file_tree', { rootPath: root }) as FileNode;
        update(state => ({ ...state, root: tree, loading: false }));
      } catch {
        try {
          const res = await fetch(`http://localhost:8000/api/files/list?root=${encodeURIComponent(root)}`);
          if (res.ok) {
            const data = await res.json();
            update(state => ({ ...state, root: data.tree as FileNode, loading: false }));
          } else {
            throw new Error('backend error');
          }
        } catch {
          update(state => ({
            ...state,
            root: null,
            loading: false,
            error: 'Set a project root to browse files.',
          }));
        }
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
