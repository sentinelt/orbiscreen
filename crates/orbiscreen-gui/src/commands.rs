// Orbiscreen - commands.rs (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

use crate::daemon_client::{DaemonClient, DaemonStatus};

#[tauri::command]
pub async fn get_status() -> DaemonStatus {
    DaemonClient::get_status().await
}

#[tauri::command]
pub async fn start_service() -> Result<String, String> {
    DaemonClient::start_service().await
}

#[tauri::command]
pub async fn stop_service() -> Result<String, String> {
    DaemonClient::stop_service().await
}

#[tauri::command]
pub async fn restart_service() -> Result<String, String> {
    DaemonClient::restart_service().await
}

#[tauri::command]
pub async fn run_doctor_check() -> Result<String, String> {
    DaemonClient::run_doctor_check().await
}

#[tauri::command]
pub async fn run_doctor_fix() -> Result<String, String> {
    DaemonClient::run_doctor_fix().await
}

#[tauri::command]
pub fn get_autostart() -> bool {
    DaemonClient::is_autostart_enabled()
}

#[tauri::command]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    DaemonClient::set_autostart(enabled)
}

#[tauri::command]
pub fn open_browser(url: String) -> Result<(), String> {
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    Ok(())
}
