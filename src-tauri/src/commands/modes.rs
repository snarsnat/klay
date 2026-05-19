use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Mode {
    pub id: String,
    pub name: String,
    pub content: String,
    pub color: String,
    pub icon: String,
}

const MODES_DIR: &str = "./modes";

/// Load all mode .md files from the modes directory
#[tauri::command]
pub async fn load_modes() -> Result<Vec<Mode>, String> {
    let modes_path = Path::new(MODES_DIR);

    if !modes_path.exists() {
        fs::create_dir_all(modes_path).map_err(|e| format!("Failed to create modes dir: {}", e))?;
        return Ok(vec![]);
    }

    let mut modes = Vec::new();
    let mut entries = fs::read_dir(modes_path)
        .map_err(|e| format!("Failed to read modes dir: {}", e))?;

    while let Some(entry) = entries.next() {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;

            let id = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")
                .to_lowercase();

            let name = id
                .split(&['-', '_'])
                .map(|w| {
                    let mut c = w.chars();
                    match c.next() {
                        None => String::new(),
                        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");

            modes.push(Mode {
                id,
                name,
                content,
                color: String::from("#8d8d91"),
                icon: String::from("FileText"),
            });
        }
    }

    // Sort modes alphabetically by id
    modes.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(modes)
}
