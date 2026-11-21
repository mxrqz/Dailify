// The commands live in Kotlin: Tauri forwards an invoke no Rust handler takes to the Android
// plugin, after the ACL check that these names generate `allow-*` permissions for.
const COMMANDS: &[&str] = &["configure", "refresh", "clear", "status", "permit", "settings", "battery", "assistant"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
