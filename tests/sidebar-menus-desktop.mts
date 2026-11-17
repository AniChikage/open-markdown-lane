import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {expect} from 'playwright/test';
import {electron} from './chinese-launch.mts';

const root=await mkdtemp(path.join(os.tmpdir(),'lane-sidebar-menu-'));
const profile=path.join(root,'profile'),folder=path.join(root,'notes');
const qa=process.env.OPEN_MARKDOWN_LANE_QA_DIR||path.join(root,'evidence');
await Promise.all([mkdir(profile),mkdir(folder),mkdir(qa,{recursive:true})]);
const text='# Menu QA\n\nAn owned test document.\n',file=path.join(folder,'Note.md');
await writeFile(file,text);
await Promise.all(Array.from({length:40},(_,i)=>writeFile(path.join(folder,`Note-${i}.md`),'# Test\n')));
await writeFile(path.join(profile,'session.json'),JSON.stringify({version:1,folder,documents:[{id:'menu-qa',name:'Note.md',path:file,content:text,savedContent:text,diskHash:createHash('sha256').update(text).digest('hex'),encoding:'utf-8',bom:false,lineEnding:'\n'}],activeId:'menu-qa'}));
const env:Record<string,string>={...process.env,OPEN_MARKDOWN_LANE_DATA_DIR:profile};
delete env.ELECTRON_RUN_AS_NODE;delete env.OPEN_MARKDOWN_LANE_DEV_URL;
const app=await electron.launch({...(process.env.OPEN_MARKDOWN_LANE_EXECUTABLE?{executablePath:process.env.OPEN_MARKDOWN_LANE_EXECUTABLE,args:[]}:{args:[process.cwd()]}),env,timeout:60000});
const checks:string[]=[],errors:string[]=[];
try {
  const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1380,height:900});
  const trigger=page.getByRole('button',{name:'文件夹操作',exact:true});
  const menu=page.getByRole('menu',{name:'文件操作',exact:true});
  await expect(trigger).toBeVisible();
  await expect(page.locator('.rich-document')).toContainText('An owned test document.');
  await expect(page.locator('html')).toHaveAttribute('data-window-material',/^(macos|macos-glass|none)$/);
  // macOS development runs must also exercise the Windows/Linux backdrop-filter
  // containing block. Installed Windows/Linux runs use their actual capability.
  if(process.platform==='darwin')await page.evaluate(()=>{document.documentElement.dataset.windowMaterial='none';});
  async function boundsAndHits(){
    await expect(menu).toBeVisible();
    const result=await menu.evaluate(panel=>{
      const r=panel.getBoundingClientRect();
      const controls=[...panel.querySelectorAll<HTMLElement>('button,select,input')].filter(item=>!item.hasAttribute('disabled'));
      const visible=controls.filter(item=>{const c=item.getBoundingClientRect();return c.top>=r.top&&c.bottom<=r.bottom;});
      return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,
        visible:visible.length,hits:visible.every(item=>{const c=item.getBoundingClientRect();return panel.contains(document.elementFromPoint(c.right-3,c.top+c.height/2));}),
        sidebarRight:document.querySelector('.sidebar')!.getBoundingClientRect().right};
    });
    assert.ok(result.x>=7&&result.y>=7&&result.right<=result.width-7&&result.bottom<=result.height-7,JSON.stringify(result));
    assert.ok(result.visible>0&&result.hits,'Menu controls must receive real pointer hits: '+JSON.stringify(result));
    return result;
  }
  await trigger.click();const wide=await boundsAndHits();assert.ok(wide.right>wide.sidebarRight+80);
  await menu.getByRole('combobox',{name:'文件排序'}).selectOption('modified');
  await menu.getByRole('checkbox',{name:'降序',exact:true}).check();
  await expect(menu).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('open-markdown-lane-file-sort'))).toBe('modified');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('open-markdown-lane-file-desc'))).toBe('true');
  await page.screenshot({path:path.join(qa,'sidebar-menu-light.png'),fullPage:false});
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(trigger).toBeFocused();
  await trigger.click();await page.locator('.rich-document h1').click();await expect(menu).toHaveCount(0);
  checks.push('Folder actions escape the frosted sidebar clipping; all visible controls receive pointer hits; sort settings persist, outside click dismisses and Escape restores focus.');

  const treeEntry=page.locator('.tree-entry').filter({hasText:'Note.md'}).first();
  async function openFileMenu(){
    await treeEntry.scrollIntoViewIfNeeded();
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    await treeEntry.click({button:'right'});await boundsAndHits();
  }
  await openFileMenu();
  // Exercise an actual file operation, without changing or deleting a fixture.
  await menu.getByRole('menuitem',{name:'重命名…',exact:true}).click();
  const rename=page.getByRole('dialog');await expect(rename).toBeVisible();
  await rename.getByRole('button',{name:'取消',exact:true}).click();await expect(rename).toHaveCount(0);
  checks.push('File-tree right-click exposes the full file menu and opens the rename dialog; cancellation preserves the document.');

  await page.setViewportSize({width:660,height:420});
  await openFileMenu();
  await menu.evaluate(panel=>{panel.scrollTop=panel.scrollHeight;});
  await expect(menu.getByRole('checkbox',{name:'文件夹优先',exact:true})).toBeInViewport();
  await menu.getByRole('checkbox',{name:'文件夹优先',exact:true}).uncheck();
  await expect(menu).toBeVisible();await boundsAndHits();
  await page.screenshot({path:path.join(qa,'sidebar-menu-compact.png'),fullPage:false});
  await page.setViewportSize({width:780,height:600});await expect(menu).toHaveCount(0);
  await trigger.click();await page.locator('.sidebar-body').evaluate(panel=>{panel.scrollTop=panel.scrollHeight;});
  await expect(menu).toHaveCount(0);
  checks.push('Short windows clamp and internally scroll the complete file menu; controls stay clickable; resizing or scrolling its external anchor dismisses it.');

  await page.locator('.sidebar-body').evaluate(panel=>{panel.scrollTop=0;});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('app:command',{action:'theme'}));
  await expect(page.locator('html')).toHaveAttribute('data-appearance','dark');
  await trigger.click();await boundsAndHits();
  await page.screenshot({path:path.join(qa,'sidebar-menu-dark.png'),fullPage:false});
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await writeFile(path.join(qa,'sidebar-menu-results.json'),JSON.stringify({platform:process.platform,macUsesFallbackCSS:process.platform==='darwin',checks,errors,passed:true},null,2));
  console.log('PASS: sidebar menu clipping, hit targets, file actions, viewport bounds, scroll, focus and theme; '+checks.length+' groups.');
} finally {await app.close();}
