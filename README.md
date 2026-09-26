# Daymark Writer

A local-first Markdown diary PWA built from [the first-iteration plan](docs/MVP.md). It opens straight into one draft, saves on this device, and offers Write, Read, and wide-screen Split views.

## Run locally

The project pins Rust 1.87 and uses `wasm-bindgen-cli` 0.2.100.

```sh
rustup target add wasm32-unknown-unknown --toolchain 1.87.0
cargo +1.87.0 install wasm-bindgen-cli --version 0.2.100 --locked
npm install
npm run dev
```

Open the URL printed by Vite. `npm run dev` compiles the WASM core first. To test the installable production build:

```sh
npm run build
npx vite preview --host 127.0.0.1 --port 4173
```

The service worker works on localhost or HTTPS. An iPhone or iPad on the local network needs an HTTPS origin to test installation and offline reopening.

## What is included

- CodeMirror editor with parser-backed Markdown formatting, muted markers, a soft `==highlight==` background, visible italic emphasis, undo/redo, find, and bold/italic/link shortcuts.
- Rust `pulldown-cmark` analysis in a worker, safe reading preview, tags (including hyphenated names and slash-nested paths), word count, and immersive sentence focus. Focus mode hides the chrome and keeps only the caret's sentence clear, even when it wraps across rows; punctuation or a paragraph edge ends the sentence. It is available on phones; leave with Escape, Cmd/Ctrl-Shift-F, or the corner control.
- IndexedDB autosave with revision checks, recovery copies, and a visible save state.
- UTF-8 Markdown/text import and export, including CRLF and BOM round trips.
- Bundled iA Writer Mono fonts, system light/dark appearance, offline asset caching, and prompted updates.
- A local Performance panel and a temporary Appearance workbench for reviewing the writing feel and copying proposed settings.
- Rust-backed keyboard commands for file actions, focus, preview, search, formatting, headings, and lists. Open the shortcut reference with Cmd-/(Mac), Ctrl-? (other keyboards), the footer `?`, or Document actions.

Open Performance with the footer icon, Document actions, or Cmd/Ctrl-Shift-M. TTS means time to screen; TTI is the local editor-ready estimate. The panel shows frame rate, edit/analysis/save timing, available browser vitals, and production asset sizes. It measures locally and sends no draft text or metrics away.

Open Appearance from the footer `Aa` button or Document actions. Tune type, width, focus fade, theme, and colors for the paper, ink, controls, selection, caret, Markdown marks, and tags; color swatches show their exact hex values. **Copy settings** produces JSON to paste into chat for a source-code update. Workbench changes are temporary and disappear on reload; the normal theme menu still saves its preference.

The browser draft stays on this device. Export creates a separate Markdown copy; it does not update a source file or sync between devices. The footer keeps `Saving…` steady through a typing burst and confirms `Saved on this device` after the latest commit and a pause. If storage fails, the editor retains the text and offers export.

## Checks

```sh
cargo test -p writer-core
npm run check
npm test
npm run build
npm run test:performance
```

The performance command needs Google Chrome installed. It builds the production app, starts an isolated preview at `127.0.0.1:4187`, and runs Playwright in a fresh browser context. It saves and reloads a 10,000-word draft, types into it, checks the Performance panel and the production build's raw/gzip asset totals against the limits in `tests/performance/writing.pw.ts`, and prints numeric readings without draft content. The screenshot values from 26 September 2026 are recorded there; the browser limits are wider because this workload and host may differ. The asset limits allow about 10% growth from that day's build. This smoke test does not certify the real-device MVP targets or actual transferred bytes.

The automated checks also cover Unicode ranges, Markdown preview restrictions, and file encoding. Browser checks confirmed reload persistence, Read/Split, import, recovery, stale-tab conflicts, offline reopening, and a production-build update with a saved draft. The real iPhone/iPad keyboard, Safari, 200% zoom, screen readers, download behavior in all browsers, and the plan's latency targets still need hands-on validation.

The production build writes `dist/build-metrics.json` for the panel. Its gzip total is an estimate for compiled assets and bundled fonts/icons; the plan's transferred-byte budget still needs a measured network run.

Project decisions live in [Design](docs/Design.md), [architecture](docs/architecture.md), and [roadmap](docs/roadmap.md). [AGENTS.md](AGENTS.md) tells future agents to keep them current.

Typography diagnostic: 8/10. Body size, measure, leading, hierarchy, font payload, fallbacks, heading wraps, and link distinction are implemented. Real phone rendering and 200% zoom are unverified.
