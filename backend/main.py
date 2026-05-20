"""
KLAY Backend — LiteLLM Routing, Computer Control, Memory Graph, Image Processing, Mode Management

Run with: uvicorn backend.main:app --reload --port 8000
"""

import asyncio
import base64
import json
import os
import re
import time
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# App Setup
# ---------------------------------------------------------------------------

app = FastAPI(title="KLAY Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODES_DIR = Path(__file__).parent.parent / "modes"

# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str

class CompletionRequest(BaseModel):
    model: str = "gpt-5.4-nano"
    messages: List[ChatMessage]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: bool = False
    mode: Optional[str] = None

class CompletionResponse(BaseModel):
    content: str
    model: str
    usage: Dict[str, int]

class ModeOut(BaseModel):
    id: str
    name: str
    content: str
    color: str
    icon: str

class NavigateRequest(BaseModel):
    url: str

class ClickRequest(BaseModel):
    x: float
    y: float
    button: str = "left"

class TypeRequest(BaseModel):
    text: str

class ExecuteJSRequest(BaseModel):
    code: str

class AnalyzeImageRequest(BaseModel):
    image: str  # base64
    prompt: Optional[str] = None

class StoreMemoryRequest(BaseModel):
    content: str
    metadata: Optional[Dict[str, Any]] = None
    id: Optional[str] = None

class SearchMemoryRequest(BaseModel):
    query: str
    limit: int = 10

# ---------------------------------------------------------------------------
# Agentic Tools
# ---------------------------------------------------------------------------

# Models that support native thinking/reasoning tokens
THINKING_SUPPORT = {
    'gpt-5.5': True, 'gpt-5.5-pro': True,
    'gpt-5.4': True, 'gpt-5.4-pro': True,
    'gpt-5.4-mini': False, 'gpt-5.4-nano': False,
    'claude-opus-4-7': True, 'claude-sonnet-4-6': True,
    'claude-haiku-4-5': True, 'claude-opus-4.6': True,
    'claude-sonnet-4.5': True, 'claude-haiku-4-5-20251001': True,
    'gemini-3.1-pro': True, 'gemini-3-flash': True,
    'gemini-3.1-flash-lite': False,
    'gemini-2.5-pro': True, 'gemini-2.5-flash': True,
    'gemini-2.5-flash-lite': False,
    'deepseek-v4-pro': False, 'deepseek-v4-flash': True,
}

def _apply_thinking_params(kwargs: dict, model: str, original_model: str):
    """Add provider-correct thinking params. Modifies kwargs in place."""
    # Detect provider from original (un-prefixed) model id
    if original_model.startswith("claude") or "claude" in original_model:
        # Anthropic: explicit thinking block + temperature must be 1
        kwargs["thinking"] = {"type": "enabled", "budget_tokens": 8000}
        kwargs["temperature"] = 1
    elif original_model.startswith("gemini"):
        # Gemini 2.5: thinkingBudget; Gemini 3: thinkingLevel / reasoning_effort
        if "2.5" in original_model:
            kwargs["thinking"] = {"thinkingBudget": 8000}
        else:
            kwargs["reasoning_effort"] = "high"
    elif original_model.startswith("deepseek"):
        # DeepSeek reasoning models respond to reasoning_effort
        kwargs["reasoning_effort"] = "high"
    else:
        # OpenAI GPT-5.x and others
        kwargs["reasoning_effort"] = "high"

AGENTIC_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Create a new file with content",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to project root"},
                    "content": {"type": "string", "description": "File content"},
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file's contents",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path relative to project root"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_directory",
            "description": "Create a new directory",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path relative to project root"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "List files and directories in a path",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path relative to project root"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a shell command (requires user approval)",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to run"},
                    "description": {"type": "string", "description": "Human-readable description of what this command does"},
                },
                "required": ["command", "description"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_image",
            "description": "Generate an image using Higgsfield AI. Use when user asks to generate, create, or make an image or picture. Requires Higgsfield CLI to be installed and authenticated.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Detailed text description of the image to generate"},
                    "model": {"type": "string", "description": "Model to use. Options: nano_banana_2 (fast, general), flux_1_1_pro (high quality), seedream_3 (artistic), soul_v2 (character). Default: nano_banana_2"},
                    "aspect_ratio": {"type": "string", "description": "Aspect ratio like 1:1, 16:9, 9:16, 4:3. Default: 1:1"},
                    "resolution": {"type": "string", "description": "Resolution: 1k, 2k, 4k. Default: 1k"},
                },
                "required": ["prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_video",
            "description": "Generate a video using Higgsfield AI. Use when user asks to generate, create, or make a video or animation. Requires Higgsfield CLI to be installed and authenticated.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Detailed text description of the video to generate"},
                    "model": {"type": "string", "description": "Model to use. Options: kling3_0 (cinematic), seedance_2_0 (motion), veo3_1 (realistic), hailuo_02 (dynamic). Default: kling3_0"},
                    "duration": {"type": "integer", "description": "Duration in seconds: 5, 10, or 15. Default: 5"},
                    "start_image": {"type": "string", "description": "Optional local file path to an image to use as the first frame"},
                    "sound": {"type": "string", "description": "Sound: on or off. Default: off"},
                },
                "required": ["prompt"],
            },
        },
    },
]


