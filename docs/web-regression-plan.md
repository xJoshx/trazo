# Tests needed for Rust migration

27 September 2026. **Scope decision: plan and implement only the tests needed for the Rust extraction and the new Mac app.** The full testing strategy will be developed incrementally; it is not a prerequisite to starting the migration.

## First step

Identify all code that will move into the Rust library and write focused tests for its current behavior, both at the library/function level and through the affected web UI, before moving it. Use Vitest for existing TypeScript behavior, Rust tests for the extracted logic, and Playwright for the relevant web editor interactions with the real WASM build.

For each extraction, keep the same expected results before and after the move. Cover the affected text, Unicode ranges, selection/undo, focus, file content or save behavior as applicable. Add Swift integration checks when the Mac app starts consuming that functionality. Existing project verification requirements still apply.

Specify the concrete cases alongside each extraction rather than designing a comprehensive suite up front. The immediate goal is to preserve the working web experience while building the shared core and Mac app.

## Later

Expand the broader testing strategy bit by bit as features and risks become concrete. A full screenshot matrix, general browser coverage, new test infrastructure, and unrelated regression suites are not initial migration prerequisites. Existing release and hands-on validation gates remain in effect.

Phase 0 now records the extraction inventory and implements baseline tests for the first file-codec and sentence-focus candidates. `apps/web/src/files.test.ts` and `focus.test.ts` cover their current function behavior; `tests/migration/web-baseline.pw.ts` covers the affected production web editor and import/export path through the real WASM build on isolated port 4188. Run `npm run test:migration` for the build plus browser checks. The current mixed-ending export normalization is a recorded compatibility behavior, not byte-perfect preservation. The remaining command, save, bridge, and native cases are specified alongside their extraction phases in the [macOS implementation plan](macOS-plan.md).
