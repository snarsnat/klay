<script lang="ts">
  import { marked } from 'marked';
  import { createEventDispatcher } from 'svelte';

  interface Props {
    content: string;
  }
  let { content }: Props = $props();

  const dispatch = createEventDispatcher<{ runCommand: { command: string; description: string } }>();

  const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', 'fish', 'cmd', 'powershell', 'ps1']);

  interface Block {
    type: 'html' | 'code';
    html?: string;
    lang?: string;
    code?: string;
  }

  function parseBlocks(md: string): Block[] {
    const blocks: Block[] = [];
    // Split on fenced code blocks
    const parts = md.split(/(```[\s\S]*?```)/g);
    for (const part of parts) {
      const fence = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (fence) {
        blocks.push({ type: 'code', lang: fence[1] || 'text', code: fence[2].trimEnd() });
      } else if (part.trim()) {
        // Render non-code markdown
        const html = marked.parse(part, { async: false }) as string;
        blocks.push({ type: 'html', html });
      }
    }
    return blocks;
  }

  let blocks = $derived(parseBlocks(content));

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).catch(() => {});
  }
</script>

<div class="markdown-body">
  {#each blocks as block}
    {#if block.type === 'html'}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      {@html block.html}
    {:else if block.type === 'code'}
      {#if SHELL_LANGS.has(block.lang ?? '')}
        <div class="command-block">
          <div class="command-header">
            <span class="command-label">Command Permissions</span>
            <button class="copy-btn" onclick={() => copyCode(block.code ?? '')}>copy</button>
          </div>
          <pre class="command-code"><code>{block.code}</code></pre>
          <div class="command-footer">
            <span class="command-desc">Shell command — review before running</span>
            <button
              class="run-btn"
              onclick={() => dispatch('runCommand', { command: block.code ?? '', description: 'Shell command from AI response' })}
            >Run</button>
          </div>
        </div>
      {:else}
        <div class="code-block">
          <div class="code-header">
            <span class="code-lang">{block.lang || 'code'}</span>
            <button class="copy-btn" onclick={() => copyCode(block.code ?? '')}>copy</button>
          </div>
          <pre><code>{block.code}</code></pre>
        </div>
      {/if}
    {/if}
  {/each}
</div>

<style>
  .markdown-body {
    font-size: 0.875rem;
    line-height: 1.7;
    color: #e2e2e6;
  }

  .markdown-body :global(p) {
    margin: 0.5em 0;
  }

  .markdown-body :global(h1),
  .markdown-body :global(h2),
  .markdown-body :global(h3),
  .markdown-body :global(h4) {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600;
    margin: 1em 0 0.4em;
    color: #f4f4f5;
  }

  .markdown-body :global(h1) { font-size: 1.25rem; }
  .markdown-body :global(h2) { font-size: 1.1rem; }
  .markdown-body :global(h3) { font-size: 1rem; }

  .markdown-body :global(ul),
  .markdown-body :global(ol) {
    padding-left: 1.25rem;
    margin: 0.4em 0;
  }

  .markdown-body :global(li) {
    margin: 0.2em 0;
  }

  .markdown-body :global(blockquote) {
    border-left: 2px solid rgba(255,255,255,0.1);
    padding-left: 0.75rem;
    color: rgba(255,255,255,0.45);
    margin: 0.5em 0;
  }

  .markdown-body :global(a) {
    color: #60a5fa;
    text-decoration: none;
  }

  .markdown-body :global(strong) {
    color: #f4f4f5;
    font-weight: 600;
  }

  .markdown-body :global(em) {
    color: rgba(255,255,255,0.7);
  }

  .markdown-body :global(hr) {
    border: none;
    border-top: 1px solid rgba(255,255,255,0.06);
    margin: 1em 0;
  }

  /* Inline code */
  .markdown-body :global(code) {
    background: rgba(255,255,255,0.06);
    border-radius: 4px;
    padding: 0.1em 0.35em;
    font-size: 0.82em;
    font-family: 'JetBrains Mono', monospace;
    color: #a78bfa;
  }

  /* Code block */
  .code-block {
    margin: 0.75em 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(0,0,0,0.3);
  }

  .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .code-lang {
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    color: rgba(255,255,255,0.3);
    text-transform: lowercase;
  }

  .code-block pre {
    margin: 0;
    padding: 0.75rem;
    overflow-x: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    line-height: 1.6;
    color: #e2e2e6;
  }

  .code-block pre code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }

  /* Command approval block */
  .command-block {
    margin: 0.75em 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(239,68,68,0.15);
    background: rgba(239,68,68,0.04);
  }

  .command-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    background: rgba(239,68,68,0.06);
    border-bottom: 1px solid rgba(239,68,68,0.1);
  }

  .command-label {
    font-size: 0.68rem;
    font-family: 'JetBrains Mono', monospace;
    color: rgba(239,68,68,0.6);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .command-code {
    margin: 0;
    padding: 0.6rem 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8rem;
    line-height: 1.5;
    color: #fca5a5;
    overflow-x: auto;
  }

  .command-code code {
    background: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }

  .command-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.75rem;
    border-top: 1px solid rgba(239,68,68,0.08);
  }

  .command-desc {
    font-size: 0.68rem;
    color: rgba(255,255,255,0.25);
    font-family: 'JetBrains Mono', monospace;
  }

  .copy-btn {
    font-size: 0.65rem;
    font-family: 'JetBrains Mono', monospace;
    color: rgba(255,255,255,0.25);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .copy-btn:hover {
    color: rgba(255,255,255,0.5);
  }

  .run-btn {
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', monospace;
    background: rgba(239,68,68,0.15);
    color: #fca5a5;
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 5px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .run-btn:hover {
    background: rgba(239,68,68,0.25);
  }
</style>
