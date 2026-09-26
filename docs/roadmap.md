# Roadmap

Updated 26 September 2026. Work is ordered by the user's ability to trust and tune the writing experience. See [MVP](MVP.md) for acceptance gates and [architecture](architecture.md) for current decisions.

## Built for first review

- One local Markdown draft with autosave, recovery copies, import/export, safe Read/Split preview, and offline PWA assets.
- iA Writer Mono writing canvas, sentence focus on desktop and phone, neutral light/dark surfaces, and a visible 3px cyan caret with a brighter dark-theme default.
- Rust tag detection, including hyphenated names and slash-nested paths, with distinct editor styling that preserves Markdown text.
- Parser-backed muted Markdown punctuation, visible italic emphasis, `==highlight==` background styling, restrained editorial preview headings, and stable sentence focus during live edits and soft wrapping.
- A local Performance panel with startup, live input/frame/analysis/save, browser vital, memory, and build asset readings.
- A temporary Appearance workbench with separate Writing and Reading preview controls, Substack and Bookish presets, a live CSS source preview, copyable CSS and JSON, and exact hex values beside color swatches.
- A stable save indicator that stays in the saving state during a typing burst and confirms the committed revision after a pause.
- A production-preview Playwright performance smoke test for a 10,000-word draft, with screenshot-reference regression limits, production asset-size caps, and a local numeric report.
- A Rust-owned shortcut catalog and Markdown edit commands, with iA Writer for Mac and Omawrite inspired bindings, plus a consultable in-app keyboard shortcut modal.

The 26 September 2026 headless Chrome check on this Mac passed three consecutive runs with the final limits: 60 fps on a roughly 60 Hz rAF clock, edit p95 15–16 ms, analysis p95 15–16 ms, save p95 16–17 ms, zero slow frames and long tasks, and 9.72–23.44 MiB JS heap. One earlier run reported a 328 ms INP estimate; the three final repeats reported 40–80 ms. The smoke limit for that browser estimate is 400 ms to accommodate the observed variation. These numbers are local automated results, not the pending iPhone/iPad or Safari measurements.

The size-gated production run measured 833,810 raw and 407,417 gzip bytes in `build-metrics.json`, both below the 920,000/450,000-byte smoke limits. These are estimated asset totals, not measured network transfer.

The shortcut update passed 10 Rust core tests, Svelte/type checks, six existing web tests, and a production build. An isolated localhost production preview in headless Chrome exercised the modal, bold, and focus at 1280px and 390px widths; Mac heading, preview, replace, and help bindings also passed. These automated checks do not validate real Safari keyboard interception or non-US layouts.

## Next: hands-on MVP validation

1. Write and export a full diary entry on an iPhone or iPad. Check keyboard avoidance, caret visibility, focus exit, selection handles, undo, IME, and the appearance sheet.
2. Reopen the installed PWA offline and after a production-build update. Confirm the draft and fonts survive, and that save status remains truthful.
3. Check VoiceOver, 200% zoom, contrast, reduced motion, and touch targets in both themes.
4. Record actual transferred bytes, cold/warm editor readiness, p95 input latency, worker freshness, frame cadence, and memory on named devices. Compare them with the [MVP targets](MVP.md#validation-and-budgets). The headless Chrome smoke test is an automated regression gate, not this hardware result.
5. Use the Appearance workbench during real writing, paste the chosen JSON into chat, then update source tokens and this design record.
6. Repeat the 26 September zen-mode writing case on the target devices; confirm only the caret's sentence stays crisp, including when two sentences share a row or one sentence wraps, during typing and IME composition.
7. Check shortcut interception and the modal with hardware keyboards in Safari, especially browser-reserved combinations, non-US layouts, VoiceOver, and 200% zoom.

## Next product slice: documents and linked tags

The current IndexedDB schema has one active draft. Before a persistent tag index, decide what a document library, rename, archive, restore, and deletion mean. Then add Rust tag occurrences with normalized names and source ranges; add a versioned IndexedDB tag index linked to document IDs and source revisions; update it transactionally with saved documents; and provide a simple tag browse/filter view. Include tests for Unicode tags, code/link exclusions, duplicates, import, restore, stale analysis, and multi-tab conflicts.

The visible hashtag styling is already in the MVP. A linked tag database is planned rather than quietly attached to the one-draft schema.

## Later, guided by use

- More linguistic sentence boundaries for abbreviations, continuous typewriter scrolling, and marker hiding.
- Synchronized preview scrolling and richer editorial preview refinements.
- Document library, cross-document search, and optional sync only after local durability and privacy behavior are specified.
- Native Apple interface using current Human Interface Guidelines and availability-gated SwiftUI Liquid Glass controls.
- Any AI writing assistance only after the user defines its privacy, control, and offline expectations.
