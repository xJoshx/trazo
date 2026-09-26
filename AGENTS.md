# Agent instructions for AI Writer

Keep this file and the project decision documents current. When a change alters the interface, behavior, persistence, architecture, or scope, update the relevant part of `docs/Design.md`, `docs/architecture.md`, and `docs/roadmap.md` in the same work. Update `docs/MVP.md` when the MVP contract changes; keep `README.md` accurate for setup and verified checks.

Record user-tested corrections as decisions, with the reason and any remaining validation. Keep implemented behavior, planned work, and measured results distinct. When the documents disagree with the running source, reconcile them in the same change.

## Product direction

- The app opens directly into a trustworthy local Markdown draft. Fast capture, legible prose, reliable selection/undo, and data recovery take priority over adding features.
- iA Writer is the typography and interaction reference, especially for focus mode. Keep our own product identity. In focus mode the interface nearly disappears: only the sentence containing the caret stays clear, even across wrapped rows; other sentences recede, and controls stay reachable by keyboard and touch. A sentence ends at `.`, `!`, `?`, or its paragraph boundary.
- Use neutral paper and ink, generous margins, iA Writer Mono, and a visible cyan caret as source defaults. Glass belongs only on lightweight controls, never behind long prose where it weakens contrast.
- On Apple platforms, follow current Human Interface Guidelines and Liquid Glass guidance. Prefer native SwiftUI `glassEffect`, `GlassEffectContainer`, and glass button styles in a future native client, gate iOS 26 APIs with availability checks, and provide readable material fallbacks. Use large touch targets and patterns that feel at home on iOS.
- The Appearance workbench is a temporary review tool. Its changes must remain in memory only; the user copies its JSON into chat when they want source defaults changed.

## Architecture and data rules

- The Markdown source in CodeMirror is authoritative. The Rust core parses Markdown and emits UTF-16 ranges, safe preview HTML, tags, and counts through a worker. Do not add a second Markdown parser for app semantics.
- IndexedDB holds one active draft, recovery copies, and preferences. Preserve the revision conflict checks, explicit save status, and export path. Never sacrifice draft safety for decoration or performance work.
- Commit drafts promptly, but keep the visible save label steady through a typing burst. A delayed `Saved on this device` label is presentation only; import, replacement, and app updates must check the committed revision and error state directly.
- Hashtags are detected in Rust in ordinary text and styled in the editor. A linked tag index belongs with the future document-library schema; document its migration and transaction rules before implementing it.
- The performance panel measures locally. Label approximations and unsupported browser APIs honestly. Keep its sampling overhead low and avoid collecting or sending diary content.
- Keep source defaults in CSS and code. Generated WASM, build artifacts, and precache files are outputs of the build pipeline.

## Verification

- Run `cargo test -p writer-core`, `npm run check`, `npm test`, and `npm run build` for changes that touch the relevant layers.
- Verify editor, focus mode, metrics, and appearance changes in a production preview at desktop and phone widths. Use a separate localhost origin for test writing so the user's active draft remains untouched.
- Treat real iPhone/iPad keyboard behavior, Safari, accessibility, offline upgrade, and performance budgets as hands-on gates until measured. Record results in the roadmap rather than claiming them from desktop simulation.
