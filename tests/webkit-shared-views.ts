async function runWebKitSharedViewsTests() {
  const passed:string[]=[], errors:string[]=[];
  const desktop=window.desktop! as import('../shared/contracts.js').DesktopBridge & { testRecovery():Promise<import('../shared/contracts.js').BridgeResponse<import('../shared/contracts.js').Recovery>> };
  const wait=async(test:()=>boolean)=>{const end=Date.now()+12000;while(Date.now()<end){if(test())return;await new Promise(r=>setTimeout(r,25));}throw Error('Native shared view condition timed out');};
  const check=(value:boolean,label:string)=>{if(!value)throw Error(label);passed.push(label);};
  const command=(action:string)=>window.__openMarkdownLane.command({action});
  const pane=(mirror=false)=>document.querySelector<HTMLElement>(`.document-editor[data-view-id="${mirror?'mirror:':''}webkit-fixture"]`)!;
  const root=()=>document.querySelector<HTMLElement>('.document-editor[data-active="true"] .rich-document')!;
  const readSource=()=>[...pane(true).querySelectorAll('.source-surface .cm-line')].map(n=>n.textContent).join('\n');
  function point(text:string) {
    root().focus();const walker=document.createTreeWalker(root(),NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode()))if(!node.parentElement!.closest('.md-meta,.md-view')&&(node as Text).data.includes(text)) {getSelection()!.collapse(node,(node as Text).data.indexOf(text));document.dispatchEvent(new Event('selectionchange'));return node as Text;}
    throw Error('Missing native text '+text);
  }
  window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  let original='';
  try {
    await wait(()=>!!root()?.querySelector('h1'));const restored=await desktop.restore();if(!restored.ok||!restored.value)throw Error('Missing native fixture');original=restored.value.documents[0].content;
    command('split-same');await wait(()=>document.querySelectorAll('.document-editor:not([hidden]) .editor-surface[data-editor-ready="true"]').length===2&&!!pane(true).querySelector('.source-surface:not([hidden]) .cm-content'));
    check(document.querySelectorAll('[role="tab"]').length===1,'native same-document split retains one tab and one document');
    for(const needle of ['普通','粗体','任务','B']) {
      const node=point(needle),before=node.data,at=getSelection()!.anchorOffset,target=node.parentElement!;
      target.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      command('other-pane');check(pane().dataset.active==='true','native composition blocks switching to the source twin: '+needle);
      node.data=before.slice(0,at)+'nihao'+before.slice(at);target.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'你好'}));
      await Promise.resolve();node.data=before.slice(0,at)+'你好'+before.slice(at);getSelection()!.collapse(node,at+2);target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'你好'}));
      const expected=original.replace(needle,'你好'+needle);await wait(()=>readSource()===expected);
      command('other-pane');await wait(()=>pane(true).dataset.active==='true');command('undo');await wait(()=>readSource()===original);
      command('redo');await wait(()=>readSource()===expected);command('undo');await wait(()=>readSource()===original);
      command('other-pane');await wait(()=>pane().dataset.active==='true');
      check(true,'native delayed composition mirrors exact Markdown and shares single undo/redo: '+needle);
    }
    command('other-pane');await wait(()=>pane(true).dataset.active==='true');
    const source=pane(true).querySelector<HTMLElement>('.cm-content')!;source.focus();const line=source.querySelector('.cm-line')!.firstChild!;getSelection()!.collapse(line,0);document.execCommand('insertText',false,'源码中文😀');
    await wait(()=>readSource().startsWith('源码中文😀'));command('other-pane');await wait(()=>pane().dataset.active==='true');command('undo');await wait(()=>readSource()===original);
    check(true,'native source edits share undo with the rendered twin');
    command('save');await new Promise(r=>setTimeout(r,1000));const recovered=await desktop.testRecovery();if(!recovered.ok||!recovered.value)throw Error('No native recovery');
    check(recovered.value.workspace?.sameDocument===true&&recovered.value.documents.length===1,'native store persists one shared document and its same-document layout');
    check(recovered.value.documents[0].editorViews?.secondary?.rendered===false&&recovered.value.documents[0].editorViews?.primary?.rendered===true,'native Codable session preserves independent view modes');
    pane(true).querySelector<HTMLButtonElement>('.pane-heading .icon-button')!.click();await wait(()=>document.querySelectorAll('.document-editor:not([hidden])').length===1);
    point('普通');root().dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertText',data:'回收后保留'}));
    for(let i=0;i<8;i++){command('new');await wait(()=>document.querySelectorAll('[role="tab"]').length===i+2);root().dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertText',data:'后台草稿 '+i}));}
    check(document.querySelectorAll('.document-editor').length<=3&&!pane(),'native background eviction bounds mounted editors');
    document.querySelector<HTMLButtonElement>('[role="tab"][aria-label="WebKit-fixture.md"]')!.click();await wait(()=>!!pane()&&pane().dataset.active==='true');command('undo');
    command('source');await wait(()=>!!pane().querySelector('.source-surface:not([hidden])'));
    check([...pane().querySelectorAll('.source-surface .cm-line')].map(n=>n.textContent).join('\n')===original,'native evicted buffer retains exact undo history');command('source');command('save');
    check(errors.length===0,'native shared views and eviction produce no runtime errors');
    return { sharedViewsOnly:true,passed,errors,source:original };
  }catch(error){const peer=pane(true);return {sharedViewsOnly:true,passed,errors,error:String(error),source:original,actualSource:peer?[...peer.querySelectorAll('.source-surface .cm-line')].map(n=>n.textContent).join('\n'):null,primaryText:pane()?.querySelector('.rich-document')?.textContent?.slice(0,300),activeView:document.querySelector<HTMLElement>('.document-editor[data-active="true"]')?.dataset.viewId};}
}