def _safe_path(project_root: str, rel_path: str) -> Path:
    """Resolve path safely within project root — no directory traversal."""
    root = Path(project_root).resolve()
    target = (root / rel_path).resolve()
    if not str(target).startswith(str(root)):
        raise ValueError(f"Path traversal blocked: {rel_path}")
    return target


async def execute_tool_auto(tool_name: str, args: dict, project_root: str) -> str:
    """Execute auto-approved tools (file/dir ops). Returns string result."""
    try:
        if tool_name == "create_file":
            path = _safe_path(project_root, args["path"])
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(args["content"], encoding="utf-8")
            return f"Created {args['path']}"

        elif tool_name == "read_file":
            path = _safe_path(project_root, args["path"])
            if not path.exists():
                return f"Error: {args['path']} not found"
            return path.read_text(encoding="utf-8")

        elif tool_name == "create_directory":
            path = _safe_path(project_root, args["path"])
            path.mkdir(parents=True, exist_ok=True)
            return f"Created directory {args['path']}"

        elif tool_name == "list_directory":
            path = _safe_path(project_root, args.get("path", "."))
            if not path.exists():
                return f"Error: {args.get('path', '.')} not found"
            items = []
            for item in sorted(path.iterdir()):
                prefix = "📁 " if item.is_dir() else "📄 "
                items.append(f"{prefix}{item.name}")
            return "\n".join(items) if items else "(empty)"

        elif tool_name == "generate_image":
            return await _higgsfield_generate(
                kind="image",
                prompt=args["prompt"],
                model=args.get("model", "nano_banana_2"),
                extra_args=[
                    "--aspect_ratio", args.get("aspect_ratio", "1:1"),
                    "--resolution", args.get("resolution", "1k"),
                ],
            )

        elif tool_name == "generate_video":
            extra = ["--duration", str(args.get("duration", 5)), "--sound", args.get("sound", "off")]
            if args.get("start_image"):
                extra += ["--start-image", args["start_image"]]
            return await _higgsfield_generate(
                kind="video",
                prompt=args["prompt"],
                model=args.get("model", "kling3_0"),
                extra_args=extra,
            )

        return f"Unknown tool: {tool_name}"
    except Exception as e:
        return f"Error: {str(e)}"


async def _higgsfield_generate(kind: str, prompt: str, model: str, extra_args: list) -> str:
    """Run higgsfield CLI to generate image or video. Returns result URL or error."""
    import shutil
    hf = shutil.which("higgsfield")
    if not hf:
        return (
            "❌ Higgsfield CLI not installed.\n\n"
            "Run in terminal:\n```\nnpm install -g @higgsfield/cli\nhiggsfield auth login\n```"
        )
    cmd = [hf, "generate", "create", model, "--prompt", prompt, "--wait"] + extra_args
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
    out = stdout.decode().strip()
    err = stderr.decode().strip()
    if proc.returncode != 0:
        hint = ""
        if "not logged in" in (out + err).lower() or "auth" in (out + err).lower():
            hint = "\n\n**Fix:** Run `higgsfield auth login` in your terminal."
        return f"❌ Higgsfield {kind} generation failed:{hint}\n```\n{err or out}\n```"
    return f"✅ {kind.capitalize()} generated!\n\n{out}"


# ---------------------------------------------------------------------------
# Token Usage Tracking
# ---------------------------------------------------------------------------

token_usage_history: List[Dict[str, Any]] = []

def track_usage(model: str, prompt_tokens: int, completion_tokens: int):
    entry = {
        "model": model,
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "totalTokens": prompt_tokens + completion_tokens,
        "timestamp": int(time.time() * 1000),
    }
    token_usage_history.append(entry)
    # Keep last 1000 entries
    if len(token_usage_history) > 1000:
        token_usage_history[:] = token_usage_history[-1000:]
    return entry

# ---------------------------------------------------------------------------
# LiteLLM Chat Completions
# ---------------------------------------------------------------------------

def _resolve_model(model: str) -> str:
    """Ensure model has correct LiteLLM provider prefix."""
    if not model:
        return model
    # Already prefixed
    if "/" in model:
        return model
    # Anthropic models — no prefix needed, LiteLLM detects by name
    if model.startswith("claude-"):
        return model
    # OpenAI models — no prefix needed
    if model.startswith(("gpt-", "o1", "o3", "o4")):
        return model
    # Gemini bare names
    if model.startswith("gemini"):
        return f"gemini/{model}"
    return model


def _get_api_key_for_model(model: str, api_keys: dict) -> Optional[str]:
    """Return the correct API key for the given model ID."""
    m = model.lower()
    if m.startswith("deepseek/") or m.startswith("deepseek-"):
        return api_keys.get("deepseek")
    if m.startswith("gemini/") or m.startswith("gemini"):
        return api_keys.get("google")
    if m.startswith("claude-"):
        return api_keys.get("anthropic")
    if m.startswith(("gpt-", "o1", "o3", "o4")):
        return api_keys.get("openai")
    return None


