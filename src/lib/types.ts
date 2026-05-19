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
