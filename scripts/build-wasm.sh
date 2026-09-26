#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --release --target wasm32-unknown-unknown -p writer-wasm
mkdir -p apps/web/src/generated
wasm-bindgen --target web --out-dir apps/web/src/generated target/wasm32-unknown-unknown/release/writer_wasm.wasm
