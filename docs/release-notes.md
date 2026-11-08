Open Markdown Lane 0.24.5 improves AppImage naming and standard update support.

This is an independent, unofficial project, unaffiliated with Typora. If you can afford it, please [buy Typora](https://store.typora.io/) and support its official developers.

## Changes

- Linux AppImage files now use `Open-Markdown-Lane-VERSION-x86_64.AppImage`. DEB, Windows and macOS package naming stays the same.
- The AppImage embeds a standard `gh-releases-zsync` update channel pointing to stable GitHub releases. A matching `.AppImage.zsync` control file is published and covered by `SHA256SUMS.txt`.
- Use AppImageUpdate or `appimageupdatetool` to check and install updates. With `--remove-old`, the upstream tool removes the previous AppImage after validating its replacement. Existing documents, recovery data and settings stay in their data directories.
- Standard embedded update discovery starts with 0.24.5. Older AppImages need a manual first upgrade, or the upstream tool's explicit update-information override.
- English/system-language behavior and the existing editing, recovery and plugin features are retained.

## Downloads

- macOS 14+, Apple Silicon: DMG or ZIP.
- Windows 10/11 x64: Setup.exe or ZIP.
- Linux x64: DEB or x86_64 AppImage, plus its `.zsync` control file.

The six installers and the control file are covered by `SHA256SUMS.txt`. macOS is locally signed, not notarized; Windows is unsigned. macOS may request Documents-folder access again after an update.

## Validation

Release gates check the actual runtime's embedded update information, zsync integrity, real upstream delta updates, unchanged-block reuse, no-update detection and checksum-failure retention. Existing installed-editor and Ubuntu 22.04/24.04 real FUSE acceptance also run. After publication, a separate job checks the public GitHub update channel against the actual released files.
