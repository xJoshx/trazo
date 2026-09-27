# Design direction

Updated 26 September 2026. This document records the current interface decisions and the details to tune after hands-on writing. The [MVP](MVP.md) defines the first-iteration scope; [architecture](architecture.md) records implementation decisions.

## Experience

Trazo opens directly into the current Markdown draft. Writing is the primary view. Reading preview and wide-screen Split are available without replacing the editor or moving the caret. The interface borrows iA Writer's calm measure, mono typography, and focus behavior while retaining Trazo's own name and controls.

The user chose Trazo as the product and repository name on 27 September 2026. The web title, in-app wordmark, and install name use Trazo; the existing icon remains a provisional mark pending visual review. This naming decision does not decide whether the project will be open source.

The canvas uses opaque paper with neutral ink. Controls are compact and quiet in normal writing; they are easy to tap, have accessible names and focus rings, and do not compete with the document. On Apple platforms, use the Human Interface Guidelines and current Liquid Glass guidance. A future native client should use native SwiftUI glass APIs for controls with availability checks and readable material fallbacks. Long prose remains on an opaque surface.

The save indicator is quiet during writing. It shows `Saving…` throughout a typing burst and returns to `Saved on this device` only after the latest commit and a short pause. Its reserved width keeps the footer from shifting. A failure or conflict appears immediately and remains actionable.

## Source defaults

| Element | Light | Dark | Reason |
| --- | --- | --- | --- |
| Paper | `#fbfbfb` | `#1b1b1b` | Low-noise writing surface |
| Ink | `#202020` | `#ececec` | Strong active-text contrast |
| Muted | `#777` | `#aaa` | Secondary chrome |
| Caret | `#00bce8`, 3px | `#35d8ff`, 3px | High visibility in both themes; color and width adjustable in workbench |
| Tags | teal text on pale cyan | pale cyan on deep teal | Tags like `#work-in-progress` and nested `#work/projects` read as metadata without becoming buttons |
| Emphasis | `#505050` | `#c4c4c4` | Italic words remain distinct in iA Writer Mono |
| Highlight fill | `#f2df8a` | `#514728` | The background includes the visible `==` delimiters; text keeps normal ink |
| Markdown markers | `#969696` | `#858585` | Punctuation stays visible but recedes behind the words |

The editor uses bundled iA Writer Mono at 20px on desktop and 18px on narrow screens, 1.6 line height, and a maximum 74ch writing column. Headings gain weight; emphasis is italic and uses a darker neutral tone in light mode (a lighter counterpart in dark mode). `==text==` keeps the current text color and adds a quiet, rounded background fill across the text and visible delimiters. Other Markdown delimiters are muted without changing cursor geometry. Links stay the ink color with a quiet underline, and inline code gets a faint tint. Read view starts with a Substack-inspired article treatment: a large sans-serif title, 21px serif body, generous line spacing, and an approximately 820px article column. A separate Bookish preset offers a narrower and slightly smaller reading surface. Both presets can be fine-tuned independently from writing typography and colors. Normal writing starts with generous top space. Browser zoom and the platform font fallback remain available.

## Focus mode

Focus mode is the clearest expression of the design. It removes the toolbar, footer, and scrollbar from the writing canvas. Only the sentence containing the caret stays fully legible; other sentences fade to 24% opacity, even when they share a visible row. The active sentence remains clear across soft wraps. A sentence starts after the preceding `.`, `!`, or `?`, or at its paragraph boundary, and runs to the next sentence mark or paragraph end. An adjacent heading stays dim while typing in prose. The caret is moved near the viewport center on entry and when navigating between sentences. The whole document stays accessible to assistive technology. Errors that require action remain visible.

On desktop and phone, focus mode has a subtle 44px corner exit control. Escape, Cmd/Ctrl-D, and the existing Cmd/Ctrl-Shift-F also exit. Focus mode begins from Write, including when invoked from another view. Continuous typewriter scrolling during typing, richer linguistic handling of abbreviations, and marker hiding are later refinements.

## Keyboard commands

The shortcut reference opens from the footer `?`, Document actions, Cmd-/ on Mac, or Ctrl-? on other keyboards. It is a native modal dialog with Escape dismissal and shows the bindings for the current platform. The list contains only commands Trazo implements. Mac bindings follow the applicable [iA Writer shortcut guide](https://ia.net/writer/support/basics/shortcuts?platform=mac); the cross-platform set adopts [Omawrite's documented keys](https://github.com/omacom/omawrite/blob/master/README.md#shortcuts) for file, search, undo, and Markdown formatting where possible. Commands for iA Writer's library, multiple windows, printing, and other absent features are outside the current one-draft product. Keep the help list generated from the command catalog so it cannot drift from dispatch.

## Review tools

The Performance panel opens from the footer, document menu, or Cmd/Ctrl-Shift-M. It samples frame cadence while open and shows edit-to-frame p95, Rust worker turnaround, local save p95, long tasks, available web vitals, JS heap where supported, and a production build asset breakdown. TTS means time to screen. TTI is the local editor-ready estimate. It sends no content or measurements away.

The 26 September 2026 panel screenshot is the first visual reference for a browser performance smoke test. The test uses a 10,000-word draft and wider machine-independent limits, plus a size limit for the production assets reported by the panel, rather than presenting its readings as a real-device certification. Its measured values stay in test output; the panel remains a local review tool.

The Appearance workbench opens from the footer or document menu. Writing controls tune theme, typeface, text size, line height, width, focus fade, caret width, and source colors. Separate Reading preview controls select the Substack or Bookish preset and tune body typeface, size, line height, article width, title size, and reading colors. Color controls show their exact hex values beside the swatches. A generated CSS block updates live with the preview and can be copied into `apps/web/src/style.css` to make those values the source defaults. The workbench itself does not write to source files or persist changes. Reload discards the experiment; Reset to source removes all temporary overrides immediately.

Both review tools stay closed by default. On wide screens they reserve room beside the document. On phones they become bottom sheets with independent scrolling. The writing canvas remains the default when they close.

## Interaction and accessibility checks

- Verify the 3px caret and its selected color against both themes and focus mode.
- Verify typing, selection, search, undo, IME composition, and keyboard escape while a review panel is open.
- Confirm the mobile keyboard does not cover the caret or trap a bottom sheet on real iPhone/iPad hardware.
- Check contrast, 200% zoom, VoiceOver, reduced motion, and the visible error path.
- Tune the defaults from real diary use. Copy a workbench JSON object into chat to make approved values permanent.
