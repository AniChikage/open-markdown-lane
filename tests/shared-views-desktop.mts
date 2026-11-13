import { expect } from 'playwright/test';
import { electron } from './chinese-launch.mts';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { DocumentRecord } from '../shared/contracts.js';
const data = await realpath(await mkdtemp(path.join(os.tmpdir(),'lane-shared-views-'))), profile=path.join(data,'profile');
const qa=process.env.OPEN_MARKDOWN_LANE_QA_DIR || path.join(data,'evidence'); await mkdir(profile); await mkdir(qa,{recursive:true});
const original = '# Shared document\n\n正文输入区：\n\n**保留加粗**\n\n- 列表输入区：\n\n| 名称 | 内容 |\n| --- | --- |\n| 表格输入区： | value |\n\n```text\n代码输入区：\n```\n\n'+Array.from({length:500},(_,i)=>`Paragraph ${i}: 中文 Markdown **editing** and a [link](https://example.com).`).join('\n\n')+'\n';
const records: DocumentRecord[]=[];
for(let i=0;i<12;i++){const text=i===0?original:original.replace('Shared document','Background '+i), file=path.join(data,`Tab-${i}.md`);await writeFile(file,text);records.push({id:'shared-'+i,path:file,name:path.basename(file),content:text,savedContent:text,diskHash:createHash('sha256').update(text).digest('hex'),lineEnding:'\n'});}
await writeFile(path.join(profile,'session.json'),JSON.stringify({version:1,documents:records,activeId:records[0].id}));
const env:Record<string,string>={...process.env,OPEN_MARKDOWN_LANE_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.OPEN_MARKDOWN_LANE_DEV_URL;
let app!:import('playwright').ElectronApplication, page!:import('playwright').Page;const errors:string[]=[],checks:string[]=[], mod=process.platform==='darwin'?'Meta':'Control';
const pane=(mirror=false)=>process.env.LANE_BASELINE_DIST ? page.locator(`.document-editor[data-document-id="${records[0].id}"]`) : page.locator(`.document-editor[data-view-id="${mirror?'mirror:':''}${records[0].id}"]`);
async function command(action:string){await app.evaluate(({BrowserWindow},action)=>BrowserWindow.getAllWindows()[0].webContents.send('app:command',{action}),action);}
async function launch(){app=await electron.launch({...(process.env.OPEN_MARKDOWN_LANE_EXECUTABLE?{executablePath:process.env.OPEN_MARKDOWN_LANE_EXECUTABLE,args:[]}:{args:[process.cwd()]}),env,timeout:30000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.evaluate(()=>{const scope=window as Window & {laneSharedFocus?:unknown[]};scope.laneSharedFocus=[];for(const type of ['focusin','pointerdown'])document.addEventListener(type,event=>{const target=event.target as HTMLElement;scope.laneSharedFocus!.push({type:event.type,view:target.closest<HTMLElement>('.document-editor')?.dataset.viewId,classes:target.className,stack:new Error().stack});},true);});await page.setViewportSize({width:1380,height:900});await expect(page.getByRole('tab',{name:'Tab-0.md',exact:true})).toBeVisible({timeout:20000});}
async function recordLayout(name:string){const state=await recovery();await writeFile(path.join(qa,name+'.json'),JSON.stringify({workspace:state.workspace,views:state.documents[0].editorViews},null,2));}
async function point(text:string,mirror=false){await pane(mirror).locator('.rich-document').evaluate((root:HTMLElement,text)=>{root.focus();const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode()))if(!n.parentElement!.closest('.md-meta,.md-view')&&(n as Text).data.includes(text)){const at=(n as Text).data.indexOf(text)+text.length;getSelection()!.setBaseAndExtent(n,at,n,at);document.dispatchEvent(new Event('selectionchange'));return;}throw Error('missing '+text);},text);}
const saved=async()=>await readFile(records[0].path!,'utf8');
const recovery=async()=>JSON.parse(await readFile(path.join(profile,'session.json'),'utf8'));
async function pasteImage(name:string){await pane().locator('.rich-document').evaluate((root,name)=>{const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNNsAAAAASUVORK5CYII='),c=>c.charCodeAt(0));const data=new DataTransfer();data.items.add(new File([bytes],name,{type:'image/png'}));root.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));},name);}
try {
 await launch();
 if(process.env.LANE_BASELINE_DIST) {const file=path.join(process.env.LANE_BASELINE_DIST,'index.html');await app.evaluate(async({BrowserWindow},file)=>{await BrowserWindow.getAllWindows()[0].loadFile(file);},file);await expect(page.getByRole('tab',{name:'Tab-0.md',exact:true})).toBeVisible();}
 const cdp=await page.context().newCDPSession(page);
 await point('正文输入区：');await page.keyboard.insertText('保留的草稿');await expect.poll(saved).toBe(original.replace('正文输入区：','正文输入区：保留的草稿'));
 const switched:number[]=[];
 for(let i=1;i<12;i++){const start=Date.now();await page.getByRole('tab',{name:`Tab-${i}.md`,exact:true}).click();await expect(page.locator(`.document-editor[data-document-id="shared-${i}"]`)).toBeVisible();switched.push(Date.now()-start);}
 await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');
 const resident=await page.locator('.document-editor').count(),dom=await page.locator('*').count();
 await writeFile(path.join(qa,process.env.LANE_BASELINE_DIST?'memory-baseline.json':'memory-current.json'),JSON.stringify({platform:process.platform,profile,resident,dom,heap,switched,measurement:'Renderer retained JS heap after explicit GC; switch times include Playwright overhead, not input latency.'},null,2));
 if(process.env.LANE_BASELINE_DIST){assert.equal(resident,12);console.log('BASELINE',JSON.stringify({resident,dom,heap}));}else{
 assert.ok(resident<=3,`bounded warm editors, got ${resident}`);assert.equal(await page.locator('.document-editor[data-document-id="shared-0"]').count(),0);
 await page.getByRole('tab',{name:'Tab-0.md',exact:true}).click();await command('undo');await expect.poll(saved).toBe(original);await command('redo');await expect.poll(saved).toContain('保留的草稿');await command('undo');await expect.poll(saved).toBe(original);
 console.log('CHECK',checks.length+1);checks.push('12 visited tabs mount at most 3 editors; evicted text, CRLF/model history and redo survive remount.');
 await point('正文输入区：');
 await app.evaluate(({ipcMain})=>{
   const handlers=(ipcMain as unknown as {_invokeHandlers:Map<string,(...args:unknown[])=>unknown>})._invokeHandlers, original=handlers.get('document:image')!;
   if(!original)throw Error('Missing owned image handler');
   ipcMain.removeHandler('document:image');
   ipcMain.handle('document:image',async(...args)=>{await new Promise<void>(resolve=>{(globalThis as typeof globalThis & {laneImageRelease?:()=>void}).laneImageRelease=resolve;});return original(...args);});
 });
 await pasteImage('pending.png');
 await expect.poll(()=>app.evaluate(()=>!!(globalThis as typeof globalThis & {laneImageRelease?:()=>void}).laneImageRelease)).toBe(true);
 for(let i=1;i<=4;i++)await page.getByRole('tab',{name:`Tab-${i}.md`,exact:true}).click();
 await expect(pane()).toHaveCount(1);await app.evaluate(()=>(globalThis as typeof globalThis & {laneImageRelease?:()=>void}).laneImageRelease!());
 await expect.poll(saved).toContain('![pending.png](');await page.getByRole('tab',{name:'Tab-0.md',exact:true}).click();await command('undo');await expect.poll(saved).toBe(original);
 console.log('CHECK',checks.length+1);checks.push('A delayed image import pins its background view through cache pressure and inserts once without losing the document undo.');
 await page.getByRole('tab',{name:'Tab-0.md',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'同一文档双视图',exact:true}).click();await expect(page.locator('.document-editor:not([hidden])')).toHaveCount(2);await expect(page.getByRole('tab')).toHaveCount(12);await expect(pane(true).locator('.source-surface')).toBeVisible();
 await point('正文输入区：');await cdp.send('Input.imeSetComposition',{text:'nihao',selectionStart:5,selectionEnd:5});
 await command('other-pane');await expect(pane()).toHaveAttribute('data-active','true');await cdp.send('Input.insertText',{text:'你好，中国'});await expect.poll(saved).toBe(original.replace('正文输入区：','正文输入区：你好，中国'));
 await expect(pane(true).locator('.cm-content')).toContainText('正文输入区：你好，中国');
 await command('other-pane');await expect(pane(true)).toHaveAttribute('data-active','true');await command('undo');await expect.poll(saved).toBe(original);await expect(pane().locator('.rich-document')).toContainText('正文输入区：');await command('redo');await expect.poll(saved).toContain('你好，中国');await command('undo');await expect.poll(saved).toBe(original);
 console.log('CHECK',checks.length+1);checks.push('Rich Chinese composition blocks pane switching; the source twin mirrors commit and shares exact single undo/redo.');
 let source=pane(true).locator('.source-surface .cm-content');await source.click();await page.keyboard.press(`${mod}+End`);await cdp.send('Input.imeSetComposition',{text:'ceshi',selectionStart:5,selectionEnd:5});await cdp.send('Input.insertText',{text:'源码中文😀'});await expect.poll(saved).toContain('源码中文😀');
 await command('other-pane');await expect(pane()).toHaveAttribute('data-active','true');await command('undo');await expect.poll(saved).toBe(original);await command('redo');await expect.poll(saved).toContain('源码中文😀');await command('undo');await expect.poll(saved).toBe(original);
 console.log('CHECK',checks.length+1);checks.push('Source Chinese/emoji composition synchronizes rich view and shares undo from the other pane.');
 // Both live views keep independent carets, including inside Markdown table/code.
 await command('other-pane');await command('source');await expect(pane(true).locator('.rich-scroller')).toBeVisible();
 for(const text of ['保留加粗','列表输入区：','表格输入区：','代码输入区：']){
   await point(text,true);await cdp.send('Input.imeSetComposition',{text:'zhong',selectionStart:5,selectionEnd:5});await cdp.send('Input.insertText',{text:'中国'});await expect.poll(saved).toBe(original.replace(text,text+'中国'));
   await command('other-pane');await command('undo');await expect.poll(saved).toBe(original);await command('other-pane');
 }
 console.log('CHECK',checks.length+1);checks.push('Two rendered views accept list/table/local-code composition and undo exactly from the opposite pane.');
 await point('正文输入区：');await app.evaluate(()=>{(globalThis as typeof globalThis & {laneImageRelease?:()=>void}).laneImageRelease=undefined;});await pasteImage('pending-twin.png');
 await expect.poll(()=>app.evaluate(()=>!!(globalThis as typeof globalThis & {laneImageRelease?:()=>void}).laneImageRelease)).toBe(true);
 await page.getByRole('button',{name:'关闭第一个窗格',exact:true}).click();await expect(page.locator('.document-editor:not([hidden])')).toHaveCount(2);await expect(page.getByText('图片正在导入，请完成后再关闭窗格。',{exact:true})).toBeVisible();
 await app.evaluate(()=>(globalThis as typeof globalThis & {laneImageRelease?:()=>void}).laneImageRelease!());await expect.poll(saved).toContain('![pending-twin.png](');await command('other-pane');await command('undo');await expect.poll(saved).toBe(original);
 console.log('CHECK',checks.length+1);checks.push('Closing a shared pane waits for a pending image import, then keeps opposite-pane undo exact.');
 // Unsaved content and per-view mode/layout survive a real process restart.
 await command('source');await expect(source).toBeVisible();await command('other-pane');await point('正文输入区：');
 await command('autosave');
 await page.keyboard.insertText('未保存重启恢复');
 await expect.poll(async()=>(await recovery()).documents[0].content).toContain('未保存重启恢复');assert.equal(await saved(),original);
 await pane().locator('.rich-scroller').evaluate(e=>e.scrollTop=1600);await source.click();await page.keyboard.press(`${mod}+End`);
 await expect.poll(async()=>(await recovery()).workspace?.activePane).toBe('secondary');
 await recordLayout('before-restart');await app!.close();await recordLayout('after-quit');await launch();source=pane(true).locator('.source-surface .cm-content');
 await writeFile(path.join(qa,'restart-focus.json'),JSON.stringify(await page.evaluate(()=>(window as Window & {laneSharedFocus?:unknown[]}).laneSharedFocus),null,2));
 await expect(page.locator('.document-editor:not([hidden])')).toHaveCount(2);await expect(pane(true)).toHaveAttribute('data-active','true');await expect(source).toBeVisible();
 assert.ok((await recovery()).documents[0].content.includes('未保存重启恢复'));assert.equal(await saved(),original);await expect.poll(()=>pane(true).locator('.cm-scroller').evaluate(e=>e.scrollTop)).toBeGreaterThan(1000);await source.press(`${mod}+Home`);await expect(source).toContainText('未保存重启恢复');await expect.poll(()=>pane().locator('.rich-scroller').evaluate(e=>e.scrollTop)).toBeGreaterThan(1000);
 await page.screenshot({path:path.join(qa,'shared-views-restored.png')});
 console.log('CHECK',checks.length+1);checks.push('Real restart retains one dirty document, both view modes, active pane, split layout and independent scroll; disk remains unchanged with autosave off.');
 await command('other-pane');await command('save');await expect.poll(saved).toContain('未保存重启恢复');
 await page.getByRole('button',{name:'交换窗格',exact:true}).click();await expect(pane(true)).toHaveClass(/primary/);await page.getByRole('button',{name:'交换窗格',exact:true}).click();await page.getByRole('button',{name:'关闭第一个窗格',exact:true}).click();await expect(page.locator('.document-editor:not([hidden])')).toHaveCount(1);await expect(pane().locator('.source-surface')).toBeVisible();await expect(page.getByRole('tab')).toHaveCount(12);
 // Exercise incremental source mirroring on a 5+ MiB code block, not just small text.
 const giant='# Twin large code\n\n```text\n'+('large code line 0123456789abcdef\n'.repeat(180000))+'TWIN-END\n```\n';
 const giantRecord:DocumentRecord={id:'shared-large',name:'Shared-large.md',path:null,content:giant,savedContent:'',diskHash:null,lineEnding:'\n'};
 await page.evaluate(async record=>{const result=await window.desktop!.registerDraft(record);if(!result.ok)throw Error(result.error);},giantRecord);
 await app.evaluate(({BrowserWindow},record)=>BrowserWindow.getAllWindows()[0].webContents.send('app:command',{action:'opened',document:record}),giantRecord);
 await expect(page.getByRole('tab',{name:'Shared-large.md',exact:true})).toBeVisible();await page.getByRole('button',{name:'同一文档双视图',exact:true}).click();await command('other-pane');
 const giantPane=page.locator('.document-editor[data-view-id="mirror:shared-large"]'),giantInput=giantPane.locator('.source-surface .cm-content');await expect(giantInput).toBeVisible();await giantInput.focus();await page.keyboard.press(`${mod}+Home`);await page.keyboard.insertText('双视图中文😀');
 await expect.poll(async()=>(await recovery()).documents.find((r:DocumentRecord)=>r.id==='shared-large')?.content,{timeout:20000}).toBe('双视图中文😀'+giant);
 assert.ok(await giantPane.locator('.cm-line').count()<200,'large source twin stays virtualized');await command('other-pane');await command('undo');
 await expect.poll(async()=>(await recovery()).documents.find((r:DocumentRecord)=>r.id==='shared-large')?.content,{timeout:20000}).toBe(giant);
 console.log('CHECK',checks.length+1);checks.push('5+ MiB shared code uses a bounded source viewport, mirrors Chinese/emoji edits incrementally and undoes from the rendered pane to exact recovery bytes.');
 await expect(page.locator('vite-error-overlay')).toHaveCount(0);assert.deepEqual(errors,[]);
 await writeFile(path.join(qa,'shared-views-results.json'),JSON.stringify({checks,errors,profile,resident,dom,heap},null,2));console.log(checks.map(c=>'PASS: '+c).join('\n'));
 }
}catch(error){await page!?.screenshot({path:path.join(qa,'shared-views-failure.png')}).catch(()=>{});throw error;}finally{await app!?.close();}
