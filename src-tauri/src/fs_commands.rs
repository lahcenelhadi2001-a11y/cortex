//! File System Commands — Unified IPC commands for file operations.
//!
//! This module provides additional Tauri commands that complement the
//! existing `fs` module. It adds:
//! - `read_file` — returns `FileContent` with encoding detection
//! - `delete_entry` — unified delete for files and directories
//!
//! The bulk of file system operations (`fs_read_file`, `fs_write_file`,
//! `fs_create_file`, `fs_create_directory`, `fs_rename`, `fs_get_metadata`,
//! `fs_watch_directory`, etc.) are defined in the `fs` module and registered
//! via `workspace_commands!`.

use std::path::PathBuf;
use std::sync::Arc;

use tauri::{AppHandle, Manager};
use tracing::info;

use crate::fs::security::{validate_path_for_delete, validate_path_for_read};
use crate::fs::types::DirectoryCache;
use crate::models::FileContent;

/// Read a file and return its content with encoding metadata.
///
/// Uses `chardetng` + `encoding_rs` to detect the file encoding and decode
/// the content accordingly. Returns a `FileContent` struct containing the
/// decoded text, detected encoding name, file size, and path.
#[tauri::command]
pub async fn read_file(path: String) -> Result<FileContent, String> {
    let file_path = PathBuf::from(&path);
    let validated_path = validate_path_for_read(&file_path)?;

    if !validated_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !validated_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    let bytes = tokio::fs::read(&validated_path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let size = bytes.len() as u64;

    // Detect encoding via BOM first, then chardetng
    let (encoding, content) = if let Some((enc, _bom_len)) = encoding_rs::Encoding::for_bom(&bytes)
    {
        let (decoded, _, _) = enc.decode(&bytes);
        (enc.name().to_string(), decoded.into_owned())
    } else {
        let mut detector = chardetng::EncodingDetector::new();
        detector.feed(&bytes, true);
        let enc = detector.guess(None, true);
        let (decoded, _, _) = enc.decode(&bytes);
        (enc.name().to_string(), decoded.into_owned())
    };

    Ok(FileContent {
        content,
        encoding,
        size,
        path,
    })
}

/// Delete a file or directory at the given path.
///
/// For directories, performs a recursive delete. Invalidates the directory
/// cache for the parent path and (for directories) any cached subtrees.
#[tauri::command]
pub async fn delete_entry(app: AppHandle, path: String) -> Result<(), String> {
    let entry_path = PathBuf::from(&path);
    let validated_path = validate_path_for_delete(&entry_path)?;

    if !validated_path.exists() {
        return Ok(());
    }

    let cache = app.state::<Arc<DirectoryCache>>();

    if let Some(parent) = validated_path.parent() {
        cache.invalidate(&parent.to_string_lossy());
    }

    if validated_path.is_dir() {
        cache.invalidate_prefix(&path);
        tokio::fs::remove_dir_all(&validated_path)
            .await
            .map_err(|e| format!("Failed to delete directory: {}", e))?;
        info!("Deleted directory: {}", path);
    } else {
        tokio::fs::remove_file(&validated_path)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))?;
        info!("Deleted file: {}", path);
    }

    Ok(())
}
