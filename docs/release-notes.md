Open Markdown Lane 0.25.0 adds shared document views and bounded background editors.

This is an independent, unofficial project, unaffiliated with Typora. If you can afford it, please [buy Typora](https://store.typora.io/) and support its official developers.

## Changes

- **View → Split this document** opens the same Markdown in live/source or two rendered views. Both panes share edits, save state and undo/redo; carets, modes and scroll positions remain independent. Existing two-document splits are still available.
- Preserve legacy initial caret placement when a session has no view metadata; a new twin starts at the current document location.
- Restore both views, their modes/positions, active pane and geometry with unsaved text after a normal restart. Close either pane without closing the document. Scrolling is independent, not synchronized.
- Closing a shared document clears its split without rearranging unrelated tabs.
- Release background editor DOM using a bounded warm cache and idle expiry. Keep text and session undo/redo, and protect pending image imports and batch operations from eviction. Memory use still depends on document text, history and resources.
- Share one idle recovery snapshot for text and view changes to reduce background work on large files.
- Mirror source updates as changed spans instead of replacing the entire CodeMirror document for each edit. Guard pane switches, layout changes and commands during composition.
- Fixed a macOS recovery race: an earlier session snapshot could retire a newly registered document before the editor adopted it. Recovery now distinguishes acknowledged tabs from newly opened files, with explicit close hints for tabs closed before their first snapshot.
- Existing documents, model configuration, themes and preferences remain in their current storage locations. Step-by-step undo survives view eviction, not application restart; use version history across sessions.

## Downloads

- macOS 14+, Apple Silicon: DMG or ZIP.
- Windows 10/11 x64: Setup.exe or ZIP.
- Linux x64: DEB or x86_64 AppImage, plus its `.zsync` control file.

The six installers and the control file are covered by `SHA256SUMS.txt`. macOS is locally signed, not notarized; Windows is unsigned. macOS may request Documents-folder access again after an update.

## Validation

265 unit tests passed. Release gates passed for macOS native WebKit, installed Windows/Linux apps, Everything preview and real FUSE mounts on Ubuntu 22.04/24.04. The public AppImageUpdate channel and all installer checksums were verified.

The user checked Sogou Pinyin in the preview; final builds repeat automated composition tests. See [versioned verification](https://github.com/AniChikage/open-markdown-lane/blob/main/docs/verification.md) for the scope and remaining manual coverage.
