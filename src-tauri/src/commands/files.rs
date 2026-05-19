use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extension: Option<String>,
}

/// Directories to always ignore when building file tree
const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    ".svelte-kit",
    "build",
    ".vscode",
    "dist",
];

/// Files to ignore
const IGNORED_FILES: &[&str] = &[
    ".DS_Store",
    "package-lock.json",
    "yarn.lock",
    "Cargo.lock",
];

/// Get the project file tree
#[tauri::command]
pub async fn get_file_tree(root_path: String) -> Result<FileNode, String> {
    build_file_tree(&root_path, 0, 3) // max depth 3
}

fn build_file_tree(path: &str, depth: usize, max_depth: usize) -> Result<FileNode, String> {
    let path_obj = Path::new(path);
    let name = path_obj
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string();

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read metadata: {}", e))?;

    if metadata.is_file() {
        let ext = path_obj
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string());

        return Ok(FileNode {
            name,
            path: path.to_string(),
            file_type: "file".to_string(),
            children: None,
            size: Some(metadata.len()),
            extension: ext,
        });
    }

    // It's a directory - list children
    let mut children = Vec::new();

    if depth < max_depth && !IGNORED_DIRS.contains(&name.as_str()) {
        let mut entries: Vec<_> = fs::read_dir(path)
            .map_err(|e| format!("Failed to read dir {}: {}", path, e))?
            .filter_map(|e| e.ok())
            .collect();

        // Sort: directories first, then files, alphabetically
        entries.sort_by(|a, b| {
            let a_is_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
            let b_is_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
            if a_is_dir != b_is_dir {
                b_is_dir.cmp(&a_is_dir)
            } else {
                a.file_name().cmp(&b.file_name())
            }
        });

        for entry in entries {
            let entry_name = entry.file_name().to_string_lossy().to_string();

            // Skip ignored items
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if IGNORED_DIRS.contains(&entry_name.as_str()) {
                    continue;
                }
            } else {
                if IGNORED_FILES.contains(&entry_name.as_str()) {
                    continue;
                }
            }

            let child_path = entry.path().to_string_lossy().to_string();
            if let Ok(child) = build_file_tree(&child_path, depth + 1, max_depth) {
                children.push(child);
            }
        }
    }

    Ok(FileNode {
        name,
        path: path.to_string(),
        file_type: "directory".to_string(),
        children: Some(children),
        size: None,
        extension: None,
    })
}
