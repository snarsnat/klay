/**
 * KLAY User Settings Store
 * Persists to localStorage so onboarding only shows once.
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { getDefaultSettings, type UserSettings } from '$lib/types';

const STORAGE_KEY = 'klay_settings';

function loadSettings(): UserSettings {
  if (!browser) return getDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      return { ...getDefaultSettings(), ...parsed };
    }
  } catch {
    // Corrupted storage, reset
  }
  return getDefaultSettings();
}

function saveSettings(settings: UserSettings) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage might be full or disabled
  }
}

function createSettingsStore() {
  const initial = loadSettings();
  const { subscribe, set, update } = writable<UserSettings>(initial);

  return {
    subscribe,
    set(value: UserSettings) {
      saveSettings(value);
      set(value);
    },
    update(fn: (s: UserSettings) => UserSettings) {
      update((current) => {
        const next = fn(current);
        saveSettings(next);
        return next;
      });
    },
    /** Reset all settings (clears onboarding). */
    reset() {
      const defaults = getDefaultSettings();
      saveSettings(defaults);
      set(defaults);
    },
    /** Check if user has completed onboarding. */
    isConfigured(): boolean {
      const s = loadSettings();
      return !!(s.username && Object.keys(s.apiKeys).length > 0);
    },
  };
}

export const settingsStore = createSettingsStore();

/** Whether the user has completed onboarding. */
export const isConfigured = derived(settingsStore, ($s) => {
  return !!($s.username && Object.keys($s.apiKeys).length > 0);
});
