use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    env,
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::http::{header, Method, Request, Response, StatusCode};

const MANIFEST_SCHEMA: u8 = 1;
const MANIFEST_FILE: &str = "game.manifest.json";
const GAME_ROOT_ENV: &str = "JIISHII_GAME_ROOT";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EngineManifest {
    min_version: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestEntry {
    config: Option<String>,
    characters: Option<String>,
    sprite_animations: Option<String>,
    sprite_manifest: Option<String>,
    scenes: Vec<String>,
    surface_modules: Vec<String>,
    sprite_recipes: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFile {
    kind: String,
    size: u64,
    mtime: u128,
    #[serde(skip_serializing_if = "Option::is_none")]
    sha256: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameManifest {
    schema: u8,
    mode: String,
    game_id: String,
    engine: EngineManifest,
    entry: ManifestEntry,
    files: BTreeMap<String, ManifestFile>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PackageManifestResponse {
    root: String,
    manifest: GameManifest,
    changed: bool,
    warnings: Vec<String>,
}

/**
 * Starts the native app shell and exposes only package-loading infrastructure to
 * the web bundle. Story logic remains JavaScript-owned.
 */
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("jiishii-game", |_context, request| serve_game_file(request))
        .invoke_handler(tauri::generate_handler![
            jiishii_package_manifest,
            jiishii_rebuild_manifest
        ])
        .run(tauri::generate_context!())
        .expect("error while running JiiShii");
}

#[tauri::command]
fn jiishii_package_manifest() -> Result<PackageManifestResponse, String> {
    let root = resolve_game_root()?;
    if !root.exists() {
        return Err(format!("loose game folder not found: {}", root.display()));
    }

    let manifest_path = root.join(MANIFEST_FILE);
    if !manifest_path.exists() {
        let manifest = scan_manifest(&root, "dev")?;
        write_manifest(&manifest_path, &manifest)?;
        return Ok(PackageManifestResponse {
            root: root.display().to_string(),
            manifest,
            changed: true,
            warnings: vec![format!("Created missing {MANIFEST_FILE}.")],
        });
    }

    let manifest = read_manifest(&manifest_path)?;
    let status = compare_manifest(&root, &manifest)?;
    Ok(PackageManifestResponse {
        root: root.display().to_string(),
        manifest,
        changed: status.changed,
        warnings: status.warnings,
    })
}

#[tauri::command]
fn jiishii_rebuild_manifest() -> Result<PackageManifestResponse, String> {
    let root = resolve_game_root()?;
    if !root.exists() {
        return Err(format!("loose game folder not found: {}", root.display()));
    }

    let existing_manifest = read_manifest(&root.join(MANIFEST_FILE)).ok();
    let mode = existing_manifest
        .as_ref()
        .map(|manifest| manifest.mode.as_str())
        .unwrap_or("dev");
    let manifest = scan_manifest(&root, mode)?;
    write_manifest(&root.join(MANIFEST_FILE), &manifest)?;
    Ok(PackageManifestResponse {
        root: root.display().to_string(),
        manifest,
        changed: false,
        warnings: vec![format!("Rebuilt {MANIFEST_FILE}.")],
    })
}

/**
 * Resolves the loose package root. Release builds use a sibling game/ folder;
 * tests and local smoke runs may set JIISHII_GAME_ROOT.
 */
fn resolve_game_root() -> Result<PathBuf, String> {
    if let Ok(root) = env::var(GAME_ROOT_ENV) {
        return Ok(PathBuf::from(root));
    }
    let exe = env::current_exe().map_err(|error| format!("cannot find executable path: {error}"))?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "cannot find executable directory".to_string())?;
    Ok(exe_dir.join("game"))
}

/**
 * Handles jiishii-game:// requests through a scoped filesystem lookup.
 */
fn serve_game_file(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    if request.method() == Method::OPTIONS {
        return cors_response(StatusCode::NO_CONTENT, Vec::new(), "text/plain; charset=utf-8");
    }

    let root = match resolve_game_root().and_then(|path| scoped_root(&path)) {
        Ok(root) => root,
        Err(error) => return text_response(StatusCode::NOT_FOUND, error),
    };
    let relative_path = decode_request_path(request.uri().path());
    let target = match scoped_package_file(&root, &relative_path) {
        Ok(target) => target,
        Err(error) => return text_response(StatusCode::FORBIDDEN, error),
    };

    match fs::read(&target) {
        Ok(bytes) => cors_response(StatusCode::OK, bytes, mime_for_path(&target)),
        Err(_) => text_response(StatusCode::NOT_FOUND, "package file not found".to_string()),
    }
}

/**
 * Canonicalizes the package root before any request-path checks.
 */
fn scoped_root(root: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(root).map_err(|error| format!("cannot open loose game folder: {error}"))
}

/**
 * Returns a package file only when its final path stays inside the package root.
 */
fn scoped_package_file(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let normalized = normalize_package_path(relative_path);
    if normalized.is_empty() || normalized.contains("..") {
        return Err("blocked unsafe package path".to_string());
    }
    let target = root.join(normalized);
    let canonical = fs::canonicalize(&target).map_err(|_| "package file not found".to_string())?;
    if !canonical.starts_with(root) {
        return Err("blocked package path outside game folder".to_string());
    }
    Ok(canonical)
}

/**
 * Converts URL percent escapes without pulling game loading into an extra Rust
 * dependency.
 */
fn decode_request_path(path: &str) -> String {
    let trimmed = path.trim_start_matches('/');
    let bytes = trimmed.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let Ok(value) = u8::from_str_radix(&trimmed[index + 1..index + 3], 16) {
                decoded.push(value);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&decoded).to_string()
}

/**
 * Reads and parses the package manifest JSON.
 */
fn read_manifest(path: &Path) -> Result<GameManifest, String> {
    let text = fs::read_to_string(path).map_err(|error| format!("cannot read {MANIFEST_FILE}: {error}"))?;
    serde_json::from_str(&text).map_err(|error| format!("cannot parse {MANIFEST_FILE}: {error}"))
}

/**
 * Writes a generated manifest in stable, readable JSON.
 */
fn write_manifest(path: &Path, manifest: &GameManifest) -> Result<(), String> {
    let text = serde_json::to_string_pretty(manifest)
        .map_err(|error| format!("cannot serialize {MANIFEST_FILE}: {error}"))?;
    fs::write(path, format!("{text}\n"))
        .map_err(|error| format!("cannot write {MANIFEST_FILE}: {error}"))
}

/**
 * Scans a loose package and creates the manifest shape consumed by JavaScript.
 */
fn scan_manifest(root: &Path, mode: &str) -> Result<GameManifest, String> {
    let mut files = BTreeMap::new();
    let mut pending = Vec::new();
    collect_files(root, root, &mut pending)?;
    for path in pending {
        let relative_path = normalize_package_path(&relative_path(root, &path)?);
        if should_ignore_package_path(&relative_path) {
            continue;
        }
        let metadata = fs::metadata(&path).map_err(|error| format!("cannot stat {}: {error}", path.display()))?;
        let kind = classify_package_file(&relative_path);
        let sha256 = if is_script_path(&relative_path) {
            Some(hash_file(&path)?)
        } else {
            None
        };
        files.insert(
            relative_path,
            ManifestFile {
                kind,
                size: metadata.len(),
                mtime: metadata_mtime(&metadata)?,
                sha256,
            },
        );
    }

    let paths_by_kind = |kind: &str, files: &BTreeMap<String, ManifestFile>| {
        files
            .iter()
            .filter_map(|(path, file)| (file.kind == kind).then(|| path.clone()))
            .collect::<Vec<_>>()
    };

    Ok(GameManifest {
        schema: MANIFEST_SCHEMA,
        mode: if mode == "release" { "release" } else { "dev" }.to_string(),
        game_id: "jiishii-game".to_string(),
        engine: EngineManifest {
            min_version: "0.1.0-alpha.0".to_string(),
        },
        entry: ManifestEntry {
            config: files.contains_key("game.config.js").then(|| "game.config.js".to_string()),
            characters: files.contains_key("characters.js").then(|| "characters.js".to_string()),
            sprite_animations: files
                .contains_key("sprite-animations.js")
                .then(|| "sprite-animations.js".to_string()),
            sprite_manifest: files
                .contains_key("sprite-manifest.json")
                .then(|| "sprite-manifest.json".to_string()),
            scenes: paths_by_kind("scene", &files),
            surface_modules: paths_by_kind("surfaceModule", &files),
            sprite_recipes: paths_by_kind("spriteRecipe", &files),
        },
        files,
    })
}

/**
 * Builds a flat list of files in a package tree.
 */
fn collect_files(root: &Path, dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|error| format!("cannot list {}: {error}", dir.display()))? {
        let entry = entry.map_err(|error| format!("cannot read directory entry: {error}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("cannot inspect {}: {error}", path.display()))?;
        if file_type.is_dir() {
            collect_files(root, &path, files)?;
        } else if file_type.is_file() {
            let relative = relative_path(root, &path)?;
            if !should_ignore_package_path(&relative) {
                files.push(path);
            }
        }
    }
    Ok(())
}

/**
 * Compares the manifest with live file metadata for fast startup checks.
 */
fn compare_manifest(root: &Path, manifest: &GameManifest) -> Result<ManifestStatus, String> {
    let mut changed = false;
    let mut warnings = Vec::new();
    for (relative_path, manifest_file) in &manifest.files {
        let path = root.join(normalize_package_path(relative_path));
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => {
                changed = true;
                warnings.push(format!("Missing package file: {relative_path}"));
                continue;
            }
        };
        let mtime = metadata_mtime(&metadata)?;
        if metadata.len() != manifest_file.size || mtime != manifest_file.mtime {
            changed = true;
            warnings.push(format!("Changed package file: {relative_path}"));
        }
    }

    if manifest.mode == "dev" {
        let scanned = scan_manifest(root, "dev")?;
        for path in scanned.files.keys() {
            if !manifest.files.contains_key(path) {
                changed = true;
                warnings.push(format!("New package file: {path}"));
            }
        }
    }

    Ok(ManifestStatus { changed, warnings })
}

struct ManifestStatus {
    changed: bool,
    warnings: Vec<String>,
}

/**
 * Gets a package-relative path with URL-style separators.
 */
fn relative_path(root: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|error| format!("cannot relativize {}: {error}", path.display()))?;
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

/**
 * Normalizes a package path to slash separators without leading slashes.
 */
fn normalize_package_path(path: &str) -> String {
    path.replace('\\', "/")
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_string()
}

/**
 * Returns true for template/private files that should not ship in manifests.
 */
fn should_ignore_package_path(relative_path: &str) -> bool {
    let normalized = normalize_package_path(relative_path);
    let filename = normalized.rsplit('/').next().unwrap_or("");
    let has_ignored_segment = normalized
        .split('/')
        .any(|segment| matches!(segment, ".git" | "node_modules") || segment.starts_with('_'));
    filename == MANIFEST_FILE
        || filename == ".gitkeep"
        || normalized == "assets.js"
        || normalized == "audio.js"
        || normalized == "sprites.js"
        || normalized == "scenes/index.js"
        || normalized == "surface-modules/index.js"
        || filename.ends_with(".example.js")
        || filename.ends_with(".test.js")
        || filename.ends_with(".spec.js")
        || filename.starts_with('_')
        || has_ignored_segment
        || filename.to_lowercase().ends_with("old.js")
        || filename.to_lowercase().ends_with("old.json")
}

/**
 * Classifies files with the same vocabulary as the frontend manifest helper.
 */
fn classify_package_file(relative_path: &str) -> String {
    let normalized = normalize_package_path(relative_path);
    let lower = normalized.to_lowercase();
    let extension = Path::new(&lower)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if normalized == "game.config.js" {
        "config"
    } else if normalized == "characters.js" {
        "characters"
    } else if normalized == "sprite-animations.js" {
        "spriteAnimations"
    } else if normalized == "sprite-manifest.json" {
        "spriteManifest"
    } else if normalized == "vn.js" {
        "authorApi"
    } else if lower.contains("/sprite.recipe.js") {
        "spriteRecipe"
    } else if lower.starts_with("scenes/") && is_script_extension(extension) {
        "scene"
    } else if lower.starts_with("surface-modules/") && is_script_extension(extension) {
        "surfaceModule"
    } else if lower.starts_with("assets/audio/") && is_audio_extension(extension) {
        "audio"
    } else if lower.starts_with("assets/sprites/") && extension == "png" {
        "sprite"
    } else if lower.starts_with("assets/") && is_image_extension(extension) {
        "image"
    } else if is_script_extension(extension) {
        "script"
    } else {
        "file"
    }
    .to_string()
}

fn is_script_path(relative_path: &str) -> bool {
    let extension = Path::new(relative_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    is_script_extension(extension)
}

fn is_script_extension(extension: &str) -> bool {
    matches!(extension, "js" | "mjs")
}

fn is_audio_extension(extension: &str) -> bool {
    matches!(extension, "mp3" | "ogg" | "wav" | "m4a" | "flac")
}

fn is_image_extension(extension: &str) -> bool {
    matches!(extension, "png" | "jpg" | "jpeg" | "webp" | "gif" | "avif" | "svg")
}

/**
 * Hashes executable author files for cache busting and change warnings.
 */
fn hash_file(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| format!("cannot hash {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 16 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("cannot read {}: {error}", path.display()))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/**
 * Converts filesystem modified time to epoch milliseconds.
 */
fn metadata_mtime(metadata: &fs::Metadata) -> Result<u128, String> {
    metadata
        .modified()
        .map_err(|error| format!("cannot read modified time: {error}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("modified time is before unix epoch: {error}"))
        .map(|duration| duration.as_millis())
}

/**
 * Maps common VN asset extensions to a browser content type.
 */
fn mime_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "m4a" => "audio/mp4",
        "flac" => "audio/flac",
        _ => "application/octet-stream",
    }
}

fn text_response(status: StatusCode, text: String) -> Response<Vec<u8>> {
    cors_response(status, text.into_bytes(), "text/plain; charset=utf-8")
}

fn cors_response(status: StatusCode, body: Vec<u8>, content_type: &'static str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-cache")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .body(body)
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_package_paths() {
        assert_eq!(normalize_package_path("./assets\\bg.png"), "assets/bg.png");
        assert_eq!(normalize_package_path("/scenes/start.js"), "scenes/start.js");
    }

    #[test]
    fn classifies_core_package_files() {
        assert_eq!(classify_package_file("game.config.js"), "config");
        assert_eq!(classify_package_file("scenes/start.js"), "scene");
        assert_eq!(classify_package_file("surface-modules/pinball.js"), "surfaceModule");
        assert_eq!(classify_package_file("assets/audio/music/theme.mp3"), "audio");
        assert_eq!(classify_package_file("assets/backgrounds/room.webp"), "image");
    }

    #[test]
    fn ignores_repository_scaffolding() {
        assert!(should_ignore_package_path("assets/backgrounds/.gitkeep"));
        assert!(should_ignore_package_path("node_modules/pkg/index.js"));
        assert!(should_ignore_package_path("_reference/story-notes.md"));
        assert!(should_ignore_package_path("assets/sprites/_default.recipe.js"));
        assert!(should_ignore_package_path("scenes/start.test.js"));
        assert!(should_ignore_package_path("scenes/index.js"));
        assert!(should_ignore_package_path("assets.js"));
        assert!(!should_ignore_package_path("scenes/start.js"));
    }

    #[test]
    fn blocks_unsafe_paths() {
        let root = PathBuf::from("C:/safe/game");
        assert!(scoped_package_file(&root, "../secret.txt").is_err());
    }
}
