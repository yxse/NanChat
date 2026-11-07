//! Secret storage for the desktop app (seed, PIN, chat tokens).
//!
//! The OS keyring is used when it works: Keychain on macOS, Credential Manager
//! on Windows, Secret Service (GNOME Keyring, KWallet, KeePassXC...) on Linux.
//!
//! On Linux the Secret Service is often missing or unusable (minimal window
//! managers, KDE without the Secret Service API, no default collection, locked
//! keyring without an unlock prompt...). Whenever it fails, we fall back to a
//! JSON file in the app data dir, readable only by the user (0600). In that
//! mode the frontend requires a password, so the seed in that file is
//! encrypted.
//!
//! The choice is sticky: once the file holds a seed, it is always used, even if
//! the keyring works later. Otherwise a keyring that is only locked for one
//! session could hide one wallet and later bring back another.
//!
//! Secrets are also looked up in older locations and moved to the current one:
//! - the kernel keyring (keyutils), where Linux builds before 2.0 stored
//!   secrets (lost on reboot)
//! - the fallback file (secrets other than the seed, e.g. PIN), when the
//!   keyring is used

use keyring::{error::Error as KeyringError, Entry};
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
// File is only picked on Linux
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
#[serde(rename_all = "camelCase")]
pub enum Backend {
    Keyring,
    File,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageStatus {
    /// None when no storage is usable right now (see `error`)
    backend: Option<Backend>,
    error: Option<String>,
    /// Why the system keyring wasn't used, when it failed (Linux file fallback)
    keyring_error: Option<String>,
}

const FILE_NAME: &str = "secure-store.json";

/// Backend picked by the first successful check, kept for the whole session so
/// secrets never end up split between the keyring and the file.
static BACKEND: Mutex<Option<Backend>> = Mutex::new(None);
/// Why the keyring check failed, when the file fallback was picked because of it
static KEYRING_ERROR: Mutex<Option<String>> = Mutex::new(None);
/// Serializes read-modify-write cycles of the fallback file
static FILE_LOCK: Mutex<()> = Mutex::new(());

pub fn status<R: Runtime>(app: &AppHandle<R>, recheck: bool) -> StorageStatus {
    if recheck {
        *BACKEND.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }
    let (backend, error) = match backend(app) {
        Ok(backend) => (Some(backend), None),
        Err(error) => (None, Some(error)),
    };
    let keyring_error = KEYRING_ERROR.lock().unwrap_or_else(|e| e.into_inner()).clone();
    StorageStatus { backend, error, keyring_error }
}

pub fn save<R: Runtime>(app: &AppHandle<R>, service: &str, user: &str, secret: &str) -> Result<(), String> {
    match backend(app)? {
        Backend::Keyring => {
            Entry::new(service, user)
                .and_then(|entry| entry.set_password(secret))
                .map_err(|err| format!("Could not save to the system keyring: {err}"))?;
            // a stale fallback copy would never be read again, drop it
            if let Err(err) = file_remove(app, service, user) {
                log::warn!("Failed to remove fallback file copy of {service}/{user}: {err}");
            }
            Ok(())
        }
        Backend::File => file_set(app, service, user, secret),
    }
}

/// Ok(None) when the secret doesn't exist, Err when the storage can't be read
pub fn get<R: Runtime>(app: &AppHandle<R>, service: &str, user: &str) -> Result<Option<String>, String> {
    match backend(app)? {
        Backend::Keyring => {
            let entry = Entry::new(service, user).map_err(|err| err.to_string())?;
            match entry.get_password() {
                Ok(secret) => Ok(Some(secret)),
                Err(KeyringError::NoEntry) => {
                    let Some((secret, source)) = find_legacy(app, service, user)? else {
                        return Ok(None);
                    };
                    entry
                        .set_password(&secret)
                        .map_err(|err| format!("Could not save to the system keyring: {err}"))?;
                    source.remove(app, service, user);
                    Ok(Some(secret))
                }
                Err(err) => Err(format!("Could not read the system keyring: {err}")),
            }
        }
        Backend::File => {
            if let Some(secret) = file_get(app, service, user)? {
                return Ok(Some(secret));
            }
            #[cfg(target_os = "linux")]
            if let Some(secret) = keyutils_get(service, user) {
                file_set(app, service, user, &secret)?;
                LegacySource::Keyutils.remove(app, service, user);
                return Ok(Some(secret));
            }
            Ok(None)
        }
    }
}

pub fn delete<R: Runtime>(app: &AppHandle<R>, service: &str, user: &str) -> Result<(), String> {
    // clear legacy copies too, otherwise the next get would bring them back
    #[cfg(target_os = "linux")]
    LegacySource::Keyutils.remove(app, service, user);

    match backend(app)? {
        Backend::Keyring => {
            if let Err(err) = file_remove(app, service, user) {
                log::warn!("Failed to remove fallback file copy of {service}/{user}: {err}");
            }
            match Entry::new(service, user).and_then(|entry| entry.delete_credential()) {
                Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
                Err(err) => Err(format!("Could not delete from the system keyring: {err}")),
            }
        }
        Backend::File => file_remove(app, service, user),
    }
}

fn backend<R: Runtime>(app: &AppHandle<R>) -> Result<Backend, String> {
    let mut cached = BACKEND.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(backend) = *cached {
        return Ok(backend);
    }
    let backend = probe(app)?;
    log::info!("Secure storage backend: {backend:?}");
    *cached = Some(backend);
    Ok(backend)
}

#[cfg(not(target_os = "linux"))]
fn probe<R: Runtime>(_app: &AppHandle<R>) -> Result<Backend, String> {
    Ok(Backend::Keyring)
}

/// Write, read back and delete a throwaway secret to check that a Secret
/// Service is really there and usable.
#[cfg(target_os = "linux")]
fn probe<R: Runtime>(app: &AppHandle<R>) -> Result<Backend, String> {
    *KEYRING_ERROR.lock().unwrap_or_else(|e| e.into_inner()) = None;
    // sticky: the wallet lives in the file, never look elsewhere
    if file_get(app, "nanwallet", "seed")?.is_some() {
        return Ok(Backend::File);
    }
    const VALUE: &str = "ok";
    let check = || -> Result<bool, KeyringError> {
        let entry = Entry::new("nanwallet", "__storage_probe__")?;
        entry.set_password(VALUE)?;
        let read_back = entry.get_password()?;
        let _ = entry.delete_credential();
        Ok(read_back == VALUE)
    };
    let error = match check() {
        Ok(true) => return Ok(Backend::Keyring),
        Ok(false) => "the system keyring returned a different value than written".to_string(),
        Err(KeyringError::NoStorageAccess(err)) => {
            format!("the system keyring is locked or access was denied: {err}")
        }
        Err(err) => format!("no usable system keyring: {err}"),
    };
    // If a wallet is in a keyring that is only locked, the frontend offers to
    // unlock it and retry (see keyring_error) before the user starts over.
    log::warn!("Using file storage, {error}");
    *KEYRING_ERROR.lock().unwrap_or_else(|e| e.into_inner()) = Some(error);
    Ok(Backend::File)
}

// ---- legacy locations ----

enum LegacySource {
    #[cfg(target_os = "linux")]
    Keyutils,
    File,
}

impl LegacySource {
    fn remove<R: Runtime>(&self, app: &AppHandle<R>, service: &str, user: &str) {
        match self {
            #[cfg(target_os = "linux")]
            LegacySource::Keyutils => {
                use keyring::credential::CredentialApi;
                if let Ok(legacy) = keyring::keyutils::KeyutilsCredential::new_with_target(None, service, user) {
                    match legacy.delete_credential() {
                        Ok(()) | Err(KeyringError::NoEntry) => {}
                        Err(err) => log::warn!("Failed to delete legacy keyutils secret {service}/{user}: {err}"),
                    }
                }
            }
            LegacySource::File => {
                if let Err(err) = file_remove(app, service, user) {
                    log::warn!("Failed to remove migrated secret {service}/{user} from file: {err}");
                }
            }
        }
    }
}

/// Look for a secret missing from the keyring in the places it may have been
/// saved before.
fn find_legacy<R: Runtime>(
    app: &AppHandle<R>,
    service: &str,
    user: &str,
) -> Result<Option<(String, LegacySource)>, String> {
    #[cfg(target_os = "linux")]
    if let Some(secret) = keyutils_get(service, user) {
        return Ok(Some((secret, LegacySource::Keyutils)));
    }
    Ok(file_get(app, service, user)?.map(|secret| (secret, LegacySource::File)))
}

/// Linux builds before 2.0 stored secrets in the kernel keyring only
#[cfg(target_os = "linux")]
fn keyutils_get(service: &str, user: &str) -> Option<String> {
    use keyring::credential::CredentialApi;
    keyring::keyutils::KeyutilsCredential::new_with_target(None, service, user)
        .and_then(|legacy| legacy.get_password())
        .ok()
}

// ---- fallback file ----

type FileStore = BTreeMap<String, BTreeMap<String, String>>;

fn file_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(FILE_NAME))
        .map_err(|err| format!("Could not locate the app data folder: {err}"))
}

