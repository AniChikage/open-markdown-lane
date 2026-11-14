Open Markdown Lane 0.26.0 brings a more cohesive writing workspace, with a navigation ribbon, file tree and frosted sidebars.

This is an independent, unofficial project, unaffiliated with Typora. If you can afford it, please [buy Typora](https://store.typora.io/) and support its official developers.

## Changes

- A narrow left ribbon gives direct access to files, folder search, folder Q&A, plugins and preferences. The sidebar opens in file-tree view, with file-list and outline views still available.
- Compact tabs connect to the writing surface; the right dock keeps outline and AI review together. Light and dark palettes, spacing and heading sizes are coordinated across the workspace.
- Native macOS sidebar material blurs the content behind the window while keeping the document opaque. Windows and Linux use translucent surfaces over an opaque window background. Reduced-transparency and forced-color CSS fallbacks are included where supported.
- Fixed plugin-dialog keyboard focus: collapsed settings could contain a textarea that reported layout geometry but refused focus. Dialogs now fall back to a visible control, and Escape closes them reliably.
- Fixed English sidebar labels wrapping and file-tree selection backgrounds ending before the edge of the row.
- Selecting an already-open file in the tree now activates its existing tab immediately, retaining the in-memory draft and avoiding a disk-open race with the next mode or formatting command.
- Document themes, fonts, background images, model configuration, tab order and shared-view state keep their existing storage and behavior. Documents and settings are retained during upgrades.
- README product images now show the current English workspace, with light, dark and shared-view captures. The previous interface video and screenshots have been retired from the project pages.

## Downloads

- macOS 14+, Apple Silicon: DMG or ZIP.
- Windows 10/11 x64: Setup.exe or ZIP.
- Linux x64: DEB or x86_64 AppImage, plus its `.zsync` control file.

The six installers and the control file are covered by `SHA256SUMS.txt`. macOS is locally signed, not notarized; Windows is unsigned. macOS may request Documents-folder access again after an update.

## Validation

265 local unit tests passed, together with workspace, shared-view, composition, undo/redo, theme, background, context-menu, community-plugin and AI-review regressions. The native WebKit suite passed 163 editor checks and actual PDF/HTML export checks.

Publication is gated by macOS native tests, installed Windows/Linux acceptance, Everything preview and real FUSE mounts on Ubuntu 22.04/24.04. The public AppImageUpdate check runs after publication. See [the verification record](https://github.com/AniChikage/open-markdown-lane/blob/main/docs/verification.md) for the completed release gates and installed-app checks. Physical IME candidate-window acceptance was not repeated for this visual refresh; automated composition and exact undo tests were repeated.
