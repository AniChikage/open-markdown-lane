import { t } from "../i18n";
import { imeKey } from "../editor/composition";
import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
function visibleControl(control: HTMLElement) {
  return control.getClientRects().length > 0 && !control.matches(":disabled") &&
    !control.closest("[hidden],[inert]") && (control.checkVisibility?.() ?? true);
}
export function Dialog({ title, close, children, className = "" }: { title: string; close(): void; children: ReactNode; className?: string }) {
  const root = useRef<HTMLElement>(null), closing = useRef(close);
  closing.current = close;
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const controls = [...root.current!.querySelectorAll<HTMLElement>('input:not([type="checkbox"]),textarea,select,button,summary')].filter(visibleControl);
    const first = controls.find(control => control.matches("input,textarea,select")) || controls[0];
    // A textarea inside closed <details> can still report layout rectangles.
    // Fall back to a visible control when the browser refuses that focus.
    for (const control of [first, ...controls]) {
      control?.focus();
      if (root.current!.contains(document.activeElement)) break;
    }
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closing.current(); }}>
    <section ref={root} className={"utility-dialog " + className} role="dialog" aria-modal="true" aria-label={title} onKeyDown={event => {
      if (imeKey(event.nativeEvent)) return;
      if (event.key === "Escape") { event.stopPropagation(); closing.current(); }
      if (event.key !== "Tab") return;
      const controls = [...root.current!.querySelectorAll<HTMLElement>('input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled]),summary,a[href]')].filter(visibleControl);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="dialog-heading"><h2>{title}</h2><button type="button" onClick={close} aria-label={t("关闭{0}", title)}>×</button></div>
      {children}
    </section>
  </div>;
}
