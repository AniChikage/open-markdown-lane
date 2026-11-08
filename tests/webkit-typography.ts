async function runWebKitTypographyTests() {
  const desktop=window.desktop!;
  const passed:string[]=[],errors:string[]=[];
  window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  const wait=async(test:()=>boolean)=>{const end=Date.now()+10000;while(Date.now()<end){if(test())return;await new Promise(r=>setTimeout(r,30));}throw Error('Native typography condition timed out');};
  const check=(value:boolean,label:string)=>{if(!value)throw Error(label);passed.push(label);};
  const root=()=>document.querySelector<HTMLElement>('.document-editor[data-active="true"] .rich-document')!;
  const command=(action:string)=>window.__openMarkdownLane.command({action});
  const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b=>b.textContent===text)!;
  const field=(name:string)=>document.querySelector<HTMLInputElement>(`[aria-label="${name}"]`)!;
  const fill=(name:string,value:string)=>{const el=field(name);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  const select=(name:string,value:string)=>{const el=field(name);Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('change',{bubbles:true}));};
  const preferences=async()=>{command('preferences');await wait(()=>!!field('主题正文字体'));};
  const close=async()=>{button('完成').click();await wait(()=>!document.querySelector('[role="dialog"]'));};
  const mode=async(source:boolean)=>{command('source');await wait(()=>source?!!document.querySelector('.source-surface:not([hidden]) .cm-content'):!!document.querySelector('.rich-scroller:not([hidden])'));};
  const readSource=()=>[...document.querySelectorAll('.document-editor[data-active="true"] .source-surface .cm-line')].map(n=>n.textContent).join('\n');
  let original='';
  try {
    await wait(()=>!!root()?.querySelector('h1'));const restored=await desktop.restore();if(!restored.ok||!restored.value)throw Error('Missing native fixture');original=restored.value.documents[0].content;
    await preferences();check(field('主题正文字体').offsetWidth>0,'native fonts and layout are visible without expanding advanced CSS');
    fill('主题正文字体','Georgia, serif');fill('主题代码字体','"Courier New", monospace');select('正文宽度单位','%');await wait(()=>field('主题正文宽度').max==='100');fill('主题正文宽度','75');await close();
    await wait(()=>getComputedStyle(root()).maxWidth==='75%');check(getComputedStyle(root()).fontFamily.includes('Georgia'),'native live editor uses the chosen body font');
    const size=root().getBoundingClientRect();check(Math.abs(size.width-root().parentElement!.clientWidth*.75)<2,'native percentage width matches the actual pane width');
    check(getComputedStyle(root().querySelector('code')!).fontFamily.includes('Courier New'),'native fenced code preview uses the code font');
    root().querySelector<HTMLElement>('.fence-body')!.click();await wait(()=>!!root().querySelector('.fence-editing .cm-scroller'));
    check(getComputedStyle(root().querySelector('.fence-editing .cm-scroller')!).fontFamily.includes('Courier New'),'native editable CodeMirror fence retains its distinct code font');
    root().querySelector<HTMLElement>('h1')!.click();await mode(true);const source=document.querySelector<HTMLElement>('.source-surface:not([hidden]) .cm-content')!;
    check(getComputedStyle(source).maxWidth==='75%'&&readSource()===original,'native source mode respects percentage width without rewriting Markdown');await mode(false);
    await preferences();select('主题','paper');await wait(()=>field('主题正文字体').value==='');check(field('正文宽度单位').value==='px','native theme switch uses that theme defaults');select('主题','light');await wait(()=>field('主题正文字体').value==='Georgia, serif');check(field('正文宽度单位').value==='%'&&field('主题正文宽度').value==='75','native theme switch restores font and percentage choices');await close();
    const text=root().querySelector('p')!.firstChild!;root().focus();getSelection()!.collapse(text,0);document.dispatchEvent(new Event('selectionchange'));
    root().dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertText',data:'中文验收'}));
    await preferences();fill('主题正文字体','system-ui, sans-serif');await close();command('undo');await mode(true);check(readSource()===original,'native changing fonts preserves exact document undo');await mode(false);command('redo');await mode(true);check(readSource()===original.replace('普通','中文验收普通'),'native font changes do not consume the redo transaction');await mode(false);command('undo');
    await preferences();button('自定义当前主题').click();await wait(()=>!!button('恢复当前主题默认值'));button('恢复当前主题默认值').click();await wait(()=>field('主题正文字体').value==='');await close();await wait(()=>getComputedStyle(root()).maxWidth==='860px');check(true,'native reset restores default fonts and pixel layout');
    command('save');await wait(()=>!document.querySelector('.tab-dirty'));check(errors.length===0,'native typography interactions produce no runtime errors');
    return {typographyOnly:true,passed,errors,source:original};
  }catch(error){return {typographyOnly:true,passed,errors,error:String(error),source:original};}
}
