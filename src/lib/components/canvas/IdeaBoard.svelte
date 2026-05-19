<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { workspaceStore } from '$lib/stores/workspace';
  import { activeMode, activeColor } from '$lib/stores/modes';
  import { X, Plus, Link, Trash2, Minimize2 } from 'lucide-svelte';

  let container: HTMLDivElement;
  let stage: Konva.Stage;
  let layer: Konva.Layer;
  let connectionLayer: Konva.Layer;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316'];

  interface Note {
    id: string;
    rect: Konva.Rect;
    text: Konva.Text;
    transformer: Konva.Transformer;
    group: Konva.Group;
    color: string;
  }

  interface Connection {
    id: string;
    fromId: string;
    toId: string;
    line: Konva.Arrow;
    label: Konva.Text;
  }

  let notes: Note[] = [];
  let connections: Connection[] = [];
  let noteCounter = 0;
  let connectingMode = false;
  let connectFrom: string | null = null;
  let stageWidth = 800;
  let stageHeight = 600;

  function createStickyNote(x: number, y: number, content = 'New idea...') {
    const id = `note_${noteCounter++}`;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const w = 200;
    const h = 180;

    const group = new Konva.Group({ x, y, draggable: true, id });

    const shadow = new Konva.Rect({
      width: w, height: h,
      fill: 'rgba(0,0,0,0.2)',
      cornerRadius: 8,
      offsetX: 3, offsetY: 3,
    });

    const rect = new Konva.Rect({
      width: w, height: h,
      fill: `${color}22`,
      stroke: color,
      strokeWidth: 1.5,
      cornerRadius: 8,
      shadowColor: 'rgba(0,0,0,0.3)',
      shadowBlur: 12,
      shadowOffset: { x: 0, y: 4 },
    });

    const text = new Konva.Text({
      x: 12, y: 12,
      width: w - 24, height: h - 24,
      text: content,
      fontSize: 13,
      fontFamily: 'Space Grotesk, sans-serif',
      fill: '#e2e2e6',
      lineHeight: 1.5,
    });

    // Make text editable on double click
    text.on('dblclick dbltap', () => {
      text.hide();
      layer.batchDraw();
      
      const input = document.createElement('textarea');
      input.value = text.text();
      input.style.cssText = `
        position: fixed;
        top: ${group.y() + text.y()}px;
        left: ${group.x() + text.x()}px;
        width: ${text.width()}px;
        min-height: ${text.height()}px;
        background: #0f0f12;
        color: #e2e2e6;
        border: 1px solid ${color};
        border-radius: 8px;
        padding: 12px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px;
        outline: none;
        resize: none;
        z-index: 9999;
      `;
      document.body.appendChild(input);
      input.focus();

      input.addEventListener('blur', () => {
        text.text(input.value);
        text.show();
        layer.batchDraw();
        input.remove();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          text.show();
          layer.batchDraw();
          input.remove();
        }
      });
    });

    group.add(shadow);
    group.add(rect);
    group.add(text);

    const transformer = new Konva.Transformer({
      nodes: [group],
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      rotateEnabled: true,
      borderStroke: color,
      anchorFill: color,
      anchorStroke: color,
      anchorSize: 8,
    });
    transformer.hide();

    group.on('click tap', () => {
      // Select this note
      notes.forEach(n => n.transformer.hide());
      transformer.show();
      layer.batchDraw();
    });

    group.on('dblclick dbltap', () => {
      // Select + center
      notes.forEach(n => n.transformer.hide());
      transformer.show();
      layer.batchDraw();
    });

    layer.add(group);
    layer.add(transformer);

    notes.push({ id, rect, text, transformer, group, color });
    layer.batchDraw();
  }

  function getGroupCenter(group: Konva.Group) {
    const rect = group.getClientRect();
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  function addConnection(fromId: string, toId: string) {
    if (fromId === toId) return;
    const exists = connections.some(c => 
      (c.fromId === fromId && c.toId === toId) || 
      (c.fromId === toId && c.toId === fromId)
    );
    if (exists) return;

    const fromNote = notes.find(n => n.id === fromId);
    const toNote = notes.find(n => n.id === toId);
    if (!fromNote || !toNote) return;

    const fromCenter = getGroupCenter(fromNote.group);
    const toCenter = getGroupCenter(toNote.group);

    const connId = `conn_${connections.length}`;

    const line = new Konva.Arrow({
      points: [fromCenter.x, fromCenter.y, toCenter.x, toCenter.y],
      stroke: '#5a5a5e',
      strokeWidth: 2,
      fill: '#5a5a5e',
      pointerLength: 6,
      pointerWidth: 4,
      hitStrokeWidth: 10,
    });

    const label = new Konva.Text({
      x: (fromCenter.x + toCenter.x) / 2,
      y: (fromCenter.y + toCenter.y) / 2 - 10,
      text: 'related',
      fontSize: 10,
      fontFamily: 'JetBrains Mono, monospace',
      fill: '#8d8d91',
    });

    connectionLayer.add(line);
    connectionLayer.add(label);
    connectionLayer.batchDraw();

    connections.push({ id: connId, fromId, toId, line, label });
  }

  function deleteSelected() {
    const toRemove = notes.filter(n => n.transformer.isVisible());
    for (const note of toRemove) {
      // Remove connections
      const connsToRemove = connections.filter(c => c.fromId === note.id || c.toId === note.id);
      for (const conn of connsToRemove) {
        conn.line.destroy();
        conn.label.destroy();
        connections = connections.filter(c => c.id !== conn.id);
      }
      note.transformer.destroy();
      note.group.destroy();
      notes = notes.filter(n => n.id !== note.id);
    }
    layer.batchDraw();
    connectionLayer.batchDraw();
  }

  function clearAll() {
    for (const note of notes) {
      note.transformer.destroy();
      note.group.destroy();
    }
    for (const conn of connections) {
      conn.line.destroy();
      conn.label.destroy();
    }
    notes = [];
    connections = [];
    layer.batchDraw();
    connectionLayer.batchDraw();
  }

  function toggleConnectMode() {
    connectingMode = !connectingMode;
    connectFrom = null;
    if (connectingMode) {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }
  }

  function handleStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (connectingMode) {
      const target = e.target;
      const parent = target.findAncestor('Group');
      if (parent && parent.id()) {
        const clickedId = parent.id();
        if (!connectFrom) {
          connectFrom = clickedId;
          // Highlight source
          const note = notes.find(n => n.id === clickedId);
          if (note) {
            note.rect.strokeWidth(3);
            layer.batchDraw();
          }
        } else if (connectFrom !== clickedId) {
          addConnection(connectFrom, clickedId);
          // Reset highlight
          const note = notes.find(n => n.id === connectFrom);
          if (note) note.rect.strokeWidth(1.5);
          connectFrom = null;
          connectingMode = false;
          document.body.style.cursor = 'default';
          layer.batchDraw();
        }
      }
    } else {
      // Click on empty space deselects
      if (e.target === e.target.getStage()) {
        notes.forEach(n => n.transformer.hide());
        layer.batchDraw();
      }
    }
  }

  function handleStageContextMenu(e: Konva.KonvaEventObject<MouseEvent>) {
    const pos = stage.getPointerPosition();
    if (pos) {
      createStickyNote(pos.x - 100, pos.y - 90);
    }
  }

  $: if (stage) {
    const pos = stage.getPointerPosition();
    if (pos && connectingMode && connectFrom) {
      // Could draw temporary line here
    }
  }

  onMount(() => {
    const rect = container.getBoundingClientRect();
    stageWidth = rect.width || 800;
    stageHeight = rect.height || 600;

    stage = new Konva.Stage({
      container,
      width: stageWidth,
      height: stageHeight,
    });

    connectionLayer = new Konva.Layer();
    layer = new Konva.Layer();

    stage.add(connectionLayer);
    stage.add(layer);

    stage.on('click', handleStageClick);
    stage.on('contextmenu', handleStageContextMenu);

    // Create some demo notes
    createStickyNote(80, 80, 'Main idea');
    createStickyNote(350, 60, 'Research findings');
    createStickyNote(200, 280, 'Action items');
    addConnection('note_0', 'note_1');
    addConnection('note_0', 'note_2');

    // Deselect all initially
    setTimeout(() => {
      notes.forEach(n => n.transformer.hide());
      layer.batchDraw();
    }, 100);
  });

  onDestroy(() => {
    if (stage) stage.destroy();
  });
