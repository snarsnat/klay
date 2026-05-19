use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub content: String,
    pub model: String,
    pub usage: TokenUsage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Send a chat completion request to an LLM provider
/// This is a lightweight replacement for LiteLLM - routes to configured providers
#[tauri::command]
pub async fn chat_completion(
    model: String,
    _messages: Vec<ChatMessage>,
    _temperature: Option<f32>,
    _max_tokens: Option<u32>,
) -> Result<CompletionResponse, String> {
    // For now, return a response indicating the AI backend is ready
    // In production, this would call the actual LLM API
    let response = CompletionResponse {
        content: format!(
            "[KLAY AI Backend Ready] Model '{}' is configured.\n\nThis is a placeholder response. Connect your API key to start using the AI assistant.",
            model
        ),
        model: model.clone(),
        usage: TokenUsage {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        },
    };

    Ok(response)
}

/// Get available AI models
#[tauri::command]
pub async fn get_available_models() -> Result<Vec<String>, String> {
    Ok(vec![
        "gpt-4".to_string(),
        "gpt-4o".to_string(),
        "gpt-4o-mini".to_string(),
        "claude-3-opus".to_string(),
        "claude-3-sonnet".to_string(),
        "claude-3.5-sonnet".to_string(),
        "o1-mini".to_string(),
        "o1-preview".to_string(),
    ])
}
