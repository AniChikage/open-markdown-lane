// Explicit 0.26.2 cleanup, after publication and public AppImageUpdate acceptance.
// Keep source tags and Git history; retire only the reviewed release IDs below.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import manifest from './superseded-release-manifest.json' with {type:'json'};
const repo='AniChikage/open-markdown-lane',version='0.26.2',tag='v'+version;
assert.equal(process.env.GH_REPO,repo);
assert.equal(process.env.RETIRE_EXACT_RELEASES,tag);
assert.equal(process.env.GITHUB_EVENT_NAME,'workflow_dispatch');
const api=(endpoint:string)=>JSON.parse(execFileSync('gh',['api',`repos/${repo}/${endpoint}`],{encoding:'utf8'}));
const release=api(`releases/tags/${tag}`);
assert.equal(release.draft,false);assert.equal(release.prerelease,false);
assert.equal(release.name,'Open Markdown Lane '+version);
assert.equal(api('releases/latest').id,release.id);
assert.equal(api(`commits/${tag}`).sha,process.env.GITHUB_SHA);
const names=['arm64.dmg','arm64.zip','windows-x64-Setup.exe','windows-x64.zip','linux-x64.deb','x86_64.AppImage','x86_64.AppImage.zsync'].map(s=>'Open-Markdown-Lane-'+version+'-'+s);
assert.deepEqual(release.assets.map((asset:{name:string})=>asset.name).sort(),[...names,'SHA256SUMS.txt'].sort());
const root=await mkdtemp(path.join(os.tmpdir(),'lane-retire-releases-'));
const qa=process.env.OPEN_MARKDOWN_LANE_QA_DIR || path.join(root,'evidence');await mkdir(qa,{recursive:true});
try {
  execFileSync('gh',['release','download',tag,'--repo',repo,'--dir',root],{stdio:'inherit'});
  const rows=(await readFile(path.join(root,'SHA256SUMS.txt'),'utf8')).trim().split('\n').map(line=>/^([a-f0-9]{64})  (.+)$/.exec(line));
  assert.ok(rows.every(Boolean));assert.deepEqual(rows.map(row=>row![2]).sort(),[...names].sort());
  const verified=[];
  for(const row of rows){const [,expected,name]=row!;const file=path.join(root,name);const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);assert.equal(hash.digest('hex'),expected);const asset=release.assets.find((a:{name:string})=>a.name===name);assert.equal((await stat(file)).size,asset.size);assert.equal(asset.digest,'sha256:'+expected);verified.push({name,sha256:expected,size:asset.size});}
  const list=()=>JSON.parse(execFileSync('gh',['api','--paginate','--slurp',`repos/${repo}/releases?per_page=100`],{encoding:'utf8'})).flat() as {id:number;tag_name:string}[];
  const current=list(),retired=[];
  // Save the public metadata before deletion; no credentials or binary copies.
  await writeFile(path.join(qa,'prior-release-metadata.json'),JSON.stringify(manifest.map(item=>current.some(r=>r.id===item.id)?api(`releases/${item.id}`):item),null,2));
  for(const item of manifest){assert.notEqual(item.tag,tag);const found=current.find(r=>r.id===item.id);if(!found)continue;assert.equal(found.tag_name,item.tag);assert.notEqual(found.id,release.id);assert.equal(api('releases/latest').id,release.id);execFileSync('gh',['api','--method','DELETE',`repos/${repo}/releases/${found.id}`],{stdio:'inherit'});retired.push(item);console.log('Retired superseded release '+item.tag+'; source tag retained.');}
  const remaining=list();assert.ok(remaining.some(r=>r.id===release.id));assert.ok(remaining.every(r=>!manifest.some(old=>old.id===r.id)));
  await writeFile(path.join(qa,'retirement-results.json'),JSON.stringify({version,source:process.env.GITHUB_SHA,verified,retired,sourceTagsRetained:true,passed:true},null,2));
  console.log('PASS: verified replacement downloads before retiring the exact superseded releases.');
}finally{await rm(root,{recursive:true,force:true});}
