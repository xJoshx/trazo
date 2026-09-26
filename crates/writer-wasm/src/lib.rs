use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn analyze(markdown: &str, preview_requested: bool) -> String {
    serde_json::to_string(&writer_core::analyze(markdown, preview_requested))
        .expect("analysis is serializable")
}

#[wasm_bindgen]
pub fn shortcut_catalog() -> String {
    serde_json::to_string(writer_core::shortcuts::SHORTCUTS).expect("shortcuts are serializable")
}

#[wasm_bindgen]
pub fn resolve_shortcut(key: &str, control: bool, alt: bool, shift: bool, meta: bool, mac: bool) -> String {
    writer_core::shortcuts::resolve(key, control, alt, shift, meta, mac).unwrap_or("").to_string()
}

#[wasm_bindgen]
pub fn shortcut_edit(source: &str, from: usize, to: usize, command: &str) -> String {
    serde_json::to_string(&writer_core::shortcuts::edit(source, from, to, command)).expect("edit is serializable")
}
