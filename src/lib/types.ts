/** Core KLAY types */

export interface Mode {
  id: string;
  name: string;
  content: string;
  color: string;
  icon: string;
}

export interface ModeState {
  modes: Mode[];
  activeModeId: string;
  hybridModeIds: string[];
  loading: boolean;
  error: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  mode?: string;
  thinking?: string;
  thinkingCollapsed?: boolean;
  stopped?: boolean;
  stopStats?: { thinkingMs: number; responseMs: number };
}

export interface CommandRequest {
  id: string;
  command: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'cancelled';
  output?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: ChatMessage[];
}

export interface ThinkingState {
  isThinking: boolean;
  status: string;
  mode: string;
  progress?: number;
}

export interface WorkspaceState {
  isThinking: boolean;
  thinkingStatus: string;
  activeModeId: string;
  messages: ChatMessage[];
  showIdeaBoard: boolean;
  showImageEditor: boolean;
  showComputerControl: boolean;
  showMemoryGraph: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  timestamp: number;
}

export type ModeId = 'reasoning' | 'coding' | 'creative' | 'design' | 'research' | 'execution';

export const MODE_META: Record<string, { name: string; color: string; icon: string }> = {
  reasoning: { name: 'Reasoning', color: '#3b82f6', icon: 'Hexagon' },
  coding: { name: 'Coding', color: '#10b981', icon: 'Code2' },
  creative: { name: 'Creative', color: '#f59e0b', icon: 'Sparkles' },
  design: { name: 'Design', color: '#ec4899', icon: 'Paintbrush' },
  research: { name: 'Research', color: '#8b5cf6', icon: 'Search' },
  execution: { name: 'Execution', color: '#ef4444', icon: 'Zap' }
};

// ====== User Settings / Onboarding ======

export interface UserSettings {
  username: string;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    google?: string;
    deepseek?: string;
  };
  defaultModel: string;
  theme: 'dark';
}

/** Models that support deep thinking / extended reasoning */
export const THINKING_SUPPORT: Record<string, boolean> = {
  // OpenAI — GPT-5.4+ full models support reasoning_effort; mini/nano do not
  'gpt-5.5': true,
  'gpt-5.5-pro': true,
  'gpt-5.4': true,
  'gpt-5.4-pro': true,
  'gpt-5.4-mini': false,
  'gpt-5.4-nano': false,
  // Anthropic — all Claude 4.x support extended thinking
  'claude-opus-4-7': true,
  'claude-sonnet-4-6': true,
  'claude-haiku-4-5': true,
  'claude-opus-4.6': true,
  'claude-sonnet-4.5': true,
  'claude-haiku-4-5-20251001': true,
  // Google Gemini — 2.5+ and 3.x support thinking; lite variants do not
  'gemini-3.1-pro': true,
  'gemini-3-flash': true,
  'gemini-3.1-flash-lite': false,
  'gemini-2.5-pro': true,
  'gemini-2.5-flash': true,
  'gemini-2.5-flash-lite': false,
  // DeepSeek — V4 Flash is the reasoning/thinking variant
  'deepseek-v4-pro': false,
  'deepseek-v4-flash': true,
};

export function modelSupportsThinking(modelId: string): boolean {
  return THINKING_SUPPORT[modelId] ?? false;
}

export const AVAILABLE_PROVIDERS: { id: keyof UserSettings['apiKeys']; name: string; models: { id: string; name: string }[] }[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-5.5', name: 'GPT-5.5 (Flagship)' },
      { id: 'gpt-5.5-pro', name: 'GPT-5.5 Pro (Precision)' },
      { id: 'gpt-5.4', name: 'GPT-5.4 (Balanced)' },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro' },
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini (Coding/Agents)' },
      { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano (Lowest Latency/Cost)' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4 (Flagship)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4 (Best Balance)' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4 (Fastest/Lowest Cost)' },
      { id: 'claude-opus-4.6', name: 'Claude Opus 4.6' },
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Snapshot)' },
    ],
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    models: [
      { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash (Thinking)' },
    ],
  },
];

export function getDefaultSettings(): UserSettings {
  return {
    username: '',
    apiKeys: {},
    defaultModel: '',
    theme: 'dark',
  };
}

// ====== AI / Chat Types ======

export interface AICompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  mode?: string;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage: TokenUsage;
}

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
}

// ====== Idea Board Types ======

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color: string;
  rotation: number;
  zIndex: number;
}

export interface BoardConnection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

// ====== Image Editor Types ======

export interface ImageLayer {
  id: string;
  type: 'background' | 'object' | 'text' | 'shape' | 'mask';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  data: Record<string, unknown>;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ====== Computer Control Types ======

export interface BrowserState {
  connected: boolean;
  currentUrl: string;
  title: string;
}

export interface ScreenshotResult {
  base64: string;
  timestamp: number;
}

// ====== Memory Graph Types ======

export interface MemoryNode {
  id: string;
  label: string;
  content: string;
  type: 'concept' | 'file' | 'idea' | 'decision';
  metadata: Record<string, unknown>;
}

export interface MemoryEdge {
  source: string;
  target: string;
  label: string;
  strength: number;
}

export interface MemoryGraph {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}
