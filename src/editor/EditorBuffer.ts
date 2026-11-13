import { MarkdownDocument } from './model.ts';
import type { DocumentRecord, EditorViewState } from '../../shared/contracts.js';

export type ViewSlot = 'primary' | 'secondary';
export interface SharedChange { from: number; to: number; insert: string; previousLength: number }
export const mirrorKey = (id: string) => 'mirror:' + id;
export function viewState(value?: EditorViewState, length = 0): EditorViewState {
  const position = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(length, Math.trunc(n))) : 0;
  const scroll = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0;
  const initial = length > 300_000 ? 0 : length;
  return { rendered: value?.rendered !== false, anchor: value ? position(value.anchor) : initial, head: value ? position(value.head) : initial, richScroll: scroll(value?.richScroll), sourceScroll: scroll(value?.sourceScroll) };
}

/** One buffer/history per document; views own only their presentation state. */
export class EditorBuffer {
  generation = 0;
  pending = 0;
  shared = false;
  share() { if (!this.shared) { this.model.endSourceSession(); this.model.closeGroup(); this.shared = true; } }
  readonly model: MarkdownDocument;
  readonly views: Partial<Record<ViewSlot, EditorViewState>>;
  private listeners = new Map<ViewSlot, (change?: SharedChange) => void>();
  private compositions = new Map<ViewSlot, () => boolean>();
  composing() { return [...this.compositions.values()].some(test => test()); }
  private previousText: string;
  private previousRevision = 0;
  constructor(record: DocumentRecord) {
    this.model = new MarkdownDocument(record.content, record.lineEnding);
    this.views = { primary: viewState(record.editorViews?.primary, this.model.text.length), ...record.editorViews };
    this.previousText = this.model.text;
  }
  attach(slot: ViewSlot, listener: (change?: SharedChange) => void, composing = () => false) {
    this.model.resumeParsing(); this.listeners.set(slot, listener);
    this.compositions.set(slot, composing);
    return () => { this.listeners.delete(slot); this.compositions.delete(slot); if (!this.listeners.size) this.model.suspendParsing(); };
  }
  publish(origin: ViewSlot) {
    if (this.composing()) return;
    const before = this.previousText, after = this.model.text;
    let change: SharedChange | undefined;
    if (before !== after) {
      let from = 0, tail = 0;
      // Only map bookmarks when another view has actually been used.
      if (Object.keys(this.views).some(slot => slot !== origin)) {
        const last = this.model.lastEdit;
        if (last && this.model.revision === this.previousRevision + 1) { from = last.from; tail = before.length - last.to; }
        else {
          while (from < before.length && from < after.length && before[from] === after[from]) from++;
          while (tail < before.length - from && tail < after.length - from && before[before.length - tail - 1] === after[after.length - tail - 1]) tail++;
        }
        const to = before.length - tail, end = after.length - tail;
        change = { from, to, insert: after.slice(from, end), previousLength: before.length };
        const map = (position: number) => position <= from ? position : position >= to ? position + after.length - before.length : end;
        for (const [slot, state] of Object.entries(this.views)) if (slot !== origin && state) this.views[slot as ViewSlot] = { ...state, anchor: map(state.anchor), head: map(state.head) };
      }
      this.previousText = after;
    }
    this.previousRevision = this.model.revision;
    for (const [slot, listener] of this.listeners) if (slot !== origin) listener(change);
  }
}

/** Keep visible/batch views and at most two small warm tabs, within 2 MiB. */
export function residentTabs(documents: DocumentRecord[], pinned: Set<string>, recent: Map<string, number>, now: number) {
  const result = new Set(pinned); let bytes = 0, count = 0;
  for (const record of documents.filter(record => recent.has(record.id) && !pinned.has(record.id)).sort((a,b) => recent.get(b.id)! - recent.get(a.id)!)) {
    const size = record.content.length * 2;
    if (now - recent.get(record.id)! >= 30_000 || size > 1024 * 1024 || count >= 2 || bytes + size > 2 * 1024 * 1024) continue;
    result.add(record.id); bytes += size; count++;
  }
  return result;
}