async def litellm_completion(request: CompletionRequest, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Call LiteLLM with the given parameters."""
    try:
        import litellm
        # Configure LiteLLM
        litellm.drop_params = True
        litellm.allow_redirects = True

        # Convert messages to dicts
        messages = [m.model_dump() for m in request.messages]

        kwargs = dict(
            model=_resolve_model(request.model),
            messages=messages,
        )
        if request.temperature is not None:
            kwargs["temperature"] = request.temperature
        if request.max_tokens is not None:
            kwargs["max_tokens"] = request.max_tokens

        # Pass API key if provided (from frontend settings)
        # LiteLLM handles provider routing internally based on model name
        if api_key:
            kwargs["api_key"] = api_key

        response = await litellm.acompletion(**kwargs)

        content = response.choices[0].message.content or ""
        usage_data = getattr(response, "usage", None)
        usage = {
            "promptTokens": usage_data.prompt_tokens if usage_data else 0,
            "completionTokens": usage_data.completion_tokens if usage_data else 0,
            "totalTokens": usage_data.total_tokens if usage_data else 0,
        }

        track_usage(request.model, usage["promptTokens"], usage["completionTokens"])

        return {
            "content": content,
            "model": response.model or request.model,
            "usage": usage,
        }
    except ImportError:
        return {
            "content": f"[KLAY AI]\n\nLiteLLM is not installed. Install it with: `pip install litellm`\n\nConfigure your API keys as environment variables:\n- `OPENAI_API_KEY` for OpenAI models\n- `ANTHROPIC_API_KEY` for Anthropic models",
            "model": request.model,
            "usage": {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0},
        }
    except Exception as e:
        error_msg = str(e)
        if "AuthenticationError" in error_msg or "401" in error_msg:
            return {
                "content": f"[KLAY AI]\n\n⚠️ **Authentication Error**\n\nThe API key for `{request.model}` is not configured or is invalid.\n\nSet the appropriate environment variable and restart the backend.",
                "model": request.model,
                "usage": {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0},
            }
        return {
            "content": f"[KLAY AI]\n\n⚠️ **Error**: {error_msg[:500]}",
            "model": request.model,
            "usage": {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0},
        }


@app.post("/api/chat/completions", response_model=CompletionResponse)
async def chat_completions(request: CompletionRequest, authorization: Optional[str] = Header(None)):
    """AI chat completion via LiteLLM (non-streaming).
    Accepts API key via Authorization header: Bearer <key> or X-Api-Key header.
    """
    api_key = None
    if authorization and authorization.startswith("Bearer "):
        api_key = authorization[7:]
    result = await litellm_completion(request, api_key=api_key)
    return CompletionResponse(**result)


@app.websocket("/api/chat/stream")
async def chat_stream(websocket: WebSocket):
    """Streaming AI chat completion with agentic tool use and thinking parsing."""
    await websocket.accept()
    try:
        import litellm

        data = await websocket.receive_json()
        model = _resolve_model(data.get("model", ""))
        # Support both legacy single apiKey and new apiKeys dict
        api_keys: dict = data.get("apiKeys") or {}
        if not api_keys and data.get("apiKey"):
            api_keys = {"openai": data["apiKey"], "anthropic": data["apiKey"],
                        "google": data["apiKey"], "deepseek": data["apiKey"]}
        api_key = _get_api_key_for_model(model, api_keys)
        messages = list(data.get("messages", []))
        temperature = data.get("temperature")
        deep_thinking = data.get("deep_thinking", False)
        agentic = data.get("agentic", True)
        project_root = data.get("project_root", ".")

        if not model:
            await websocket.send_json({"type": "error", "content": "No model selected. Configure a model in Settings."})
            return

        litellm.drop_params = True
        total_usage = {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0}

        # Original (un-prefixed) model id for provider detection
        original_model = data.get("model", "")
        model_supports_thinking = THINKING_SUPPORT.get(original_model, False)

        # Agentic loop — re-enters after tool calls
        for _ in range(10):  # max 10 tool call rounds
            kwargs: dict = dict(model=model, messages=messages, stream=True)
            if temperature is not None:
                kwargs["temperature"] = temperature
            if deep_thinking and model_supports_thinking:
                # Tools + thinking simultaneously not supported on most models
                _apply_thinking_params(kwargs, model, original_model)
            elif agentic:
                kwargs["tools"] = AGENTIC_TOOLS
                kwargs["tool_choice"] = "auto"
            if api_key:
                kwargs["api_key"] = api_key

            response = await litellm.acompletion(**kwargs)

            full_content = ""
            # Accumulate streaming tool calls
            tool_calls_acc: dict[int, dict] = {}
            finish_reason = None

            async for chunk in response:
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                finish_reason = choice.finish_reason or finish_reason
                delta = choice.delta

                # Accumulate tool call deltas
                if hasattr(delta, "tool_calls") and delta.tool_calls:
                    for tc_delta in delta.tool_calls:
                        idx = tc_delta.index
                        if idx not in tool_calls_acc:
                            tool_calls_acc[idx] = {"id": "", "name": "", "arguments": ""}
                        if tc_delta.id:
                            tool_calls_acc[idx]["id"] = tc_delta.id
                        if tc_delta.function:
                            if tc_delta.function.name:
                                tool_calls_acc[idx]["name"] += tc_delta.function.name
                            if tc_delta.function.arguments:
                                tool_calls_acc[idx]["arguments"] += tc_delta.function.arguments

                # Native reasoning_content (Claude, DeepSeek, OpenAI o-series via LiteLLM)
                reasoning = getattr(delta, "reasoning_content", None)
                if reasoning:
                    await websocket.send_json({"type": "thinking", "content": reasoning})

                # Regular content
                if hasattr(delta, "content") and delta.content:
                    full_content += delta.content
                    await websocket.send_json({"type": "chunk", "content": delta.content})

            # Track usage
            usage_data = getattr(response, "usage", None)
            if usage_data:
                total_usage["promptTokens"] += getattr(usage_data, "prompt_tokens", 0)
                total_usage["completionTokens"] += getattr(usage_data, "completion_tokens", 0)
                total_usage["totalTokens"] += getattr(usage_data, "total_tokens", 0)

            if not tool_calls_acc:
                # No tool calls — we're done
                break

            # Build tool call list for messages
            tool_call_list = []
            for idx in sorted(tool_calls_acc.keys()):
                tc = tool_calls_acc[idx]
                tool_call_list.append({
                    "id": tc["id"] or f"call_{idx}",
                    "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]},
                })

            messages.append({
                "role": "assistant",
                "content": full_content or None,
                "tool_calls": tool_call_list,
            })

            # Execute each tool
            for tc in tool_call_list:
                tool_name = tc["function"]["name"]
                try:
                    args = json.loads(tc["function"]["arguments"])
                except Exception:
                    args = {}

                if tool_name == "run_command":
                    # Needs user approval — send to frontend
                    await websocket.send_json({
                        "type": "tool_call",
                        "id": tc["id"],
                        "tool": "run_command",
                        "command": args.get("command", ""),
                        "description": args.get("description", ""),
                    })
                    try:
                        result_msg = await asyncio.wait_for(websocket.receive_json(), timeout=120)
                        if result_msg.get("type") == "tool_result":
                            output = result_msg.get("output", "cancelled")
                        else:
                            output = "User cancelled"
                    except asyncio.TimeoutError:
                        output = "Timed out waiting for approval"
                else:
                    # Auto-execute safe tools
                    output = await execute_tool_auto(tool_name, args, project_root)
                    await websocket.send_json({
                        "type": "tool_executed",
                        "tool": tool_name,
                        "result": output[:500],
                    })

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": str(output),
                })

        track_usage(model, total_usage["promptTokens"], total_usage["completionTokens"])
        await websocket.send_json({"type": "done", "usage": total_usage})

    except WebSocketDisconnect:
        pass
    except ImportError:
        await websocket.send_json({"type": "error", "content": "LiteLLM not installed. Run: pip install litellm"})
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "content": f"Error: {str(e)[:500]}"})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


@app.get("/api/models")
async def get_models():
    """Get available AI models."""
    return {
        "models": [
            # OpenAI
            {"id": "gpt-5.5", "name": "GPT-5.5 (Flagship)", "provider": "OpenAI"},
            {"id": "gpt-5.5-pro", "name": "GPT-5.5 Pro (Precision)", "provider": "OpenAI"},
            {"id": "gpt-5.4", "name": "GPT-5.4 (Balanced)", "provider": "OpenAI"},
            {"id": "gpt-5.4-pro", "name": "GPT-5.4 Pro", "provider": "OpenAI"},
            {"id": "gpt-5.4-mini", "name": "GPT-5.4 Mini (Coding/Agents)", "provider": "OpenAI"},
            {"id": "gpt-5.4-nano", "name": "GPT-5.4 Nano (Lowest Latency/Cost)", "provider": "OpenAI"},
            # Anthropic
            {"id": "claude-opus-4-7", "name": "Claude Opus 4 (Flagship)", "provider": "Anthropic"},
            {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4 (Best Balance)", "provider": "Anthropic"},
            {"id": "claude-haiku-4-5", "name": "Claude Haiku 4 (Fastest/Lowest Cost)", "provider": "Anthropic"},
            {"id": "claude-opus-4.6", "name": "Claude Opus 4.6", "provider": "Anthropic"},
            {"id": "claude-sonnet-4.5", "name": "Claude Sonnet 4.5", "provider": "Anthropic"},
            # Google
            {"id": "gemini-3.1-pro", "name": "Gemini 3.1 Pro", "provider": "Google"},
            {"id": "gemini-3-flash", "name": "Gemini 3 Flash", "provider": "Google"},
            {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite", "provider": "Google"},
            {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "provider": "Google"},
            {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "provider": "Google"},
            # DeepSeek
            {"id": "deepseek-v4-pro", "name": "DeepSeek V4 Pro", "provider": "DeepSeek"},
            {"id": "deepseek-v4-flash", "name": "DeepSeek V4 Flash", "provider": "DeepSeek"},
        ],
        "default": "gpt-5.4-nano",
    }

# ---------------------------------------------------------------------------
# Token Usage
# ---------------------------------------------------------------------------

@app.get("/api/token-usage")
async def get_token_usage():
    """Get token usage history."""
    return {"usage": token_usage_history}

# ---------------------------------------------------------------------------
# Modes
# ---------------------------------------------------------------------------

def get_default_modes() -> List[ModeOut]:
    return [
        ModeOut(id="reasoning", name="Reasoning", content="Deep analytical reasoning and problem solving.", color="#3b82f6", icon="Hexagon"),
        ModeOut(id="coding", name="Coding", content="Software engineering and code generation.", color="#10b981", icon="Code2"),
        ModeOut(id="creative", name="Creative", content="Creative brainstorming and content generation.", color="#f59e0b", icon="Sparkles"),
        ModeOut(id="design", name="Design", content="UI/UX design and visual aesthetics.", color="#ec4899", icon="Paintbrush"),
        ModeOut(id="research", name="Research", content="Information gathering and analysis.", color="#8b5cf6", icon="Search"),
        ModeOut(id="execution", name="Execution", content="Task execution and automation.", color="#ef4444", icon="Zap"),
    ]


def parse_mode_frontmatter(content: str) -> Dict[str, str]:
    """Parse YAML-like frontmatter from markdown."""
    metadata = {}
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if match:
        frontmatter = match.group(1)
        for line in frontmatter.strip().split("\n"):
            if ":" in line:
                key, _, value = line.partition(":")
                metadata[key.strip()] = value.strip()
    return metadata


@app.get("/api/modes")
async def get_modes():
    """Load modes from /modes directory, fall back to defaults."""
    modes = list(get_default_modes())

    if MODES_DIR.exists():
        for file in sorted(MODES_DIR.glob("*.md")):
            content = file.read_text(encoding="utf-8")
            meta = parse_mode_frontmatter(content)
            mode_id = file.stem.lower()

            # Update existing or add new
            existing = next((m for m in modes if m.id == mode_id), None)
            if existing:
                existing.content = content
                if "name" in meta:
                    existing.name = meta["name"]
                if "color" in meta:
                    existing.color = meta["color"]
            else:
                modes.append(ModeOut(
                    id=mode_id,
                    name=meta.get("name", file.stem.capitalize()),
                    content=content,
                    color=meta.get("color", "#8d8d91"),
                    icon=meta.get("icon", "FileText"),
                ))

    return {"modes": modes}

@app.post("/api/modes/save")
async def save_mode(mode: ModeOut):
    """Save a custom mode to /modes directory."""
    MODES_DIR.mkdir(parents=True, exist_ok=True)
    file_path = MODES_DIR / f"{mode.id}.md"
    content = f"---\nname: {mode.name}\ncolor: {mode.color}\nicon: {mode.icon}\n---\n\n{mode.content}"
    file_path.write_text(content, encoding="utf-8")
    return {"status": "ok", "path": str(file_path)}

# ---------------------------------------------------------------------------
# Browser / Computer Control (Playwright)
# ---------------------------------------------------------------------------

class BrowserManager:
    """Manages a persistent Playwright browser instance."""

    def __init__(self):
        self._browser = None
        self._context = None
        self._page = None
        self._lock = asyncio.Lock()

    async def start(self):
        async with self._lock:
            if self._browser is None:
                try:
                    from playwright.async_api import async_playwright
                    self._playwright = await async_playwright().start()
                    self._browser = await self._playwright.chromium.launch(
                        headless=True,
                        args=["--no-sandbox", "--disable-setuid-sandbox"],
                    )
                    self._context = await self._browser.new_context(
                        viewport={"width": 1280, "height": 720},
                        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) KLAY/0.1",
                    )
                    self._page = await self._context.new_page()
                except ImportError:
                    raise HTTPException(status_code=500, detail="Playwright is not installed. Run: pip install playwright && python3 -m playwright install chromium")
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to start browser: {str(e)}")

    async def stop(self):
        async with self._lock:
            if self._browser:
                try:
                    await self._browser.close()
                except Exception:
                    pass
            if hasattr(self, "_playwright") and self._playwright:
                try:
                    await self._playwright.stop()
                except Exception:
                    pass
            self._browser = None
            self._context = None
            self._page = None

    @property
    async def page(self):
        if self._page is None:
            await self.start()
        return self._page

    async def screenshot(self) -> str:
        p = await self.page
        buf = await p.screenshot(type="png", full_page=False)
        return base64.b64encode(buf).decode("utf-8")

    async def navigate(self, url: str):
        p = await self.page
        try:
            await p.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            # Still works if timeout but page loaded partially
            pass

    async def click(self, x: float, y: float, button: str = "left"):
        p = await self.page
        btn_map = {"left": "left", "right": "right", "middle": "middle"}
        await p.mouse.click(x, y, button=btn_map.get(button, "left"))

    async def type_text(self, text: str):
        p = await self.page
        await p.keyboard.type(text)

    async def press_key(self, key: str):
        p = await self.page
        await p.keyboard.press(key)

    async def execute_js(self, code: str) -> Any:
        p = await self.page
        return await p.evaluate(code)

    async def get_state(self) -> Dict:
        p = await self.page
        try:
            url = p.url
            title = await p.title()
        except Exception:
            url = ""
            title = ""
        return {
            "connected": self._browser is not None,
            "currentUrl": url,
            "title": title,
        }


browser_manager = BrowserManager()


@app.on_event("shutdown")
async def shutdown():
    await browser_manager.stop()


@app.post("/api/computer/start")
async def computer_start():
    """Start the browser for computer control."""
    try:
        await browser_manager.start()
        state = await browser_manager.get_state()
        return {"status": "ok", "state": state}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/computer/stop")
async def computer_stop():
    """Stop the browser."""
    await browser_manager.stop()
    return {"status": "ok"}


@app.get("/api/computer/state")
async def computer_state():
    """Get current browser state."""
    state = await browser_manager.get_state()
    return {"state": state}


@app.post("/api/computer/navigate")
async def computer_navigate(req: NavigateRequest):
    """Navigate to a URL."""
    await browser_manager.navigate(req.url)
    screenshot = await browser_manager.screenshot()
    state = await browser_manager.get_state()
    return {"status": "ok", "screenshot": screenshot, "state": state}


@app.post("/api/computer/click")
async def computer_click(req: ClickRequest):
    """Click at coordinates."""
    await browser_manager.click(req.x, req.y, req.button)
    screenshot = await browser_manager.screenshot()
    return {"status": "ok", "screenshot": screenshot}


@app.post("/api/computer/type")
async def computer_type(req: TypeRequest):
    """Type text."""
    await browser_manager.type_text(req.text)
    return {"status": "ok"}


@app.post("/api/computer/press")
async def computer_press(req: TypeRequest):
    """Press a key."""
    await browser_manager.press_key(req.text)
    return {"status": "ok"}


@app.post("/api/computer/execute")
async def computer_execute(req: ExecuteJSRequest):
    """Execute JavaScript in the browser."""
    result = await browser_manager.execute_js(req.code)
    return {"status": "ok", "result": result}


@app.get("/api/computer/screenshot")
async def computer_screenshot():
    """Take a screenshot."""
    screenshot = await browser_manager.screenshot()
    return {"screenshot": screenshot}

# ---------------------------------------------------------------------------
# Image Processing
# ---------------------------------------------------------------------------

@app.post("/api/images/analyze")
async def analyze_image(req: AnalyzeImageRequest):
    """Detect objects in an image using edge detection and blob analysis."""
    try:
        from PIL import Image, ImageFilter, ImageEnhance
    except ImportError:
        raise HTTPException(status_code=500, detail="Pillow is not installed. Run: pip install pillow")

    try:
        # Decode base64 image
        image_data = base64.b64decode(req.image)
        img = Image.open(BytesIO(image_data)).convert("RGB")
        width, height = img.size

        # Simple edge detection to find objects/regions
        gray = img.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)
        bw = edges.point(lambda x: 0 if x < 50 else 255)

        # Find bounding boxes using numpy
        img_np = np.array(bw)
        detected = []

        # Simple grid-based region detection
        grid_size = 4
        cell_w = width // grid_size
        cell_h = height // grid_size

        for gy in range(grid_size):
            for gx in range(grid_size):
                x1, y1 = gx * cell_w, gy * cell_h
                x2, y2 = x1 + cell_w, y1 + cell_h
                region = img_np[y1:y2, x1:x2]
                edge_density = np.sum(region > 128) / region.size

                if edge_density > 0.05 and edge_density < 0.95:
                    detected.append({
                        "label": f"Region {len(detected) + 1}",
                        "confidence": float(min(edge_density * 3, 0.95)),
                        "x": x1,
                        "y": y1,
                        "width": cell_w,
                        "height": cell_h,
                    })

        # If AI prompt provided, try using LiteLLM for analysis
        if req.prompt and detected:
            try:
                import litellm
                import json as json_mod

                analysis_prompt = f"""Analyze this image based on detected regions.
The image is {width}x{height} pixels.
Detected regions: {json_mod.dumps(detected[:5])}

User request: {req.prompt}

Return the analysis as a concise description of what's in the image."""

                analysis_model = os.environ.get("KLAY_DEFAULT_MODEL", "")
                if not analysis_model:
                    analysis = None
                    raise Exception("No model configured")
                response = await litellm.acompletion(
                    model=_resolve_model(analysis_model),
                    messages=[{"role": "user", "content": analysis_prompt}],
                    max_tokens=300,
                )
                analysis = response.choices[0].message.content
            except Exception:
                analysis = None
        else:
            analysis = None

        return {
            "objects": detected,
            "width": width,
            "height": height,
            "analysis": analysis,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")


@app.post("/api/images/layers")
async def extract_layers(req: AnalyzeImageRequest):
    """Extract visual layers from an image."""
    try:
        from PIL import Image
    except ImportError:
        raise HTTPException(status_code=500, detail="Pillow not installed")

    try:
        image_data = base64.b64decode(req.image)
        img = Image.open(BytesIO(image_data)).convert("RGBA")
        width, height = img.size

        # Create layers: original + analysis overlay
        buf = BytesIO()
        img.save(buf, format="PNG")
        img_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        layers = [
            {
                "id": "background",
                "type": "background",
                "name": "Original Image",
                "x": 0, "y": 0,
                "width": width, "height": height,
                "visible": True,
                "opacity": 1.0,
                "data": {"src": f"data:image/png;base64,{img_base64}"},
            }
        ]

        # Try to detect and extract foreground regions
        img_np = np.array(img)
        from PIL import ImageFilter
        gray = img.convert("L")
        edges = gray.filter(ImageFilter.FIND_EDGES)
        bw = edges.point(lambda x: 0 if x < 80 else 255)
        edge_np = np.array(bw)

        # Find connected regions (simplified)
        visited = np.zeros_like(edge_np, dtype=bool)
        regions = []

        for y in range(0, height, 10):
            for x in range(0, width, 10):
                if edge_np[y, x] > 128 and not visited[y, x]:
                    # Flood fill (simplified - just mark area)
                    region_pixels = []
                    stack = [(x, y)]
                    while stack and len(region_pixels) < 500:
                        cx, cy = stack.pop()
                        if 0 <= cx < width and 0 <= cy < height and not visited[cy, cx] and edge_np[cy, cx] > 128:
                            visited[cy, cx] = True
                            region_pixels.append((cx, cy))
                            stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)])

                    if len(region_pixels) > 20:
                        xs = [p[0] for p in region_pixels]
                        ys = [p[1] for p in region_pixels]
                        regions.append({
                            "x": min(xs), "y": min(ys),
                            "width": max(xs) - min(xs),
                            "height": max(ys) - min(ys),
                            "pixels": len(region_pixels),
                        })

        for i, region in enumerate(regions[:10]):
            layers.append({
                "id": f"object_{i}",
                "type": "object",
                "name": f"Object {i + 1}",
                "x": region["x"],
                "y": region["y"],
                "width": region["width"],
                "height": region["height"],
                "visible": True,
                "opacity": 0.8,
                "data": {"region": region},
            })

        return {"layers": layers, "width": width, "height": height}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Layer extraction failed: {str(e)}")

