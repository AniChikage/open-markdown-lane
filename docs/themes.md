# Customizing themes

Open **Preferences → Fonts & Layout** (中文：偏好设置 → 字体与正文布局). Body and code fonts and maximum content width are visible here without expanding advanced settings. Changes preview immediately and are saved separately for each theme, including installed CSS themes.

Choose a suggested **Text font** or **Code font**, or type a locally installed family such as `Georgia, serif` or `"JetBrains Mono", monospace`. These are font-family names or fallback lists, not CSS declarations. Suggestions do not download fonts; unavailable fonts use a system fallback. Empty fields follow the theme. The code setting applies to inline code and fenced blocks, including their active editor and large-code preview.

Set **Maximum content width** and **Width unit** to pixels (480–1,600 px) or percentages (20–100%). Percentages use each editor pane's available width in live and source mode, so they adapt to resizing, sidebars and split view. Switching units remembers both values; older saved widths retain their pixel meaning. These controls affect the editing layout; printed output continues to follow its paper size and margins.

Expand **Customize current theme** (自定义当前主题) for line height (1.2–2.5), paragraph spacing (0–40 px), accent, paper and text colors, custom CSS and print CSS. Empty color values follow the selected theme. Background-image settings remain separate and are excluded from exports.

## CSS

Use **自定义 CSS** for styles shared by the editor and exported document. Public targets include `.rich-document` (live editor), `.source-surface` (source editor) and `.print-document` (HTML/PDF). Theme variables include `--document-font`, `--code-font`, `--document-width`, `--document-line-height`, `--paragraph-spacing`, `--accent`, `--paper` and `--ink`.

```css
.rich-document h2, .print-document h2 { color: #376a86; }
.rich-document blockquote, .print-document blockquote {
  border-left: 3px solid var(--accent);
}
```

Use **打印专用 CSS** for output-only rules, without an outer `@media print` wrapper:

```css
.print-document h2 { break-before: page; }
.print-document figure { break-inside: avoid; }
```

**导出当前主题 CSS…** combines the selected theme, visual settings and custom CSS; print-only rules are wrapped in `@media print`. Reimport the exported file with the CSS theme picker to share it. Local fonts/images should be imported with a theme so assets are embedded; arbitrary filesystem URLs in typed CSS are not automatically packaged.

**恢复当前主题默认值** resets only the selected theme's custom settings. Advanced and print CSS each have a 100,000-character limit. Imported/exported self-contained themes are limited to 32 MiB, including embedded data; separately loaded font/image assets have a 20 MiB budget. Third-party themes can hardcode conflicting styles; compatibility is partial and selector-specific overrides may be needed. Settings are local to this application profile, not stored in Markdown files or synchronized across devices.