</script>

<div class="flex flex-col h-full bg-deep">
  <!-- Toolbar -->
  <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-sidebar/80">
    <div class="flex items-center gap-1.5">
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={() => createStickyNote(100 + Math.random() * 200, 100 + Math.random() * 200)}
        title="Add sticky note"
      >
        <Plus size={15} />
      </button>
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={toggleConnectMode}
        title="Connect notes"
        style="color: {connectingMode ? $activeColor : undefined}"
      >
        <Link size={15} />
      </button>
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={deleteSelected}
        title="Delete selected"
      >
        <Trash2 size={15} />
      </button>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-[10px] text-muted font-mono">{notes.length} notes | {connections.length} connections</span>
      <button
        class="p-1.5 text-muted hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
        onclick={clearAll}
        title="Clear board"
      >
        <Minimize2 size={15} />
      </button>
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={() => workspaceStore.toggleIdeaBoard()}
        title="Close"
      >
        <X size={15} />
      </button>
    </div>
  </div>

  <!-- Canvas -->
  <div class="flex-1 overflow-hidden">
    <div bind:this={container} class="w-full h-full"></div>
  </div>

  <!-- Hint bar -->
  <div class="px-4 py-1.5 border-t border-border bg-sidebar/60">
    <p class="text-[10px] text-muted font-mono">
      <span class="text-white/30">Double-click note to edit · Right-click canvas to add · Click + Link to connect</span>
    </p>
  </div>
</div>

<style>
  :global(.konva-container) {
    cursor: default;
  }
</style>
