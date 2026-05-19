<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Konva from 'konva';
  import { workspaceStore } from '$lib/stores/workspace';
  import { activeColor } from '$lib/stores/modes';
  import { analyzeImage, extractImageLayers } from '$lib/services/api';
  import { X, Upload, Layers, Scan, Download, Eye, EyeOff } from 'lucide-svelte';
  import type { ImageLayer, DetectedObject } from '$lib/types';

  let container: HTMLDivElement;
  let fileInput: HTMLInputElement;
  let stage: Konva.Stage;
  let mainLayer: Konva.Layer;
  let overlayLayer: Konva.Layer;

  let imageSrc: string | null = null;
  let layers: ImageLayer[] = [];
  let detectedObjects: DetectedObject[] = [];
  let isLoading = false;
  let stageWidth = 700;
  let stageHeight = 500;
  let imgWidth = 0;
  let imgHeight = 0;
  let selectedLayerId: string | null = null;
  let showOverlay = true;
  let analysisResult: string | null = null;

  function loadImage(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      imageSrc = e.target?.result as string;
      if (imageSrc) {
        await processImage(imageSrc);
      }
    };
    reader.readAsDataURL(file);
  }

  async function processImage(base64: string) {
    isLoading = true;
    try {
      // Strip data:image prefix for API
      const b64 = base64.includes('base64,') ? base64.split('base64,')[1] : base64;

      // Analyze the image
      const analysis = await analyzeImage(b64);
      detectedObjects = analysis.objects;
      analysisResult = analysis.analysis;

      // Extract layers
      const layerResult = await extractImageLayers(b64);
      layers = layerResult.layers;
      imgWidth = layerResult.width || analysis.width;
      imgHeight = layerResult.height || analysis.height;

      renderImage();
    } catch (e) {
      console.error('Image processing failed:', e);
      // Render at least the raw image
      renderImage();
    }
    isLoading = false;
  }

  function renderImage() {
    if (!stage || !imageSrc) return;

    mainLayer.destroyChildren();
    overlayLayer.destroyChildren();

    // Calculate scale to fit
    const padding = 40;
    const maxW = stageWidth - padding * 2;
    const maxH = stageHeight - padding * 2;
    const scale = Math.min(maxW / (imgWidth || 800), maxH / (imgHeight || 600), 2);
    const scaledW = (imgWidth || 800) * scale;
    const scaledH = (imgHeight || 600) * scale;
    const offsetX = (stageWidth - scaledW) / 2;
    const offsetY = (stageHeight - scaledH) / 2;

    // Background image
    const bgImage = new window.Image();
    bgImage.src = imageSrc;
    bgImage.onload = () => {
      const konvaImage = new Konva.Image({
        image: bgImage,
        x: offsetX,
        y: offsetY,
        width: scaledW,
        height: scaledH,
      });
      mainLayer.add(konvaImage);
      mainLayer.batchDraw();
    };

    // Object overlays
    if (showOverlay) {
      for (const obj of detectedObjects) {
        const rect = new Konva.Rect({
          x: offsetX + obj.x * scale,
          y: offsetY + obj.y * scale,
          width: obj.width * scale,
          height: obj.height * scale,
          stroke: '#10b981',
          strokeWidth: 2,
          dash: [4, 2],
          cornerRadius: 4,
        });
        overlayLayer.add(rect);

        const label = new Konva.Text({
          x: offsetX + obj.x * scale,
          y: offsetY + obj.y * scale - 18,
          text: `${obj.label} (${(obj.confidence * 100).toFixed(0)}%)`,
          fontSize: 11,
          fontFamily: 'JetBrains Mono, monospace',
          fill: '#10b981',
          background: '#0a0a0c',
          padding: 2,
        });
        overlayLayer.add(label);
      }

      // Layer borders
      for (const layer of layers) {
        if (layer.type !== 'background' && layer.visible) {
          const rect = new Konva.Rect({
            x: offsetX + layer.x * scale,
            y: offsetY + layer.y * scale,
            width: layer.width * scale,
            height: layer.height * scale,
            stroke: '#3b82f688',
            strokeWidth: 1,
            cornerRadius: 2,
          });
          overlayLayer.add(rect);

          const label = new Konva.Text({
            x: offsetX + layer.x * scale,
            y: offsetY + layer.y * scale - 16,
            text: layer.name,
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
            fill: '#3b82f688',
          });
          overlayLayer.add(label);
        }
      }
    }

    overlayLayer.batchDraw();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  }

  function onPaste(e: ClipboardEvent) {
    const file = e.clipboardData?.files[0];
    if (file && file.type.startsWith('image/')) {
      loadImage(file);
    }
  }

  function exportImage() {
    if (!stage) return;
    const dataUrl = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = 'klay-edited-image.png';
    link.href = dataUrl;
    link.click();
  }

  function reset() {
    imageSrc = null;
    layers = [];
    detectedObjects = [];
    analysisResult = null;
    mainLayer.destroyChildren();
    overlayLayer.destroyChildren();
    mainLayer.batchDraw();
    overlayLayer.batchDraw();
  }

  onMount(() => {
    const rect = container.getBoundingClientRect();
    stageWidth = rect.width || 700;
    stageHeight = rect.height || 500;

    stage = new Konva.Stage({
      container,
      width: stageWidth,
      height: stageHeight,
    });

    mainLayer = new Konva.Layer();
    overlayLayer = new Konva.Layer();
    stage.add(mainLayer);
    stage.add(overlayLayer);
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
        onclick={() => fileInput.click()}
        title="Upload image"
      >
        <Upload size={15} />
      </button>
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={exportImage}
        title="Export"
        disabled={!imageSrc}
      >
        <Download size={15} />
      </button>
      <div class="w-px h-4 bg-border mx-1"></div>
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={() => { showOverlay = !showOverlay; renderImage(); }}
        title="Toggle overlay"
        style="color: {showOverlay && imageSrc ? $activeColor : undefined}"
      >
        {#if showOverlay}
          <Eye size={15} />
        {:else}
          <EyeOff size={15} />
        {/if}
      </button>
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={reset}
        title="Reset"
        disabled={!imageSrc}
      >
        <X size={15} />
      </button>
    </div>

    <div class="flex items-center gap-2">
      {#if isLoading}
        <div class="flex items-center gap-2">
          <div class="animate-spin w-3 h-3 border border-muted border-t-transparent rounded-full"></div>
          <span class="text-[10px] text-muted font-mono">Processing...</span>
        </div>
      {:else if imageSrc}
        <span class="text-[10px] text-muted font-mono">{layers.length} layers | {detectedObjects.length} objects</span>
      {/if}
      <button
        class="p-1.5 text-muted hover:text-main rounded-md hover:bg-white/5 transition-colors"
        onclick={() => workspaceStore.toggleImageEditor()}
        title="Close"
      >
        <X size={15} />
      </button>
    </div>
  </div>

  <!-- Canvas -->
  <div
    class="flex-1 overflow-hidden relative"
    bind:this={container}
    ondragover={(e) => e.preventDefault()}
    ondrop={handleDrop}
    onpaste={onPaste}
  >
    {#if !imageSrc}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-xl border-2 border-dashed border-border flex items-center justify-center">
            <Upload size={20} class="text-muted" />
          </div>
          <p class="text-sm text-muted">Drop an image here or click Upload</p>
          <input
            type="file"
            accept="image/*"
            bind:this={fileInput}
            class="hidden"
            onchange={(e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) loadImage(file);
            }}
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Layers panel -->
  {#if layers.length > 0}
    <div class="px-4 py-2 border-t border-border bg-sidebar/60 max-h-28 overflow-y-auto">
      <p class="text-[10px] font-mono text-muted mb-1.5">LAYERS</p>
      <div class="flex flex-wrap gap-1.5">
        {#each layers as layer}
          <span
            class="text-[10px] font-mono px-2 py-0.5 rounded-full"
            style="background-color: {layer.visible ? '#ffffff0a' : '#ffffff04'}; color: {layer.visible ? '#e2e2e6' : '#5a5a5e'}"
          >
            {layer.name}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>
