Open Markdown Lane 0.24.6 adds easier font and content-width settings ([#18](https://github.com/AniChikage/open-markdown-lane/issues/18)).

This is an independent, unofficial project, unaffiliated with Typora. If you can afford it, please [buy Typora](https://store.typora.io/) and support its official developers.

## Changes

- **Preferences → Fonts & Layout** exposes separate body and code font fields without expanding advanced CSS. Choose a suggestion or enter a locally installed font family/fallback list; empty fields use the theme default. Suggestions do not install or download fonts.
- Maximum content width supports **px or %**. Percentage widths follow each editor pane in live/source mode and split view. Both values are remembered, and existing pixel settings retain their meaning.
- Font and layout choices remain separate for each theme, persist across restarts and are included in CSS export. Reset restores the current theme defaults.
- Existing editing, undo/redo, document recovery, language preferences and AppImage update support remain available.

## Downloads

- macOS 14+, Apple Silicon: DMG or ZIP.
- Windows 10/11 x64: Setup.exe or ZIP.
- Linux x64: DEB or x86_64 AppImage, plus its `.zsync` control file.

The six installers and the control file are covered by `SHA256SUMS.txt`. macOS is locally signed, not notarized; Windows is unsigned. macOS may request Documents-folder access again after an update.

## Validation

Release gates exercise actual font styles for body/inline/fenced/large-code editing, percentage geometry in live/source/split/narrow layouts, legacy settings, restart, theme switching/reset, CSS export and exact save/undo/redo. macOS native WebKit has its own focused acceptance. Existing installed-editor, issue regressions and Ubuntu 22.04/24.04 real FUSE checks also run. The post-publication AppImageUpdate job uses the previous public image's embedded channel when available.
