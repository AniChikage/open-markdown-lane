Open Markdown Lane 0.25.0 adds shared document views and bounded background editors.

This is an independent, unofficial project, unaffiliated with Typora. If you can afford it, please [buy Typora](https://store.typora.io/) and support its official developers.

## Changes

- **View → Split this document** opens the same Markdown in live/source or two rendered views. Both panes share edits, save state and undo/redo; carets, modes and scroll positions remain independent. Existing two-document splits are still available.
- Preserve legacy initial caret placement when a session has no view metadata; a new twin starts at the current document location.
- Restore both views, their modes/positions, active pane and geometry with unsaved text after a normal restart. Close either pane without closing the document. Scrolling is independent, not synchronized.
- Closing a shared document clears its split without rearranging unrelated tabs.
- Release background editor DOM using a bounded warm cache and idle expiry. Keep text and session undo/redo, and protect pending image imports and batch operations from eviction. Memory use still depends on document text, history and resources.
- Mirror source updates as changed spans instead of replacing the entire CodeMirror document for each edit. Guard pane switches, layout changes and commands during composition.
- Fixed a macOS recovery race: an earlier session snapshot could retire a newly registered document before the editor adopted it. Recovery now distinguishes acknowledged tabs from newly opened files, with explicit close hints for tabs closed before their first snapshot.
- Existing documents, model configuration, themes and preferences remain in their current storage locations. Step-by-step undo survives view eviction, not application restart; use version history across sessions.

## Downloads

- macOS 14+, Apple Silicon: DMG or ZIP.
- Windows 10/11 x64: Setup.exe or ZIP.
- Linux x64: DEB or x86_64 AppImage, plus its `.zsync` control file.

The six installers and the control file are covered by `SHA256SUMS.txt`. macOS is locally signed, not notarized; Windows is unsigned. macOS may request Documents-folder access again after an update.

## Validation

New installed-editor and native WebKit acceptance covers shared views, Chinese composition guards, opposite-pane undo/redo, background eviction and recovery. Existing issue regressions, large code/table editing, AI review, clipboard, plugins and Ubuntu 22.04/24.04 real FUSE gates remain required. See [versioned verification](verification.md) for actual results and remaining manual checks.
