<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';
  import { AVAILABLE_PROVIDERS, type UserSettings } from '$lib/types';
  import { get } from 'svelte/store';
  import { fade, fly } from 'svelte/transition';
  import { X, Key, Cpu, Check, Eye, EyeOff, Save, AlertCircle } from 'lucide-svelte';

  let { onClose }: { onClose: () => void } = $props();

  const current = get(settingsStore);

  let selectedProvider: keyof UserSettings['apiKeys'] = 'openai';
  let apiKeys: Record<string, string> = { ...current.apiKeys };
  let selectedModel: string = current.defaultModel || 'gpt-5.4-nano';
  let showKey: Record<string, boolean> = {};
  let saved = $state(false);
  let activeTab: 'key' | 'model' = $state('key');

  function getProviderModels(providerId: string) {
    return AVAILABLE_PROVIDERS.find(p => p.id === providerId)?.models || [];
  }

  function handleSave() {
    settingsStore.update(s => ({
      ...s,
      apiKeys: { ...apiKeys },
      defaultModel: selectedModel,
    }));
    saved = true;
    setTimeout(() => {
      saved = false;
      onClose();
    }, 800);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
  onclick={handleBackdropClick}
  transition:fade={{ duration: 200 }}
>
  <div
    class="relative w-full max-w-lg mx-4 rounded-2xl border border-white/[0.08] overflow-hidden"
    style="background-color: #0e0e12; box-shadow: 0 25px 80px rgba(0,0,0,0.6)"
    transition:fly={{ y: 20, duration: 300, opacity: 0 }}
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background-color: #3b82f615">
          <Key size={16} color="#3b82f6" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-main">API Configuration</h2>
          <p class="text-[11px] text-muted">Manage your AI provider keys and default model</p>
        </div>
      </div>
      <button
        onclick={onClose}
        class="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-main hover:bg-white/5 transition-colors"
      >
        <X size={15} />
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex border-b border-white/[0.06] px-6">
      <button
        onclick={() => activeTab = 'key'}
        class="px-4 py-3 text-xs font-medium border-b-2 transition-all duration-200"
        style="border-color: {activeTab === 'key' ? '#3b82f6' : 'transparent'}; color: {activeTab === 'key' ? '#f0f0f0' : '#6b6b6f'}"
      >
        <div class="flex items-center gap-2">
          <Key size={13} />
          API Keys
        </div>
      </button>
      <button
        onclick={() => activeTab = 'model'}
        class="px-4 py-3 text-xs font-medium border-b-2 transition-all duration-200"
        style="border-color: {activeTab === 'model' ? '#3b82f6' : 'transparent'}; color: {activeTab === 'model' ? '#f0f0f0' : '#6b6b6f'}"
      >
        <div class="flex items-center gap-2">
          <Cpu size={13} />
          Default Model
        </div>
      </button>
    </div>

    <div class="p-6 max-h-[420px] overflow-y-auto">
      {#if activeTab === 'key'}
        <div transition:fly={{ y: 8, duration: 200, opacity: 0 }}>
          <p class="text-xs text-muted mb-5 leading-relaxed">
            Your API keys are stored <span class="text-main font-medium">locally</span> in your browser.
            They're sent directly to the AI provider — never to KLAY servers.
          </p>

          <div class="space-y-4">
            {#each AVAILABLE_PROVIDERS as provider}
              {@const keyValue = apiKeys[provider.id] || ''}
              <div class="rounded-xl p-4 border transition-all duration-200" style="border-color: {keyValue ? '#10b98120' : '#1f1f23'}; background-color: rgba(255,255,255,0.02)">
                <div class="flex items-center justify-between mb-2.5">
                  <span class="text-xs font-medium text-main">{provider.name}</span>
                  {#if keyValue}
                    <span class="text-[9px] text-green-400/70 flex items-center gap-1">
                      <span class="w-1.5 h-1.5 rounded-full bg-green-400/60"></span>
                      Configured
                    </span>
                  {:else}
                    <span class="text-[9px] text-muted/50">Not set</span>
                  {/if}
                </div>
                <div class="relative">
                  <input
                    type={showKey[provider.id] ? 'text' : 'password'}
                    oninput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      if (val) {
                        apiKeys[provider.id] = val;
                      } else {
                        delete apiKeys[provider.id];
                      }
                      apiKeys = { ...apiKeys };
                    }}
                    placeholder={provider.id === 'openai' ? 'sk-...' : provider.id === 'anthropic' ? 'sk-ant-...' : 'Enter your API key...'}
                    class="w-full bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2.5 pr-10 text-xs font-mono text-main placeholder:text-muted/30 focus:outline-none focus:border-white/15 transition-all duration-200"
                  />
                  <button
                    onclick={() => { showKey[provider.id] = !showKey[provider.id]; showKey = { ...showKey }; }}
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors"
                  >
                    {#if showKey[provider.id]}
                      <EyeOff size={14} />
                    {:else}
                      <Eye size={14} />
                    {/if}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div transition:fly={{ y: 8, duration: 200, opacity: 0 }}>
          <p class="text-xs text-muted mb-5 leading-relaxed">
            Choose which model KLAY uses by default. You can also switch per conversation later.
          </p>

          <div class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {#each AVAILABLE_PROVIDERS as provider}
              {@const providerModels = getProviderModels(provider.id)}
              {#if providerModels.length > 0}
                <div class="text-[10px] uppercase tracking-widest text-muted/50 font-bold px-1 py-2">
                  {provider.name}
                </div>
                {#each providerModels as model}
                  {@const isActive = selectedModel === model.id}
                  <button
                    onclick={() => { selectedModel = model.id }}
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 border text-left"
                    style="
                      background-color: {isActive ? '#3b82f610' : 'transparent'};
                      border-color: {isActive ? '#3b82f630' : '#1f1f23'};
                    "
                  >
                    <div
                      class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                      style="border-color: {isActive ? '#3b82f6' : '#3a3a3e'}"
                    >
                      {#if isActive}
                        <div class="w-2 h-2 rounded-full" style="background-color: #3b82f6"></div>
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-sm text-main">{model.name}</div>
                      <div class="text-[10px] text-muted/50 font-mono mt-0.5">{model.id}</div>
                    </div>
                    {#if isActive}
                      <Check size={14} color="#3b82f6" class="shrink-0" />
                    {/if}
                  </button>
                {/each}
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] bg-black/20">
      <div class="text-[10px] text-muted/50">
        {#if Object.values(apiKeys).filter(k => k).length > 0}
          <span class="text-green-400/60">{Object.values(apiKeys).filter(k => k).length} provider(s) configured</span>
        {/if}
      </div>
      <div class="flex items-center gap-3">
        <button
          onclick={onClose}
          class="px-4 py-2 text-xs text-muted hover:text-main transition-colors rounded-lg hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          onclick={handleSave}
          class="flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg transition-all duration-200"
          style="background-color: #3b82f6; color: white"
        >
          {#if saved}
            <Check size={14} />
            Saved
          {:else}
            <Save size={14} />
            Save
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>
