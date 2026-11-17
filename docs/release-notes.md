Open Markdown Lane 0.26.3 fixes clipped file-sidebar menus reported in [#19](https://github.com/AniChikage/open-markdown-lane/issues/19).

This is an independent, unofficial project, unaffiliated with Typora. If you can afford it, please [buy Typora](https://store.typora.io/) and support its official developers.

## Fixes

- File-tree right-click and folder “…” menus now open above the workspace, outside the frosted sidebar's clipping boundary. Menu items remain visible and clickable on Windows and Linux.
- Position menus using their actual dimensions. In short windows, the complete menu can scroll within the viewport.
- Keep sorting controls usable while the menu is open. Escape returns focus to the trigger; outside clicks, external scrolling and window resizing dismiss the menu.

## Downloads

- macOS 14+, Apple Silicon: DMG or ZIP.
- Windows 10/11 x64: Setup.exe or ZIP.
- Linux x64: DEB or x86_64 AppImage, plus its `.zsync` control file.

The six installers and the control file are covered by `SHA256SUMS.txt`. macOS is locally signed, not notarized; Windows is unsigned. Existing documents, settings and storage formats are preserved.

## Validation

The regression checks actual pointer hit targets beyond the sidebar edge, file actions, persisted sort controls, compact windows, scrolling, Escape focus and light/dark themes. It runs against the Windows installation and both Linux packaged payloads. Existing editor, composition, undo/redo, plugin and recovery suites remain release gates. See [the verification record](https://github.com/AniChikage/open-markdown-lane/blob/main/docs/verification.md) for results and scope.

Strict checks, the production build and all 265 unit tests passed. The sidebar regression passed against the Windows installation, Linux DEB and AppImage payloads, with compact-window and real pointer-hit checks. The macOS native editor passed 163 checks; installed save, shared-view undo/redo and restart recovery were verified with exact file bytes.

[All eight release jobs passed](https://github.com/AniChikage/open-markdown-lane/actions/runs/44032746178), including Everything preview, actual Ubuntu 22.04/24.04 FUSE mounts and the public AppImage update from 0.26.2. All published installers and the update control file were downloaded and checksum-verified. The local Mac installation is updated; document and settings fingerprints and 34 pre-existing history files are unchanged. The superseded 0.26.2 Release and local installer copies were removed; source tags and history remain. Physical IME candidate windows and external models were not manually retested in this patch.