fn read_file(path: &PathBuf) -> Result<FileStore, String> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text)
            // never overwrite a file we can't parse, it may hold the only copy of a seed
            .map_err(|err| format!("{} is corrupted: {err}", path.display())),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(FileStore::new()),
        Err(err) => Err(format!("Could not read {}: {err}", path.display())),
    }
}

/// Write to a temp file then rename, so a crash never leaves a half-written file
fn write_file(path: &PathBuf, store: &FileStore) -> Result<(), String> {
    let dir = path.parent().ok_or("Invalid storage path")?;
    fs::create_dir_all(dir).map_err(|err| format!("Could not create {}: {err}", dir.display()))?;
    let json = serde_json::to_string(store).map_err(|err| err.to_string())?;
    let tmp = path.with_extension("json.tmp");

    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let write = || -> std::io::Result<()> {
        let mut file = options.open(&tmp)?;
        // mode() only applies on creation, enforce it on a leftover temp file too
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            file.set_permissions(fs::Permissions::from_mode(0o600))?;
        }
        file.write_all(json.as_bytes())?;
        file.sync_all()?;
        fs::rename(&tmp, path)
    };
    write().map_err(|err| format!("Could not write {}: {err}", path.display()))
}

fn file_get<R: Runtime>(app: &AppHandle<R>, service: &str, user: &str) -> Result<Option<String>, String> {
    let path = file_path(app)?;
    let _guard = FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let store = read_file(&path)?;
    Ok(store.get(service).and_then(|entries| entries.get(user)).cloned())
}

fn file_set<R: Runtime>(app: &AppHandle<R>, service: &str, user: &str, secret: &str) -> Result<(), String> {
    let path = file_path(app)?;
    let _guard = FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut store = read_file(&path)?;
    store
        .entry(service.to_string())
        .or_default()
        .insert(user.to_string(), secret.to_string());
    write_file(&path, &store)
}

fn file_remove<R: Runtime>(app: &AppHandle<R>, service: &str, user: &str) -> Result<(), String> {
    let path = file_path(app)?;
    let _guard = FILE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    if !path.exists() {
        return Ok(());
    }
    let mut store = read_file(&path)?;
    let Some(entries) = store.get_mut(service) else { return Ok(()) };
    if entries.remove(user).is_none() {
        return Ok(());
    }
    if entries.is_empty() {
        store.remove(service);
    }
    write_file(&path, &store)
}
