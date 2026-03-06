//! Browser module using Tauri's Webview API for embedded child webviews
//!
//! This module creates webviews embedded directly within the main window,
//! not as separate windows.

use std::net::IpAddr;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, WebviewBuilder, WebviewUrl, command};
use tracing::info;
use url::Url;

fn validate_browser_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(url).map_err(|e| format!("Invalid URL: {}", e))?;
    match parsed.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(format!(
                "Embedded browser only supports http/https loopback URLs, got '{}'",
                scheme
            ));
        }
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "Embedded browser URL must include a host".to_string())?;
    let is_loopback_host = host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<IpAddr>()
            .map(|ip| ip.is_loopback())
            .unwrap_or(false);

    if !is_loopback_host {
        return Err(
            "Embedded browser rejected a non-loopback URL to avoid exposing Tauri IPC to remote pages"
                .to_string(),
        );
    }

    Ok(parsed)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserWebviewInfo {
    pub id: String,
    pub url: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateBrowserParams {
    pub id: String,
    pub url: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBrowserParams {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Deserialize)]
pub struct NavigateBrowserParams {
    pub id: String,
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct VisibilityParams {
    pub id: String,
    pub visible: bool,
}

/// Create a new browser webview embedded in the main window
#[command]
pub async fn browser_create<R: Runtime>(
    app: AppHandle<R>,
    params: CreateBrowserParams,
) -> Result<BrowserWebviewInfo, String> {
    info!(
        "[Browser] Creating embedded webview: {} at ({}, {}) size {}x{}",
        params.id, params.x, params.y, params.width, params.height
    );

    // Get the main window
    let main_window = app
        .get_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    // Check if webview already exists
    if app.get_webview(&params.id).is_some() {
        // Destroy existing one first
        if let Some(webview) = app.get_webview(&params.id) {
            let _ = webview.close();
        }
    }

    // Create webview builder with the URL
    let url = validate_browser_url(&params.url)?;

    let webview_builder = WebviewBuilder::new(&params.id, WebviewUrl::External(url)).auto_resize();

    // Add the webview to the main window at the specified position
    let _webview = main_window
        .add_child(
            webview_builder,
            tauri::LogicalPosition::new(params.x, params.y),
            tauri::LogicalSize::new(params.width, params.height),
        )
        .map_err(|e| format!("Failed to create webview: {}", e))?;

    info!(
        "[Browser] Embedded webview created successfully: {}",
        params.id
    );

    Ok(BrowserWebviewInfo {
        id: params.id,
        url: params.url,
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
    })
}

/// Update webview bounds/position
#[command]
pub async fn browser_set_bounds<R: Runtime>(
    app: AppHandle<R>,
    params: UpdateBrowserParams,
) -> Result<(), String> {
    info!(
        "[Browser] Setting bounds for {}: ({}, {}) {}x{}",
        params.id, params.x, params.y, params.width, params.height
    );

    let webview = app
        .get_webview(&params.id)
        .ok_or_else(|| format!("Webview not found: {}", params.id))?;

    webview
        .set_position(tauri::LogicalPosition::new(params.x, params.y))
        .map_err(|e| format!("Failed to set position: {}", e))?;

    webview
        .set_size(tauri::LogicalSize::new(params.width, params.height))
        .map_err(|e| format!("Failed to set size: {}", e))?;

    Ok(())
}

/// Navigate webview to URL
#[command]
pub async fn browser_navigate<R: Runtime>(
    app: AppHandle<R>,
    params: NavigateBrowserParams,
) -> Result<(), String> {
    info!("[Browser] Navigating {} to {}", params.id, params.url);

    let webview = app
        .get_webview(&params.id)
        .ok_or_else(|| format!("Webview not found: {}", params.id))?;

    let url: tauri::Url = validate_browser_url(&params.url)?;

    webview
        .navigate(url)
        .map_err(|e| format!("Failed to navigate: {}", e))?;

    Ok(())
}

/// Set webview visibility
#[command]
pub async fn browser_set_visible<R: Runtime>(
    app: AppHandle<R>,
    params: VisibilityParams,
) -> Result<(), String> {
    info!(
        "[Browser] Setting visibility for {}: {}",
        params.id, params.visible
    );

    let webview = app
        .get_webview(&params.id)
        .ok_or_else(|| format!("Webview not found: {}", params.id))?;

    if params.visible {
        webview
            .show()
            .map_err(|e| format!("Failed to show: {}", e))?;
    } else {
        webview
            .hide()
            .map_err(|e| format!("Failed to hide: {}", e))?;
    }

    Ok(())
}

/// Destroy a browser webview
#[command]
pub async fn browser_destroy<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    info!("[Browser] Destroying webview: {}", id);

    let webview = app
        .get_webview(&id)
        .ok_or_else(|| format!("Webview not found: {}", id))?;

    webview
        .close()
        .map_err(|e| format!("Failed to close: {}", e))?;

    info!("[Browser] Webview destroyed");
    Ok(())
}

/// List all browser webviews (excluding main)
#[command]
pub async fn browser_list<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<BrowserWebviewInfo>, String> {
    let webviews = app.webviews();
    let mut result = Vec::new();

    for (label, webview) in webviews {
        // Skip main webview
        if label == "main" {
            continue;
        }

        let pos = webview.position().unwrap_or_default();
        let size = webview.size().unwrap_or_default();
        let url = webview.url().map(|u| u.to_string()).unwrap_or_default();

        result.push(BrowserWebviewInfo {
            id: label,
            url,
            x: pos.x as f64,
            y: pos.y as f64,
            width: size.width as f64,
            height: size.height as f64,
        });
    }

    Ok(result)
}

/// Get info for a specific webview
#[command]
pub async fn browser_get<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<BrowserWebviewInfo, String> {
    let webview = app
        .get_webview(&id)
        .ok_or_else(|| format!("Webview not found: {}", id))?;

    let pos = webview
        .position()
        .map_err(|e| format!("Failed to get position: {}", e))?;
    let size = webview
        .size()
        .map_err(|e| format!("Failed to get size: {}", e))?;
    let url = webview.url().map(|u| u.to_string()).unwrap_or_default();

    Ok(BrowserWebviewInfo {
        id,
        url,
        x: pos.x as f64,
        y: pos.y as f64,
        width: size.width as f64,
        height: size.height as f64,
    })
}

/// Focus the browser webview
#[command]
pub async fn browser_focus<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    info!("[Browser] Focusing webview: {}", id);

    let webview = app
        .get_webview(&id)
        .ok_or_else(|| format!("Webview not found: {}", id))?;

    webview
        .set_focus()
        .map_err(|e| format!("Failed to focus: {}", e))?;

    Ok(())
}

