// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::device::get_device_info;
use commands::ssh::{generate_ssh_key, get_stored_key, write_ssh_config, open_vscode};

fn main() {
    // Set panic hook so errors are visible on Windows (no console in release)
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("Application panic:\n{}", info);
        log_and_show_error(&msg);
    }));

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_device_info,
            generate_ssh_key,
            get_stored_key,
            write_ssh_config,
            open_vscode,
        ])
        .run(tauri::generate_context!());

    if let Err(e) = result {
        log_and_show_error(&format!("Failed to start application:\n{}", e));
    }
}

fn log_and_show_error(msg: &str) {
    // Write error to log file in user's home directory
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let log_path = std::path::Path::new(&home).join("dsc-error.log");
    let _ = std::fs::write(&log_path, msg);

    // Show message box on Windows
    #[cfg(target_os = "windows")]
    {
        #[link(name = "user32")]
        extern "system" {
            fn MessageBoxW(hwnd: isize, text: *const u16, caption: *const u16, utype: u32) -> i32;
        }
        let text: Vec<u16> = msg.encode_utf16().chain(std::iter::once(0)).collect();
        let caption: Vec<u16> = "DioraServerConnecter Error"
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        unsafe {
            MessageBoxW(0, text.as_ptr(), caption.as_ptr(), 0x10);
        }
    }

    eprintln!("{}", msg);
}
