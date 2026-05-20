/**
 * KLAY API Service — communicates with the Python FastAPI backend
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  AICompletionRequest,
  AICompletionResponse,
  AvailableModel,
  BrowserState,
  DetectedObject,
  ImageLayer,
  MemoryGraph,
  MemoryNode,
  Mode,
  ScreenshotResult,
  TokenUsage,
} from '$lib/types';

const BACKEND_URL = 'http://localhost:8000';

// ============================================================
// Utility
// ============================================================

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers as Record<string, string> },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error (${response.status}): ${text.slice(0, 200)}`);
  }
  return response.json();
}

// ============================================================
// Health
// ============================================================

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchJSON<{ status: string }>('/api/health');
    return res.status === 'ok';
  } catch {
    return false;
  }
}

// ============================================================
// AI Chat Completions
// ============================================================

export async function chatCompletion(request: AICompletionRequest, apiKey?: string): Promise<AICompletionResponse> {
  // Try backend first
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    return await fetchJSON<AICompletionResponse>('/api/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
  } catch {
    // Fallback: use Tauri Rust command
    const result = await invoke<{ content: string; model: string; usage: TokenUsage }>('chat_completion', {
      model: request.model,
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: request.temperature ?? null,
      maxTokens: request.maxTokens ?? null,
    });
    return result;
  }
}

let wsInstance: WebSocket | null = null;

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onThinking: (text: string) => void;
  onToolCall: (id: string, command: string, description: string) => Promise<string>;
  onToolExecuted: (tool: string, result: string) => void;
  onDone: (usage: TokenUsage) => void;
  onError: (err: string) => void;
}

export function streamChat(
  request: AICompletionRequest & { deepThinking?: boolean; agentic?: boolean; projectRoot?: string },
  callbacks: StreamCallbacks,
  apiKey?: string,
): () => void {
  try {
    const ws = new WebSocket(`ws://localhost:8000/api/chat/stream`);
    wsInstance = ws;

    ws.onopen = () => {
      const payload: Record<string, unknown> = {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        deep_thinking: request.deepThinking ?? false,
        agentic: request.agentic ?? true,
        project_root: request.projectRoot ?? '.',
      };
      if (apiKey) payload.apiKey = apiKey;
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chunk') {
          callbacks.onChunk(data.content);
        } else if (data.type === 'thinking') {
          callbacks.onThinking(data.content);
        } else if (data.type === 'tool_call') {
          const output = await callbacks.onToolCall(data.id, data.command, data.description);
          ws.send(JSON.stringify({ type: 'tool_result', id: data.id, output }));
        } else if (data.type === 'tool_executed') {
          callbacks.onToolExecuted(data.tool, data.result);
        } else if (data.type === 'done') {
          callbacks.onDone(data.usage);
          ws.close();
        } else if (data.type === 'error') {
          callbacks.onError(data.content);
          ws.close();
        }
      } catch {
        callbacks.onChunk(event.data);
      }
    };

    ws.onerror = () => {
      callbacks.onError('WebSocket connection failed. Is the backend running?');
    };

    ws.onclose = () => {
      wsInstance = null;
    };
  } catch (e) {
    callbacks.onError(`Failed to connect: ${e}`);
  }

  return () => {
    if (wsInstance) {
      wsInstance.close();
      wsInstance = null;
    }
  };
}

export async function executeCommand(command: string, projectRoot = '.'): Promise<{ output: string; exit_code: number }> {
  return fetchJSON('/api/agentic/execute', {
    method: 'POST',
    body: JSON.stringify({ command, project_root: projectRoot }),
  });
}

export async function listProjectFiles(root = '.'): Promise<{ tree: unknown; root: string }> {
  return fetchJSON(`/api/files/list?root=${encodeURIComponent(root)}`);
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
  try {
    const res = await fetchJSON<{ models: AvailableModel[] }>('/api/models');
    return res.models;
  } catch {
    return [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
    ];
  }
}

// ============================================================
// Token Usage
// ============================================================

export async function getTokenUsage(): Promise<TokenUsage[]> {
  try {
    const res = await fetchJSON<{ usage: TokenUsage[] }>('/api/token-usage');
    return res.usage;
  } catch {
    return [];
  }
}

// ============================================================
// Modes
// ============================================================

export async function loadModesFromBackend(): Promise<Mode[]> {
  try {
    const res = await fetchJSON<{ modes: Mode[] }>('/api/modes');
    return res.modes;
  } catch {
    return [];
  }
}

export async function saveModeToBackend(mode: Mode): Promise<boolean> {
  try {
    await fetchJSON('/api/modes/save', {
      method: 'POST',
      body: JSON.stringify(mode),
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Computer / Browser Control
// ============================================================

export async function startBrowser(): Promise<BrowserState> {
  const res = await fetchJSON<{ state: BrowserState }>('/api/computer/start', { method: 'POST' });
  return res.state;
}

export async function stopBrowser(): Promise<void> {
  await fetchJSON('/api/computer/stop', { method: 'POST' });
}

export async function getBrowserState(): Promise<BrowserState> {
  const res = await fetchJSON<{ state: BrowserState }>('/api/computer/state');
  return res.state;
}

export async function browserNavigate(url: string): Promise<{ screenshot: string; state: BrowserState }> {
  return fetchJSON('/api/computer/navigate', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function browserClick(x: number, y: number): Promise<{ screenshot: string }> {
  return fetchJSON('/api/computer/click', {
    method: 'POST',
    body: JSON.stringify({ x, y }),
  });
}

export async function browserType(text: string): Promise<void> {
  await fetchJSON('/api/computer/type', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function browserExecuteJS(code: string): Promise<unknown> {
  const res = await fetchJSON<{ result: unknown }>('/api/computer/execute', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  return res.result;
}

export async function takeScreenshot(): Promise<string> {
  const res = await fetchJSON<ScreenshotResult>('/api/computer/screenshot');
  return res.base64;
}

// ============================================================
// Image Processing
// ============================================================

export async function analyzeImage(imageBase64: string, prompt?: string): Promise<{
  objects: DetectedObject[];
  width: number;
  height: number;
  analysis: string | null;
}> {
  return fetchJSON('/api/images/analyze', {
    method: 'POST',
    body: JSON.stringify({ image: imageBase64, prompt }),
  });
}

export async function extractImageLayers(imageBase64: string): Promise<{
  layers: ImageLayer[];
  width: number;
  height: number;
}> {
  return fetchJSON('/api/images/layers', {
    method: 'POST',
    body: JSON.stringify({ image: imageBase64 }),
  });
}

// ============================================================
// Memory Graph
// ============================================================

export async function storeMemory(content: string, metadata?: Record<string, unknown>): Promise<string> {
  const res = await fetchJSON<{ id: string }>('/api/memory/store', {
    method: 'POST',
    body: JSON.stringify({ content, metadata }),
  });
  return res.id;
}

export async function searchMemory(query: string, limit = 10): Promise<MemoryNode[]> {
  const res = await fetchJSON<{ results: MemoryNode[] }>('/api/memory/search', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  });
  return res.results;
}

export async function getMemoryGraph(): Promise<MemoryGraph> {
  return fetchJSON<MemoryGraph>('/api/memory/graph');
}

export async function clearMemory(): Promise<void> {
  await fetchJSON('/api/memory/clear', { method: 'DELETE' });
}