/// Execute JavaScript in the browser webview
#[command]
pub async fn browser_eval<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    script: String,
) -> Result<(), String> {
    info!("[Browser] Executing script in {}", id);

    let webview = app
        .get_webview(&id)
        .ok_or_else(|| format!("Webview not found: {}", id))?;

    webview
        .eval(&script)
        .map_err(|e| format!("Failed to eval: {}", e))?;

    Ok(())
}

/// Go back in browser history
#[command]
pub async fn browser_back<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    let webview = app
        .get_webview(&id)
        .ok_or_else(|| format!("Webview not found: {}", id))?;

    webview
        .eval("window.history.back()")
        .map_err(|e| format!("Failed to go back: {}", e))?;

    Ok(())
}

/// Go forward in browser history
#[command]
pub async fn browser_forward<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    let webview = app
        .get_webview(&id)
        .ok_or_else(|| format!("Webview not found: {}", id))?;

    webview
        .eval("window.history.forward()")
        .map_err(|e| format!("Failed to go forward: {}", e))?;

    Ok(())
}

/// Reload the browser webview
#[command]
pub async fn browser_reload<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    let webview = app
        .get_webview(&id)
        .ok_or_else(|| format!("Webview not found: {}", id))?;

    webview
        .eval("window.location.reload()")
        .map_err(|e| format!("Failed to reload: {}", e))?;

    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn validate_browser_url_allows_loopback_hosts() {
        assert!(validate_browser_url("http://127.0.0.1:1420/welcome").is_ok());
        assert!(validate_browser_url("https://localhost:9223/tools").is_ok());
    }

    #[test]
    fn validate_browser_url_rejects_remote_hosts() {
        let error = validate_browser_url("https://attacker.example/poc.html")
            .expect_err("remote URLs should be rejected");
        assert!(error.contains("non-loopback URL"));
    }

    #[test]
    fn validate_browser_url_rejects_non_http_schemes() {
        let error =
            validate_browser_url("file:///tmp/poc.html").expect_err("file URLs should be rejected");
        assert!(error.contains("loopback URLs"));
    }
}
