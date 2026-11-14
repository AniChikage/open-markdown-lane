Open Markdown Lane 0.26.2 adds native Liquid Glass on macOS 26 while keeping macOS 14/15 compatible.

This is an independent, unofficial project, unaffiliated with Typora. If you can afford it, please [buy Typora](https://store.typora.io/) and support its official developers.

![Native macOS 26 glass over an owned neutral test background](https://raw.githubusercontent.com/AniChikage/open-markdown-lane/v0.26.2/docs/images/workspace-dark.png)

## Changes

- Use the standard native glass container on macOS 26 and later, with a lighter 8% sidebar tint. The writing surface stays opaque, and the glass follows the document's light or dark theme.
- Retain the existing compatible material on macOS 14/15. The minimum macOS requirement remains 14; Windows and Linux keep opaque desktop fallbacks.
- Preserve reduced-transparency and forced-color styles, document themes, background images and existing storage formats.

## Downloads

- macOS 14+, Apple Silicon: DMG or ZIP.
- Windows 10/11 x64: Setup.exe or ZIP.
- Linux x64: DEB or x86_64 AppImage, plus its `.zsync` control file.

The six installers and the control file are covered by `SHA256SUMS.txt`. macOS is locally signed, not notarized; Windows is unsigned.

## Validation

Local build, strict checks and 265 unit tests passed. Native window checks exercise both glass and legacy containers, resizing, title-bar dragging and system-button regions. Actual display-compositor captures use the production editor over an owned neutral patterned background, restricted to the test window's rectangle. Physical IME candidate-window acceptance has not been repeated.

Publication is gated by three-platform installation and editor regressions, Everything preview and real Ubuntu FUSE mounts. Public AppImageUpdate and verified old-release cleanup follow publication. See [the verification record](https://github.com/AniChikage/open-markdown-lane/blob/main/docs/verification.md) for the final scope and results.
