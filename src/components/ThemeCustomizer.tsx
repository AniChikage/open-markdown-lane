import { t } from "../i18n";
import { useId, useState } from 'react';
import type { ThemeCustomization } from '../themeCustomization';
import { customizationDefaults } from '../themeCustomization';
export function ThemeCustomizer({ value, change, reset, save }: { value: ThemeCustomization; change(value: ThemeCustomization): void; reset(): void; save(): Promise<void> }) {
  const [expanded, setExpanded] = useState(false), [error, setError] = useState('');
  const fontsId = useId(), codeFontsId = useId();
  const percent = value.contentWidthUnit === '%';
  return <div className="theme-customizer">
    <fieldset><legend>{t("字体与正文布局")}</legend>
      <p className="dialog-note">{t("设置保存在当前主题中，即时生效。可选择建议字体，或输入本机已安装的字体名称；留空则跟随主题。未安装的字体会使用系统后备字体。")}</p>
      <div className="form-grid">
        <label>{t("正文字体")}<input aria-label={t("主题正文字体")} list={fontsId} placeholder={t("跟随主题")} value={value.fontFamily} maxLength={200} onChange={event => change({ ...value, fontFamily: event.target.value })}/></label>
        <label>{t("代码字体")}<input aria-label={t("主题代码字体")} list={codeFontsId} placeholder={t("跟随主题")} value={value.codeFontFamily} maxLength={200} onChange={event => change({ ...value, codeFontFamily: event.target.value })}/></label>
        <label>{t("正文最大宽度")}<input aria-label={t("主题正文宽度")} type="number" min={percent ? 20 : 480} max={percent ? 100 : 1600} step={percent ? 1 : 20} value={percent ? value.contentWidthPercent : value.contentWidth} onChange={event => { const n=Number(event.target.value); if(n >= (percent ? 20 : 480) && n <= (percent ? 100 : 1600)) change({...value, [percent ? 'contentWidthPercent' : 'contentWidth']:n}); }}/></label>
        <label>{t("宽度单位")}<select aria-label={t("正文宽度单位")} value={value.contentWidthUnit} onChange={event => change({...value,contentWidthUnit:event.target.value === '%' ? '%' : 'px'})}><option value="px">{t("像素（px）")}</option><option value="%">{t("百分比（%）")}</option></select></label>
      </div>
      <datalist id={fontsId}>{['"Open Sans", sans-serif', 'system-ui, sans-serif', 'Georgia, serif', '"Times New Roman", serif', '"PingFang SC", sans-serif', '"Microsoft YaHei", sans-serif', '"Noto Sans CJK SC", sans-serif', '"Songti SC", serif'].map(font => <option key={font} value={font}/>)}</datalist>
      <datalist id={codeFontsId}>{['Menlo, monospace', 'Consolas, monospace', '"Cascadia Code", monospace', '"JetBrains Mono", monospace', '"Fira Code", monospace', '"Source Code Pro", monospace', 'monospace'].map(font => <option key={font} value={font}/>)}</datalist>
      <p className="dialog-note">{t("百分比相对于各编辑窗格的可用宽度，适用于即时渲染和源码模式。")}</p>
    </fieldset>
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{t("自定义当前主题")}</button>
    {expanded && <div className="theme-customizer-fields">
      <p className="dialog-note">{t("设置只作用于当前主题，编辑区即时预览。CSS 可使用 .rich-document、.source-surface 和 .print-document；主题资源继续通过 CSS 导入。")}</p>
      <div className="form-grid">
        <label>{t("行高")}<input aria-label={t("主题行高")} type="number" min={1.2} max={2.5} step={.1} value={value.lineHeight} onChange={event => { const n=Number(event.target.value); if(n>=1.2&&n<=2.5) change({...value,lineHeight:n}); }}/></label>
        <label>{t("段落间距（px）")}<input aria-label={t("主题段落间距")} type="number" min={0} max={40} step={1} value={value.paragraphSpacing} onChange={event => { const n=Number(event.target.value); if(n>=0&&n<=40) change({...value,paragraphSpacing:n}); }}/></label>
        {(['accent','paper','ink'] as const).map((key,index) => <label key={key}>{[t('强调色'),t('纸张颜色'),t('文字颜色')][index]}<span className="theme-color-field"><input aria-label={t("主题{0}", ['强调色','纸张颜色','文字颜色'][index])} type="color" value={value[key] || ['#326eaa','#ffffff','#333333'][index]} onChange={event => change({...value,[key]:event.target.value})}/><button type="button" onClick={() => change({...value,[key]:''})}>{t("跟随主题")}</button></span></label>)}
      </div>
      <label className="workspace-field">{t("自定义 CSS")}<textarea aria-label={t("自定义主题 CSS")} spellCheck={false} rows={6} maxLength={100000} value={value.css} placeholder=".rich-document h2 { color: var(--accent); }" onChange={event => change({...value,css:event.target.value})}/></label>
      <label className="workspace-field">{t("打印专用 CSS")}<textarea aria-label={t("打印主题 CSS")} spellCheck={false} rows={4} maxLength={100000} value={value.printCss} placeholder=".print-document h2 { break-before: page; }" onChange={event => change({...value,printCss:event.target.value})}/></label>
      <p className="dialog-note">{t("打印 CSS 用于 HTML 打印和 PDF。可用 break-before、break-after、break-inside 控制分页；过高的内容仍会拆页。")}</p>
      <div className="theme-customizer-actions"><button type="button" onClick={() => { change({...customizationDefaults}); reset(); }}>{t("恢复当前主题默认值")}</button><button type="button" onClick={() => void save().catch(error => setError(error.message))}>{t("导出当前主题 CSS…")}</button></div>
      {error && <p role="alert">{t(error)}</p>}
    </div>}
  </div>;
}
