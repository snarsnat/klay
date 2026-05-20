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

/** Models that support deep thinking / extended reasoning.
 *  Sources: platform.claude.com/docs, platform.openai.com/docs/models, docs.litellm.ai
 */
export const THINKING_SUPPORT: Record<string, boolean> = {
  // OpenAI — o-series are reasoning models; gpt-4.x are not
  'gpt-4o': false,
  'gpt-4o-mini': false,
  'gpt-4.1': false,
  'gpt-4.1-mini': false,
  'gpt-4.1-nano': false,
  'o3': true,
  'o3-mini': true,
  'o4-mini': true,
  // Anthropic (source: platform.claude.com/docs/en/docs/about-claude/models)
  // claude-opus-4-7: no extended thinking (adaptive thinking only)
  // claude-sonnet-4-6: yes extended thinking
  // claude-haiku-4-5: yes extended thinking
  'claude-opus-4-7': false,
  'claude-sonnet-4-6': true,
  'claude-haiku-4-5-20251001': true,
  'claude-opus-4-6': true,
  'claude-sonnet-4-5-20250929': true,
  'claude-opus-4-5-20251101': true,
  'claude-opus-4-1-20250805': true,
  'claude-sonnet-4-20250514': true,
  'claude-opus-4-20250514': true,
  'claude-3-7-sonnet-20250219': true,
  'claude-3-5-sonnet-20240620': false,
  'claude-3-haiku-20240307': false,
  // Gemini — 2.5+ supports thinking
  'gemini/gemini-2.5-pro': true,
  'gemini/gemini-2.5-flash': true,
  'gemini/gemini-2.5-flash-lite': false,
  'gemini/gemini-2.0-flash': false,
  // DeepSeek — reasoner = R1 (thinking), chat = V3 (no thinking)
  'deepseek/deepseek-reasoner': true,
  'deepseek/deepseek-chat': false,
};

export function modelSupportsThinking(modelId: string): boolean {
  return THINKING_SUPPORT[modelId] ?? false;
}

export const AVAILABLE_PROVIDERS: { id: keyof UserSettings['apiKeys']; name: string; models: { id: string; name: string }[] }[] = [
  {
    id: 'openai',
    // Real IDs from platform.openai.com/docs/models (May 2026)
    name: 'OpenAI',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1 (Apr 2025, 1M ctx)' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (Fast)' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (Cheapest)' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o4-mini', name: 'o4-mini (Reasoning)' },
      { id: 'o3', name: 'o3 (Reasoning)' },
      { id: 'o3-mini', name: 'o3-mini (Reasoning, Fast)' },
    ],
  },
  {
    id: 'anthropic',
    // Real IDs from platform.claude.com/docs/en/docs/about-claude/models (May 2026)
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7 (Most Capable)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Best Balance + Thinking)' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Fastest)' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (Thinking)' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Thinking)' },
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
  },
  {
    id: 'google',
    // Real IDs from docs.litellm.ai/docs/providers/gemini (gemini/ prefix required)
    name: 'Google (Gemini)',
    models: [
      { id: 'gemini/gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)' },
      { id: 'gemini/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Thinking, Fast)' },
      { id: 'gemini/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  },
  {
    id: 'deepseek',
    // Real IDs from docs.litellm.ai/docs/providers/deepseek (deepseek/ prefix required)
    name: 'DeepSeek',
    models: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (V3)' },
      { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek Reasoner (R1, Thinking)' },
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
