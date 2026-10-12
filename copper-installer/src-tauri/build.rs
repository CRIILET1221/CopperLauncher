fn main() {
    println!("cargo:rerun-if-changed=../payload.zip");
    tauri_build::build();
}
