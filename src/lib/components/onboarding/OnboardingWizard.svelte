<script lang="ts">
  import { settingsStore } from '$lib/stores/settings';
  import { AVAILABLE_PROVIDERS, type UserSettings } from '$lib/types';
  import { fade, fly, scale } from 'svelte/transition';
  import { Hexagon, ChevronRight, ChevronLeft, Check, Key, User, Cpu, Sparkles, Eye, ArrowRight } from 'lucide-svelte';

  let step = $state(0);
  let username = $state('');
  let selectedProvider = $state<string>('openai');
  let apiKey = $state('');
  let selectedModel = $state('gpt-5.4-nano');
  let showKey = $state(false);

  const totalSteps = 3;

  const stepLabels = ['Welcome', 'Your API Key', 'Choose Model'];

  function getProviderModels() {
    return AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)?.models || [];
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return username.trim().length >= 2;
      case 1: return apiKey.trim().length >= 10;
      case 2: return !!selectedModel;
      default: return false;
    }
  }

  function nextStep() {
    if (step < totalSteps - 1 && canProceed()) {
      if (step === 0) {
        // Store username immediately
        settingsStore.update(s => ({ ...s, username: username.trim() }));
      }
      if (step === 1) {
        // Store API key immediately
        settingsStore.update(s => ({
          ...s,
          apiKeys: { ...s.apiKeys, [selectedProvider]: apiKey.trim() },
        }));
      }
      step++;
    }
  }

  function prevStep() {
    if (step > 0) step--;
  }

  function finishOnboarding() {
    // Save model selection, mark as complete
    settingsStore.update(s => ({
      ...s,
      defaultModel: selectedModel,
    }));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && canProceed()) {
      if (step < totalSteps - 1) {
        nextStep();
      } else {
        finishOnboarding();
      }
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center" style="background-color: #08080b">
  <!-- Ambient glow -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-[0.03]" style="background: radial-gradient(circle, #3b82f6 0%, transparent 70%)"></div>
    <div class="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-[0.03]" style="background: radial-gradient(circle, #10b981 0%, transparent 70%)"></div>
  </div>

  <div
    class="relative w-full max-w-md mx-auto px-6"
    transition:fade={{ duration: 300 }}
  >
    <!-- Progress -->
    <div class="flex items-center justify-center gap-2 mb-12">
      {#each { length: totalSteps } as _, i}
        <div
          class="h-1 rounded-full transition-all duration-500"
          style="width: {i === step ? '2rem' : '0.5rem'}; background-color: {i <= step ? '#3b82f6' : '#1f1f23'}"
        ></div>
      {/each}
    </div>

    <!-- Step: Username -->
    {#if step === 0}
      <div transition:fly={{ y: 12, duration: 350, opacity: 0 }}>
        <div class="flex justify-center mb-8">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center" style="background-color: #3b82f615">
            <Hexagon size={32} color="#3b82f6" />
          </div>
        </div>

        <h1 class="text-3xl font-bold text-center font-sans mb-2">
          Welcome to <span style="color: #3b82f6">KLAY</span>
        </h1>
        <p class="text-sm text-center text-muted mb-10">
          Mold your projects with AI. Let's get you set up.
        </p>

        <div class="space-y-2">
          <label class="text-xs font-medium text-muted uppercase tracking-widest flex items-center gap-2">
            <User size={12} />
            What should we call you?
          </label>
          <input
            type="text"
            bind:value={username}
            onkeydown={handleKeydown}
            placeholder="Enter your username..."
            class="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-sm text-main placeholder:text-muted/40 focus:outline-none focus:border-white/15 transition-all duration-200"
            autofocus
          />
          {#if username.length > 0 && username.length < 2}
            <p class="text-[11px] text-red-400/70">At least 2 characters</p>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Step: API Key -->
    {#if step === 1}
      <div transition:fly={{ y: 12, duration: 350, opacity: 0 }}>
        <div class="flex justify-center mb-8">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center" style="background-color: #10b98115">
            <Key size={32} color="#10b981" />
          </div>
        </div>

        <h1 class="text-2xl font-bold text-center font-sans mb-2">
          Your API Key
        </h1>
        <p class="text-sm text-center text-muted mb-8">
          Choose your AI provider and enter your API key.
          <br />Your key stays on <span class="text-main font-medium">your machine</span>.
        </p>

        <!-- Provider Selection -->
        <div class="flex gap-2 mb-6 justify-center">
          {#each AVAILABLE_PROVIDERS as provider}
            <button
              onclick={() => { selectedProvider = provider.id; apiKey = ''; }}
              class="px-4 py-2 rounded-lg text-xs font-mono transition-all duration-200 border"
              style="
                background-color: {selectedProvider === provider.id ? '#10b98115' : 'transparent'};
                border-color: {selectedProvider === provider.id ? '#10b98130' : '#1f1f23'};
                color: {selectedProvider === provider.id ? '#10b981' : '#8d8d91'};
              "
            >
              {provider.name}
            </button>
          {/each}
        </div>

        <div class="space-y-2">
          <label class="text-xs font-medium text-muted uppercase tracking-widest flex items-center gap-2">
            <Key size={12} />
            {AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider)?.name} API Key
          </label>
          <div class="relative">
            <input
              type={showKey ? 'text' : 'password'}
              bind:value={apiKey}
              onkeydown={handleKeydown}
              placeholder="sk-..."
              class="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 pr-12 text-sm text-main placeholder:text-muted/40 focus:outline-none focus:border-white/15 transition-all duration-200 font-mono"
              autofocus
            />
            <button
              onclick={() => showKey = !showKey}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors"
            >
              <Eye size={16} opacity={showKey ? 1 : 0.5} />
            </button>
          </div>
          {#if apiKey.length > 0 && apiKey.length < 10}
            <p class="text-[11px] text-red-400/70">API key seems too short</p>
          {/if}
          <p class="text-[10px] text-muted mt-1">
            We never send your key anywhere except directly to the AI provider.
          </p>
        </div>
      </div>
    {/if}

    <!-- Step: Model Selection -->
    {#if step === 2}
      <div transition:fly={{ y: 12, duration: 350, opacity: 0 }}>
        <div class="flex justify-center mb-8">
          <div class="w-16 h-16 rounded-2xl flex items-center justify-center" style="background-color: #f59e0b15">
            <Cpu size={32} color="#f59e0b" />
          </div>
        </div>

        <h1 class="text-2xl font-bold text-center font-sans mb-2">
          Choose Your Model
        </h1>
        <p class="text-sm text-center text-muted mb-8">
          Pick your default AI model. You can switch anytime.
        </p>

        <div class="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {#each AVAILABLE_PROVIDERS as provider}
            {@const providerModels = provider.models}
            {#if providerModels.length > 0}
              <div class="text-[10px] uppercase tracking-widest text-muted/60 font-bold px-1 py-2">
                {provider.name}
              </div>
              {#each providerModels as model}
                {@const isActive = selectedModel === model.id}
                <button
                  onclick={() => { selectedModel = model.id }}
                  onkeydown={handleKeydown}
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 border text-left"
                  style="
                    background-color: {isActive ? '#f59e0b10' : 'transparent'};
                    border-color: {isActive ? '#f59e0b30' : '#1f1f23'};
                  "
                >
                  <div
                    class="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                    style="border-color: {isActive ? '#f59e0b' : '#3a3a3e'}"
                  >
                    {#if isActive}
                      <div class="w-2 h-2 rounded-full" style="background-color: #f59e0b"></div>
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-main">{model.name}</div>
                    <div class="text-[10px] text-muted/60 font-mono mt-0.5">{model.id}</div>
                  </div>
                  {#if isActive}
                    <Check size={14} color="#f59e0b" class="shrink-0" />
                  {/if}
                </button>
              {/each}
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Navigation Buttons -->
    <div class="flex items-center justify-between mt-10">
      {#if step > 0}
        <button
          onclick={prevStep}
          class="flex items-center gap-1.5 text-sm text-muted hover:text-main transition-colors"
        >
          <ChevronLeft size={14} />
          Back
        </button>
      {:else}
        <div></div>
      {/if}

      {#if step < totalSteps - 1}
        <button
          onclick={nextStep}
          disabled={!canProceed()}
          class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-30"
          style="background-color: #3b82f6; color: white"
        >
          Continue
          <ChevronRight size={14} />
        </button>
      {:else}
        <button
          onclick={finishOnboarding}
          disabled={!canProceed()}
          class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-30"
          style="background-color: #f59e0b; color: #08080b"
        >
          <Sparkles size={14} />
          Start Molding
          <ArrowRight size={14} />
        </button>
      {/if}
    </div>
  </div>
</div>