# ---------------------------------------------------------------------------
# Memory Graph (ChromaDB)
# ---------------------------------------------------------------------------

class MemoryManager:
    """Manages persistent memory using ChromaDB."""

    def __init__(self, persist_dir: str = "./.klay_memory"):
        self.persist_dir = persist_dir
        self._collection = None
        self._ready = False

    async def ensure_ready(self):
        if self._ready:
            return
        try:
            import chromadb
            Path(self.persist_dir).mkdir(parents=True, exist_ok=True)
            client = chromadb.PersistentClient(path=self.persist_dir)
            try:
                self._collection = client.get_collection("klay_memory")
            except Exception:
                self._collection = client.create_collection(
                    "klay_memory",
                    metadata={"hnsw:space": "cosine"},
                )
            self._ready = True
        except ImportError:
            # ChromaDB not available, use in-memory fallback
            self._ready = False

    async def store(self, content: str, metadata: Optional[Dict] = None, doc_id: Optional[str] = None) -> str:
        await self.ensure_ready()
        doc_id = doc_id or str(uuid.uuid4())

        if self._collection:
            try:
                self._collection.add(
                    documents=[content],
                    metadatas=[metadata or {}],
                    ids=[doc_id],
                )
            except Exception as e:
                # Fallback to in-memory
                self._store_fallback(content, metadata, doc_id)

        return doc_id

    def _store_fallback(self, content: str, metadata: Optional[Dict] = None, doc_id: Optional[str] = None):
        if not hasattr(self, "_fallback_store"):
            self._fallback_store: Dict[str, Dict] = {}
        doc_id = doc_id or str(uuid.uuid4())
        self._fallback_store[doc_id] = {
            "content": content,
            "metadata": metadata or {},
            "id": doc_id,
        }

    async def search(self, query: str, limit: int = 10) -> List[Dict]:
        await self.ensure_ready()

        if self._collection:
            try:
                results = self._collection.query(
                    query_texts=[query],
                    n_results=min(limit, 100),
                )
                nodes = []
                for i in range(len(results["ids"][0])):
                    nodes.append({
                        "id": results["ids"][0][i],
                        "content": results["documents"][0][i],
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "distance": results["distances"][0][i] if results["distances"] else 0,
                    })
                return nodes
            except Exception as e:
                pass

        # Fallback: simple keyword matching
        return self._search_fallback(query, limit)

    def _search_fallback(self, query: str, limit: int = 10) -> List[Dict]:
        if not hasattr(self, "_fallback_store"):
            return []
        query_lower = query.lower()
        results = []
        for doc_id, doc in getattr(self, "_fallback_store", {}).items():
            score = sum(1 for word in query_lower.split() if word in doc["content"].lower())
            if score > 0:
                results.append({
                    "id": doc_id,
                    "content": doc["content"],
                    "metadata": doc["metadata"],
                    "distance": 1.0 - (score / len(query_lower.split())),
                })
        results.sort(key=lambda x: x["distance"])
        return results[:limit]

    async def get_graph(self) -> Dict:
        """Build a memory graph from stored documents."""
        await self.ensure_ready()

        if self._collection:
            try:
                all_docs = self._collection.get()
                nodes = []
                edges = []
                for i in range(len(all_docs["ids"])):
                    doc_id = all_docs["ids"][i]
                    content = all_docs["documents"][i]
                    meta = all_docs["metadatas"][i] if all_docs["metadatas"] else {}

                    node_type = meta.get("type", "concept")
                    label = meta.get("label", content[:50])
                    nodes.append({
                        "id": doc_id,
                        "label": label,
                        "content": content[:200],
                        "type": node_type,
                        "metadata": meta,
                    })

                # Create edges between conceptually similar documents
                for i in range(len(nodes)):
                    for j in range(i + 1, len(nodes)):
                        # Simple content overlap for edges
                        words_i = set(nodes[i]["content"].lower().split())
                        words_j = set(nodes[j]["content"].lower().split())
                        overlap = len(words_i & words_j)
                        if overlap > 3:
                            edges.append({
                                "source": nodes[i]["id"],
                                "target": nodes[j]["id"],
                                "label": f"related ({overlap} terms)",
                                "strength": min(overlap / 10, 1.0),
                            })

                return {"nodes": nodes, "edges": edges}
            except Exception as e:
                pass

        return {"nodes": [], "edges": []}


