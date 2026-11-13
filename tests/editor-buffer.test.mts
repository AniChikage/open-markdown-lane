import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorBuffer, residentTabs, viewState } from '../src/editor/EditorBuffer.ts';
import { normalizeWorkspace, activateWorkspace } from '../src/workspace.ts';
import type { DocumentRecord } from '../shared/contracts.js';
const record = (id: string, content = '原文\r\n') : DocumentRecord => ({ id, content, savedContent: content, name: id+'.md', path: null, diskHash: null, lineEnding: '\r\n' });
test('sleep releases parsing while retaining exact CRLF text, independent commits and redo', () => {
  const buffer = new EditorBuffer(record('a')), model = buffer.model;
  let detach = buffer.attach('primary', () => {});
  model.selection = {anchor:0,head:0}; model.replace(0, 0, '你好😀', 'typing'); model.closeGroup();
  const changed = model.toMarkdown(); detach(); assert.equal(model.nodes.length, 0); assert.equal(model.toMarkdown(), changed);
  detach = buffer.attach('primary', () => {}); assert.ok(model.nodes.length); assert.equal(model.undo(), true); assert.equal(model.toMarkdown(), '原文\r\n');
  detach(); detach = buffer.attach('primary', () => {}); assert.equal(model.redo(), true); assert.equal(model.toMarkdown(), changed); detach();
});
test('shared buffer maps the other caret, commits composition once and retains one history', () => {
  const buffer = new EditorBuffer(record('a', 'alpha beta')), doc = buffer.model; buffer.share();
  buffer.views.secondary = { rendered:false, anchor:8, head:8, richScroll:200, sourceScroll:90 };
  let notified = 0; const detach = buffer.attach('secondary', () => notified++);
  doc.selection={anchor:0,head:0}; doc.beginComposition(); doc.replace(0,0,'ni','composition'); doc.replace(0,2,'你好','composition'); doc.endComposition(); buffer.publish('primary');
  assert.equal(notified,1); assert.equal(buffer.views.secondary.anchor,10); assert.equal(doc.text,'你好alpha beta');
  assert.equal(doc.undo(),true); buffer.publish('secondary'); assert.equal(doc.text,'alpha beta'); assert.equal(doc.canUndo,false);
  assert.equal(doc.redo(),true); assert.equal(doc.text,'你好alpha beta'); detach();
});
test('resident policy pins visible/dirty batch documents and bounds warm tabs by count, size and age', () => {
  const docs = Array.from({length:12},(_,i)=>record(''+i, 'x'.repeat(i === 9 ? 600_000 : 10)));
  const recent = new Map(docs.map((doc,i)=>[doc.id, 10_000+i]));
  assert.deepEqual([...residentTabs(docs,new Set(['0','1']),recent,11_000)], ['0','1','11','10']);
  assert.deepEqual([...residentTabs(docs,new Set(['0','9']),recent,99_000)], ['0','9']);
});
test('shared views receive exact changed spans for editing, undo, redo and external replacement', () => {
  const buffer = new EditorBuffer(record('a','abcdefghijkl')), model = buffer.model;
  buffer.views.secondary = {rendered:false,anchor:8,head:8,richScroll:0,sourceScroll:0};
  const changes:unknown[]=[]; buffer.attach('secondary',change=>changes.push(change));
  model.replace(2,4,'中国😀'); buffer.publish('primary');
  assert.deepEqual(changes.at(-1),{from:2,to:4,insert:'中国😀',previousLength:12});assert.equal(buffer.views.secondary.anchor,10);
  model.undo();buffer.publish('primary');assert.deepEqual(changes.at(-1),{from:2,to:6,insert:'cd',previousLength:14});
  model.redo();buffer.publish('primary');assert.deepEqual(changes.at(-1),{from:2,to:4,insert:'中国😀',previousLength:12});
  model.replaceExternal('fresh');buffer.publish('primary');assert.deepEqual(changes.at(-1),{from:0,to:14,insert:'fresh',previousLength:14});
});
test('composition in either pane defers peer notifications until the final candidate commits', () => {
  const buffer=new EditorBuffer(record('a','正文'));buffer.share();let composing=true,updates=0;
  buffer.attach('primary',()=>{},()=>composing);buffer.attach('secondary',()=>updates++);
  buffer.model.selection={anchor:0,head:0};buffer.model.beginComposition();buffer.model.replace(0,0,'ni','composition');buffer.publish('primary');
  assert.equal(updates,0);assert.equal(buffer.composing(),true);
  buffer.model.replace(0,2,'你','composition');buffer.model.endComposition();composing=false;buffer.publish('primary');
  assert.equal(updates,1);assert.equal(buffer.model.text,'你正文');assert.equal(buffer.model.undo(),true);assert.equal(buffer.model.text,'正文');
});
test('same-document layouts restore with a single tab and migrate to different documents on tab selection', () => {
  const layout = { primaryId:'a', secondaryId:'a', sameDocument:true, activePane:'secondary' as const, direction:'columns' as const, ratio:.5 };
  assert.deepEqual(normalizeWorkspace(layout,['a'],'a'),layout);
  assert.equal(normalizeWorkspace({...layout,primaryId:'missing'},['a'],'a'),null);
  assert.deepEqual(activateWorkspace(layout,'a','b'),{...layout,secondaryId:'b',sameDocument:false});
  assert.deepEqual(viewState({rendered:false,anchor:-1,head:999,richScroll:-5,sourceScroll:NaN},10), {rendered:false,anchor:0,head:10,richScroll:0,sourceScroll:0});
  assert.equal(viewState(undefined,100).anchor,100,'legacy small documents retain their end caret');
  assert.equal(viewState(undefined,1_000_000).anchor,0,'large documents retain their start caret');
});
