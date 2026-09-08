// Orbiscreen - main.rs (GPL-3.0-or-later)
// https://github.com/shadow-x78/orbiscreen

mod commands;
mod daemon_client;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "orbiscreen_gui=info".into()),
        )
        .init();

    tauri::Builder::default()
        .setup(|app| {
            let toggle = MenuItem::with_id(app, "toggle", "Open Dashboard", true, None::<&str>)?;
            let start = MenuItem::with_id(app, "start", "Start Service", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "Stop Service", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&toggle, &start, &stop, &quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Orbiscreen Host Control Center")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "start" => {
                        tauri::async_runtime::spawn(async {
                            let _ = daemon_client::DaemonClient::start_service().await;
                        });
                    }
                    "stop" => {
                        tauri::async_runtime::spawn(async {
                            let _ = daemon_client::DaemonClient::stop_service().await;
                        });
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_status,
            commands::start_service,
            commands::stop_service,
            commands::restart_service,
            commands::run_doctor_check,
            commands::run_doctor_fix,
            commands::get_autostart,
            commands::set_autostart,
            commands::open_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running orbiscreen-gui");
}
