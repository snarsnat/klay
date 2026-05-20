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
  // OpenAI — o-series are reasoning models
  'gpt-4o': false,
  'gpt-4o-mini': false,
  'gpt-5': false,
  'gpt-5-mini': false,
  'o3': true,
  'o3-mini': true,
  'o4-mini': true,
  // Anthropic — claude-3.7+ and claude-4 support extended thinking
  'claude-opus-4-20250514': true,
  'claude-sonnet-4-20250514': true,
  'claude-3-7-sonnet-20250219': true,
  'claude-3-5-sonnet-20240620': false,
  'claude-3-5-haiku-20241022': false,
  'claude-3-haiku-20240307': false,
  // Gemini — 2.5+ supports thinking
  'gemini/gemini-2.5-pro': true,
  'gemini/gemini-2.5-flash': true,
  'gemini/gemini-2.5-flash-lite': false,
  'gemini/gemini-2.0-flash': false,
  // DeepSeek — reasoner is the thinking model
  'deepseek/deepseek-reasoner': true,
  'deepseek/deepseek-chat': false,
};

export function modelSupportsThinking(modelId: string): boolean {
  return THINKING_SUPPORT[modelId] ?? false;
}

export const AVAILABLE_PROVIDERS: { id: keyof UserSettings['apiKeys']; name: string; models: { id: string; name: string }[] }[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (Latest)' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast)' },
      { id: 'o3', name: 'o3 (Reasoning)' },
      { id: 'o3-mini', name: 'o3 Mini (Reasoning, Fast)' },
      { id: 'o4-mini', name: 'o4 Mini (Reasoning)' },
      { id: 'gpt-5', name: 'GPT-5 (Flagship)' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4 (Flagship)' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (Best Balance)' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Thinking)' },
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Fastest)' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    models: [
      { id: 'gemini/gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)' },
      { id: 'gemini/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Thinking)' },
      { id: 'gemini/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
      { id: 'gemini/gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast)' },
    ],
  },
  {
    id: 'deepseek',
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
