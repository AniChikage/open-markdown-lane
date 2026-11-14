# Open Markdown Lane 品牌标记

唯一矢量源是 [icon.svg](icon.svg)。定制衬线字母 M 对应 Markdown，双侧竖画和中间斜画构成清晰、稳定的轮廓。墨蓝主体与一小段灰蓝顶边置于纸白底座，不加入文档折角或小尺寸细节。

- 纸白 `#ffffff`、底座阴影色 `#edf1f5`。
- 墨蓝 `#35465e` / `#1d2a3e`、顶边灰蓝 `#6d8cae`。
- 1024 方形画布，底座四周留 64 单位；标记居中，以实际 16/32/64/128 像素检查识别度。
- 应用图标和“关于”窗口共用这份源文件。`scripts/icon.mts` 生成 PNG、Windows ICO 与 macOS ICNS，不再单独绘制一份标记。

README 展示图由 `presentation/hero.html` 排版，使用 `docs/images/workspace-light.png` 的完整实机界面截图，不重绘、翻译或裁去应用控件。浅色、深色与同文档双视图截图均来自 0.26.0 的隔离桌面验收配置，内容为自有英文示例，不包含用户文档、路径、密钥或配置。截图展示共享前端在 macOS Electron 验收宿主中的实际界面；原生版的背景材质由 AppKit 提供，透明度会随系统设置与窗口背后的内容改变。

三张原始界面图均为实际 2 倍像素截图（2880 × 1960），展示图排版输出为 1800 × 1400，避免将低分辨率截图放大。产品图统一使用英文，中英文 README 共用 `docs/images/hero.png`。应用本身支持英文、简体中文及跟随系统语言。

DMG 安装背景源文件为 `dmg-background.svg`；`scripts/package-dmg.mts` 生成 1×/2× 背景和 Finder 图标布局，将已经签名的原生应用封装为拖拽安装磁盘。
