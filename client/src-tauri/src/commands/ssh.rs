use serde::Serialize;
use ssh_key::{LineEnding, PrivateKey};
use std::path::PathBuf;

#[derive(Serialize)]
pub struct SshKeyPair {
    pub public_key: String,
    pub fingerprint: String,
    pub key_path: String,
}

#[tauri::command]
pub fn generate_ssh_key(label: &str) -> Result<SshKeyPair, String> {
    // Generate Ed25519 key pair
    let mut rng = rand::thread_rng();
    let private_key = PrivateKey::random(&mut rng, ssh_key::Algorithm::Ed25519)
        .map_err(|e| format!("Failed to generate key: {}", e))?;

    // Get public key
    let public_key = private_key.public_key().to_openssh()
        .map_err(|e| format!("Failed to format public key: {}", e))?;

    // Compute fingerprint
    let fingerprint = private_key.fingerprint(ssh_key::HashAlg::Sha256).to_string();

    // Save to keyring
    let entry = keyring::Entry::new("dsc-client", label)
        .map_err(|e| format!("Keyring error: {}", e))?;

    let private_pem = private_key.to_openssh(LineEnding::LF)
        .map_err(|e| format!("Failed to encode private key: {}", e))?;

    entry.set_password(private_pem.to_string().as_str())
        .map_err(|e| format!("Failed to store key in keyring: {}", e))?;

    // Also save to filesystem for SSH client compatibility
    let key_dir = get_ssh_dir()?;
    let key_path = key_dir.join(format!("dsc_{}", label.replace(' ', "_")));

    std::fs::write(&key_path, private_pem.to_string().as_bytes())
        .map_err(|e| format!("Failed to write key file: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| format!("Failed to set key permissions: {}", e))?;
    }

    // Write public key
    std::fs::write(key_path.with_extension("pub"), public_key.as_bytes())
        .map_err(|e| format!("Failed to write public key: {}", e))?;

    Ok(SshKeyPair {
        public_key: public_key.to_string(),
        fingerprint,
        key_path: key_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_stored_key(label: &str) -> Result<Option<SshKeyPair>, String> {
    let entry = keyring::Entry::new("dsc-client", label)
        .map_err(|e| format!("Keyring error: {}", e))?;

    match entry.get_password() {
        Ok(pem) => {
            let private_key = PrivateKey::from_openssh(&pem)
                .map_err(|e| format!("Invalid stored key: {}", e))?;
            let public_key = private_key.public_key().to_openssh()
                .map_err(|e| format!("Failed to format public key: {}", e))?;
            let fingerprint = private_key.fingerprint(ssh_key::HashAlg::Sha256).to_string();

            let key_dir = get_ssh_dir()?;
            let key_path = key_dir.join(format!("dsc_{}", label.replace(' ', "_")));

            Ok(Some(SshKeyPair {
                public_key: public_key.to_string(),
                fingerprint,
                key_path: key_path.to_string_lossy().to_string(),
            }))
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn write_ssh_config(host: &str, port: u16, user: &str, key_path: &str) -> Result<(), String> {
    let ssh_dir = get_ssh_dir()?;
    let config_path = ssh_dir.join("config");
    let host_alias = "dsc-server";

    let entry = format!(
        "\n# DioraServerConnecter\nHost {}\n    HostName {}\n    Port {}\n    User {}\n    IdentityFile {}\n    StrictHostKeyChecking accept-new\n",
        host_alias, host, port, user, key_path
    );

    let existing = std::fs::read_to_string(&config_path).unwrap_or_default();

    if existing.contains("# DioraServerConnecter") {
        // Replace existing entry
        let mut lines: Vec<&str> = existing.lines().collect();
        let mut start = None;
        let mut end = None;
        for (i, line) in lines.iter().enumerate() {
            if line.contains("# DioraServerConnecter") {
                start = Some(i);
            }
            if start.is_some() && end.is_none() && i > start.unwrap() && !line.starts_with("    ") && !line.is_empty() {
                end = Some(i);
            }
        }
        if let Some(s) = start {
            let e = end.unwrap_or(lines.len());
            lines.drain(s..e);
        }
        let mut content = lines.join("\n");
        content.push_str(&entry);
        std::fs::write(&config_path, content)
            .map_err(|e| format!("Failed to write SSH config: {}", e))?;
    } else {
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(&config_path)
            .map_err(|e| format!("Failed to open SSH config: {}", e))?;
        use std::io::Write;
        file.write_all(entry.as_bytes())
            .map_err(|e| format!("Failed to append SSH config: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_vscode(host: &str, port: u16) -> Result<(), String> {
    let uri = format!("vscode://vscode-remote/ssh-remote+devuser@{}:{}/workspace", host, port);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", &uri])
            .spawn()
            .map_err(|e| format!("Failed to open VS Code: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&uri)
            .spawn()
            .map_err(|e| format!("Failed to open VS Code: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&uri)
            .spawn()
            .map_err(|e| format!("Failed to open VS Code: {}", e))?;
    }

    Ok(())
}

fn get_ssh_dir() -> Result<PathBuf, String> {
    let home = dirs_next().ok_or("Cannot determine home directory")?;
    let ssh_dir = home.join(".ssh");
    if !ssh_dir.exists() {
        std::fs::create_dir_all(&ssh_dir)
            .map_err(|e| format!("Failed to create .ssh dir: {}", e))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&ssh_dir, std::fs::Permissions::from_mode(0o700))
                .map_err(|e| format!("Failed to set .ssh permissions: {}", e))?;
        }
    }
    Ok(ssh_dir)
}

fn dirs_next() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    { std::env::var("USERPROFILE").ok().map(PathBuf::from) }
    #[cfg(not(target_os = "windows"))]
    { std::env::var("HOME").ok().map(PathBuf::from) }
}
