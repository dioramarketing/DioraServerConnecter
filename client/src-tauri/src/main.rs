// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::device::get_device_info;
use commands::ssh::{generate_ssh_key, get_stored_key, write_ssh_config, open_vscode};

fn main() {
    tauri::Builder::default()
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
