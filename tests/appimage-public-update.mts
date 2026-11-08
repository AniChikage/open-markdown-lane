import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,chmod,stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import os from 'node:os';
import pkg from '../package.json' with {type:'json'};
import {selectUpgradeAssets,verifyUpgradeChecksum} from '../scripts/download-upgrade-fixture.mts';
import {appImageName,appImageUpdateInformation,appImageDownloadURL,readAppImageUpdateInformation,validateZsync} from '../scripts/appimage-update.mts';
import {prepareAppImageUpdater,updaterVersion,updaterSHA256} from '../scripts/appimage-updater-tool.mts';

const priorTag=process.argv[2];assert.match(priorTag,/^v\d+\.\d+\.\d+$/);assert.notEqual(priorTag,'v'+pkg.version);
const root=await mkdtemp(path.join(os.tmpdir(),'lane-public-appimage-update-'));
const qa=process.env.OPEN_MARKDOWN_LANE_QA_DIR || path.join(root,'evidence');await mkdir(qa,{recursive:true});
const execute=promisify(execFile),repo='AniChikage/open-markdown-lane';
async function get(url:string,api=false) {
  const headers:Record<string,string>={};if(api&&process.env.GH_TOKEN)headers.Authorization='Bearer '+process.env.GH_TOKEN;
  for(let attempt=0;;attempt++)try{const r=await fetch(url,{headers,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error('Download HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}catch(e){if(attempt>=2)throw e;}
}
const sha256=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
try {
  const release=JSON.parse((await get(`https://api.github.com/repos/${repo}/releases/tags/v${pkg.version}`,true)).toString());
  const prior=JSON.parse((await get(`https://api.github.com/repos/${repo}/releases/tags/${priorTag}`,true)).toString());
  const current=selectUpgradeAssets(release,'appimage'),previous=selectUpgradeAssets(prior,'appimage');
  const name=appImageName(pkg.version);assert.equal(current.installer.name,name);assert.equal(current.installer.browser_download_url,appImageDownloadURL(pkg.version));
  const manifest=(await get(current.sums.browser_download_url)).toString();
  const controlAsset=release.assets.find((a:{name:string})=>a.name===name+'.zsync');assert.ok(controlAsset);
  assert.equal(controlAsset.browser_download_url,appImageDownloadURL(pkg.version)+'.zsync');
  const image=await get(current.installer.browser_download_url),control=await get(controlAsset.browser_download_url);
  const hash=verifyUpgradeChecksum(manifest,name,image);verifyUpgradeChecksum(manifest,name+'.zsync',control);
  assert.equal(readAppImageUpdateInformation(image),appImageUpdateInformation);validateZsync(control,image,name,appImageDownloadURL(pkg.version));
  const old=await get(previous.installer.browser_download_url);verifyUpgradeChecksum((await get(previous.sums.browser_download_url)).toString(),previous.installer.name,old);
  const seed=path.join(root,'previous.AppImage');await writeFile(seed,old);await chmod(seed,0o755);
  const updater=await prepareAppImageUpdater();
  // Releases before 0.24.5 do not contain update information. This explicit
  // bootstrap uses the official tool's override; published new images then
  // discover the same stable channel using their own embedded information.
  const update=await execute(updater,['-r','-u',appImageUpdateInformation,seed],{cwd:root,timeout:240000,maxBuffer:8*1024*1024});
  const result=path.join(root,name);assert.equal(sha256(await readFile(result)),hash);assert.equal(await stat(seed).then(()=>true,()=>false),false);
  const check=await execute(updater,['--check-for-update',result],{cwd:root,timeout:180000,maxBuffer:8*1024*1024});
  await writeFile(path.join(qa,'public-appimage-update-results.json'),JSON.stringify({version:pkg.version,priorVersion:priorTag,publishedAppImage:current.installer.browser_download_url,sha256:hash,updateInformation:appImageUpdateInformation,updaterVersion,updaterSHA256,oldRemovedAfterVerifiedUpdate:true,embeddedChannelCheckPassed:true,bootstrapOverrideUsed:true,update,check},null,2));
  console.log('PASS: Official AppImageUpdate resolves the published stable channel, updates an isolated prior public image to the exact released SHA256, removes its old copy and reports no further update using embedded information.');
} finally {await rm(root,{force:true,recursive:true});}
