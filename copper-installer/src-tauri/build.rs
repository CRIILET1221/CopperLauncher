fn main() {
    println!("cargo:rerun-if-changed=../payload.zip");
    println!("cargo:rerun-if-env-changed=COPPER_LAUNCHER_VERSION");
    tauri_build::build();
}
