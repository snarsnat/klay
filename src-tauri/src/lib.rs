mod commands;

use commands::{modes, files, ai};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            modes::load_modes,
            files::get_file_tree,
            ai::chat_completion,
            ai::get_available_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