memory_manager = MemoryManager()


@app.post("/api/memory/store")
async def memory_store(req: StoreMemoryRequest):
    """Store a memory entry."""
    doc_id = await memory_manager.store(req.content, req.metadata, req.id)
    return {"status": "ok", "id": doc_id}


@app.post("/api/memory/search")
async def memory_search(req: SearchMemoryRequest):
    """Search memory entries."""
    results = await memory_manager.search(req.query, req.limit)
    return {"results": results}


@app.get("/api/memory/graph")
async def memory_graph():
    """Get the full memory graph."""
    graph = await memory_manager.get_graph()
    return graph


@app.delete("/api/memory/clear")
async def memory_clear():
    """Clear all memory."""
    global memory_manager
    memory_manager = MemoryManager()
    return {"status": "ok"}

# ---------------------------------------------------------------------------
# Health & Info
# ---------------------------------------------------------------------------

@app.get("/api/files/list")
async def list_files(root: str = "."):
    """List project files as a tree from the given root path."""
    try:
        root_path = Path(root).resolve()
        if not root_path.exists():
            raise HTTPException(status_code=404, detail="Path not found")

        IGNORE = {".git", "__pycache__", "node_modules", ".svelte-kit", ".vite", "dist", ".DS_Store"}

        def build_tree(path: Path, rel: str = "") -> dict:
            name = path.name
            rel_path = rel or "."
            if path.is_file():
                ext = path.suffix.lstrip(".") if path.suffix else None
                return {"name": name, "path": rel_path, "type": "file", "extension": ext}
            children = []
            try:
                for child in sorted(path.iterdir()):
                    if child.name in IGNORE or child.name.startswith("."):
                        continue
                    child_rel = f"{rel_path}/{child.name}" if rel_path != "." else child.name
                    children.append(build_tree(child, child_rel))
            except PermissionError:
                pass
            return {"name": name, "path": rel_path, "type": "directory", "children": children}

        tree = build_tree(root_path)
        return {"tree": tree, "root": str(root_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/agentic/execute")
async def agentic_execute(data: dict):
    """Execute a pre-approved shell command."""
    command = data.get("command", "")
    project_root = data.get("project_root", ".")
    if not command:
        raise HTTPException(status_code=400, detail="No command")
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=project_root,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        output = stdout.decode("utf-8", errors="replace")
        return {"output": output, "exit_code": proc.returncode}
    except asyncio.TimeoutError:
        return {"output": "Command timed out after 30s", "exit_code": -1}
    except Exception as e:
        return {"output": str(e), "exit_code": -1}


@app.get("/api/health")
async def health():
    """Health check."""
    return {
        "status": "ok",
        "version": "0.2.0",
        "name": "KLAY Backend",
    }


@app.get("/api/info")
async def info():
    """System info."""
    import sys
    return {
        "python": sys.version,
        "platform": sys.platform,
        "litellm_installed": _is_installed("litellm"),
        "playwright_installed": _is_installed("playwright"),
        "chromadb_installed": _is_installed("chromadb"),
        "pillow_installed": _is_installed("PIL"),
    }


def _is_installed(module: str) -> bool:
    try:
        __import__(module)
        return True
    except ImportError:
        return False

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
