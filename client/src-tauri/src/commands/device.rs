use serde::Serialize;
use sha2::{Sha256, Digest};

#[cfg(any(target_os = "windows", target_os = "macos"))]
use std::process::Command;

#[derive(Serialize)]
pub struct DeviceInfo {
    pub fingerprint: String,
    pub name: String,
    pub os: String,
}

#[tauri::command]
pub fn get_device_info() -> Result<DeviceInfo, String> {
    let os = get_os_name();
    let name = get_hostname();
    let fingerprint = generate_fingerprint()?;

    Ok(DeviceInfo {
        fingerprint,
        name,
        os,
    })
}

fn get_os_name() -> String {
    #[cfg(target_os = "windows")]
    { "Windows".to_string() }
    #[cfg(target_os = "macos")]
    { "macOS".to_string() }
    #[cfg(target_os = "linux")]
    { "Linux".to_string() }
}

fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
}

fn generate_fingerprint() -> Result<String, String> {
    let mut components: Vec<String> = Vec::new();

    // Get unique machine identifiers per OS
    #[cfg(target_os = "windows")]
    {
        // Windows: WMI BIOS serial + motherboard serial
        if let Ok(output) = Command::new("wmic")
            .args(["bios", "get", "serialnumber"])
            .output()
        {
            let s = String::from_utf8_lossy(&output.stdout);
            let serial = s.lines().nth(1).unwrap_or("").trim();
            if !serial.is_empty() {
                components.push(format!("bios:{}", serial));
            }
        }
        if let Ok(output) = Command::new("wmic")
            .args(["baseboard", "get", "serialnumber"])
            .output()
        {
            let s = String::from_utf8_lossy(&output.stdout);
            let serial = s.lines().nth(1).unwrap_or("").trim();
            if !serial.is_empty() {
                components.push(format!("mb:{}", serial));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: IOKit hardware UUID
        if let Ok(output) = Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            let s = String::from_utf8_lossy(&output.stdout);
            for line in s.lines() {
                if line.contains("IOPlatformUUID") {
                    if let Some(uuid) = line.split('"').nth(3) {
                        components.push(format!("uuid:{}", uuid));
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: machine-id
        if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
            components.push(format!("machine:{}", id.trim()));
        }
        if let Ok(id) = std::fs::read_to_string("/sys/class/dmi/id/product_uuid") {
            components.push(format!("product:{}", id.trim()));
        }
    }

    // Fallback: use hostname + username
    if components.is_empty() {
        let user = std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_else(|_| "unknown".to_string());
        components.push(format!("user:{}", user));
        components.push(format!("host:{}", get_hostname()));
    }

    let combined = components.join("|");
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result))
}
