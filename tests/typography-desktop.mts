import {expect} from 'playwright/test';
import {electron} from './chinese-launch.mts';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
const directory=await realpath(await mkdtemp(path.join(os.tmpdir(),'lane-typography-'))),profile=path.join(directory,'profile'),qa=process.env.OPEN_MARKDOWN_LANE_QA_DIR||path.join(directory,'evidence');
await mkdir(profile);await mkdir(qa,{recursive:true});
const content='# Typography QA\n\n普通正文 **粗体** and `inlineCode`.\n\n```js\nconst value = 1;\n```\n\n```txt\n'+('Large code line. 中文\n'.repeat(7000))+'```\n';
const file=path.join(directory,'Typography.md');await writeFile(file,content);
const record={id:'typography',name:'Typography.md',path:file,content,savedContent:content,diskHash:createHash('sha256').update(content).digest('hex'),lineEnding:'\n'};
await writeFile(path.join(profile,'session.json'),JSON.stringify({version:1,documents:[record,{id:'second',name:'Second.md',path:null,content:'# Second pane',savedContent:'# Second pane',diskHash:null,lineEnding:'\n'}],activeId:record.id}));
const env:Record<string,string>={...process.env,OPEN_MARKDOWN_LANE_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;delete env.OPEN_MARKDOWN_LANE_DEV_URL;
let app!:import('playwright').ElectronApplication,page!:import('playwright').Page;const errors:string[]=[],checks:string[]=[];
const editor=()=>page.locator('.document-editor[data-active="true"] .rich-document');
async function command(action:string){const win=await app.browserWindow(page);try{await win.evaluate((win,action)=>win.webContents.send('app:command',{action}),action);}finally{await win.dispose();}}
async function launch(){app=await electron.launch({...process.env.OPEN_MARKDOWN_LANE_EXECUTABLE?{executablePath:process.env.OPEN_MARKDOWN_LANE_EXECUTABLE,args:[]}:{args:[process.cwd()]},env,timeout:45000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.setViewportSize({width:1400,height:950});await expect(editor()).toBeVisible();}
async function prefs(){await command('preferences');return page.getByRole('dialog',{name:'偏好设置',exact:true});}
async function close(){await page.getByRole('button',{name:'完成',exact:true}).click();}
async function widthMatches(selector:string){const box=await page.locator(selector).evaluate(el=>({width:el.getBoundingClientRect().width,parent:el.parentElement!.clientWidth,max:getComputedStyle(el).maxWidth}));assert.equal(box.max,'75%');assert.ok(Math.abs(box.width-box.parent*.75)<2,JSON.stringify(box));}
try{
 await launch();
 // Exercise data written by earlier versions, before width units existed.
 await page.evaluate(()=>localStorage.setItem('open-markdown-lane-theme-customizations-v1',JSON.stringify({light:{fontFamily:'Georgia, serif',codeFontFamily:'"Courier New", monospace',contentWidth:720}})));
 await page.reload();await expect(editor()).toBeVisible();await expect.poll(()=>editor().evaluate(el=>getComputedStyle(el).maxWidth)).toBe('720px');
 let settings=await prefs();await expect(settings.getByRole('combobox',{name:'主题正文字体',exact:true})).toHaveValue('Georgia, serif');
 await expect(settings.getByRole('combobox',{name:'正文宽度单位',exact:true})).toHaveValue('px');
 await settings.getByRole('combobox',{name:'主题正文字体',exact:true}).fill('Georgia, serif');
 await settings.getByRole('combobox',{name:'主题代码字体',exact:true}).fill('"Courier New", monospace');
 await settings.getByRole('combobox',{name:'正文宽度单位',exact:true}).selectOption('%');const widthInput=settings.getByRole('spinbutton',{name:'主题正文宽度',exact:true});await widthInput.fill('');await widthInput.pressSequentially('75');await expect(widthInput).toHaveValue('75');await widthInput.fill('10');await settings.getByRole('combobox',{name:'主题正文字体',exact:true}).focus();await expect(widthInput).toHaveValue('75');
 // Leave room for the rest of the settings while checking the actual form layout.
 await settings.getByRole('group',{name:'字体与正文布局',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(qa,'typography-settings.png')});await close();
 await widthMatches('.document-editor[data-active="true"] .rich-document');
 assert.match(await editor().evaluate(el=>getComputedStyle(el).fontFamily),/Georgia/);
 assert.match(await editor().locator('p code').evaluate(el=>getComputedStyle(el).fontFamily),/Courier New/);
 await editor().locator('.md-fence:not(.large-code) .fence-body').click();
 const code=editor().locator('.fence-editing .cm-scroller');await expect(code).toBeVisible();assert.match(await code.evaluate(el=>getComputedStyle(el).fontFamily),/Courier New/);
 await editor().locator('h1').click();await editor().locator('.large-code').scrollIntoViewIfNeeded();
 assert.match(await editor().locator('.large-code .cm-scroller').evaluate(el=>getComputedStyle(el).fontFamily),/Courier New/);
 await editor().locator('.large-code .cm-content').click();await expect(editor().locator('.large-code.fence-editing')).toBeVisible();assert.match(await editor().locator('.large-code .cm-scroller').evaluate(el=>getComputedStyle(el).fontFamily),/Courier New/);
 await editor().locator('h1').click();await command('source');await expect(page.locator('.source-surface:not([hidden]) .cm-content')).toBeVisible();await widthMatches('.source-surface:not([hidden]) .cm-content');await command('source');
 checks.push('Legacy pixels migrate unchanged; body, inline code and active/virtualized fenced code use distinct fonts; live/source percentages match actual pane geometry.');
 // Changing appearance must not remount the editor or pollute document undo.
 await editor().locator('h1').click();await page.keyboard.press('End');await page.keyboard.insertText('修改');
 settings=await prefs();await settings.getByRole('combobox',{name:'主题正文字体',exact:true}).fill('system-ui, sans-serif');await close();await command('undo');await command('save');await expect.poll(()=>readFile(file,'utf8')).toBe(content);
 await command('redo');await command('save');await expect.poll(()=>readFile(file,'utf8')).not.toBe(content);await command('undo');await command('save');await expect.poll(()=>readFile(file,'utf8')).toBe(content);
 settings=await prefs();await settings.getByRole('combobox',{name:'主题',exact:true}).selectOption('paper');await expect(settings.getByRole('combobox',{name:'主题正文字体',exact:true})).toHaveValue('');await expect(settings.getByRole('combobox',{name:'正文宽度单位',exact:true})).toHaveValue('px');
 await settings.getByRole('combobox',{name:'主题',exact:true}).selectOption('light');await expect(settings.getByRole('combobox',{name:'正文宽度单位',exact:true})).toHaveValue('%');await expect(settings.getByRole('spinbutton',{name:'主题正文宽度',exact:true})).toHaveValue('75');
 await settings.getByRole('combobox',{name:'正文宽度单位',exact:true}).selectOption('px');await expect(settings.getByRole('spinbutton',{name:'主题正文宽度',exact:true})).toHaveValue('720');await settings.getByRole('combobox',{name:'正文宽度单位',exact:true}).selectOption('%');await close();
 await page.getByRole('button',{name:'左右分屏',exact:true}).click();await expect(page.locator('.workspace-document:not([hidden])')).toHaveCount(2);
 for(const el of await page.locator('.workspace-document:not([hidden]) .rich-document').all())if(await el.isVisible()){assert.equal(await el.evaluate(el=>getComputedStyle(el).maxWidth),'75%');const sizes=await el.evaluate(el=>[el.getBoundingClientRect().width,el.parentElement!.clientWidth]);assert.ok(Math.abs(sizes[0]-sizes[1]*.75)<2);}
 await page.getByRole('button',{name:'关闭第二个窗格',exact:true}).click();
 await page.setViewportSize({width:760,height:850});await widthMatches('.document-editor[data-active="true"] .rich-document');await page.setViewportSize({width:1400,height:950});
 await app.close();await launch();await widthMatches('.document-editor[data-active="true"] .rich-document');assert.match(await editor().evaluate(el=>getComputedStyle(el).fontFamily),/system-ui/);
 settings=await prefs();await settings.getByRole('button',{name:'自定义当前主题',exact:true}).click();const exportFile=path.join(qa,'typography-theme.css');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},exportFile);await settings.getByRole('button',{name:'导出当前主题 CSS…',exact:true}).click();await expect.poll(async()=>{try{return await readFile(exportFile,'utf8');}catch{return '';}}).toContain('--document-width:75%');
 await settings.getByRole('button',{name:'恢复当前主题默认值',exact:true}).click();await expect(settings.getByRole('combobox',{name:'主题正文字体',exact:true})).toHaveValue('');await close();assert.equal(await editor().evaluate(el=>getComputedStyle(el).maxWidth),'860px');
 // Check the English labels used by the reporter, without changing system locale.
 settings=await prefs();await settings.getByRole('combobox',{name:'Language',exact:true}).selectOption('en');await expect(page.getByText('Fonts & Layout',{exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'Content width unit',exact:true})).toBeVisible();await page.getByRole('combobox',{name:'Theme text font',exact:true}).fill('Georgia, serif');await page.getByRole('combobox',{name:'Theme code font',exact:true}).fill('\"Courier New\", monospace');await page.getByRole('combobox',{name:'Content width unit',exact:true}).selectOption('%');await page.getByRole('spinbutton',{name:'Theme text width',exact:true}).fill('75');await page.getByRole('group',{name:'Fonts & Layout',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(qa,'typography-settings-en.png')});await page.getByRole('combobox',{name:'Theme',exact:true}).selectOption('dark');await page.setViewportSize({width:760,height:850});await page.getByRole('group',{name:'Fonts & Layout',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(qa,'typography-settings-dark-narrow.png')});
 await page.getByRole('button',{name:'Done',exact:true}).click();await command('save');assert.equal(await readFile(file,'utf8'),content);
 checks.push('Per-theme choices, px/% toggles, split/narrow layouts, restart, CSS export and reset preserve Markdown and exact undo/redo; English labels render.');
 assert.deepEqual(errors,[]);assert.equal(await page.locator('vite-error-overlay').count(),0);
 await writeFile(path.join(qa,'typography-results.json'),JSON.stringify({platform:process.platform,browser:'Browser plugin not available; existing isolated Electron/Playwright workflow',checks,errors},null,2));console.log(checks.map(c=>'PASS: '+c).join('\n'));
}catch(error){await page?.screenshot({path:path.join(qa,'typography-failure.png')}).catch(()=>{});throw error;}finally{await app?.close();}
