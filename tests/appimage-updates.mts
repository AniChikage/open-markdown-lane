import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,chmod,stat,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import pkg from '../package.json' with {type:'json'};
import {appImageName,appImageUpdateInformation,appImageDownloadURL,readAppImageUpdateInformation,validateZsync} from '../scripts/appimage-update.mts';
import {prepareAppImageUpdater,updaterVersion,updaterSHA256} from '../scripts/appimage-updater-tool.mts';

assert.equal(process.platform,'linux');
const root=await mkdtemp(path.join(os.tmpdir(),'lane-appimage-update-'));
const qa=process.env.OPEN_MARKDOWN_LANE_QA_DIR || root;await mkdir(qa,{recursive:true});
const name=appImageName(pkg.version),imageFile=path.resolve('release/linux',name);
const image=await readFile(imageFile),control=await readFile(imageFile+'.zsync');
const sha256=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
assert.equal(readAppImageUpdateInformation(image),appImageUpdateInformation);
const metadata=validateZsync(control,image,name,appImageDownloadURL(pkg.version));
const previous=JSON.parse(await readFile('build/upgrade-fixtures/appimage.json','utf8'));
const previousBytes=await readFile(previous.file);assert.equal(sha256(previousBytes),previous.sha256);
const updater=await prepareAppImageUpdater();
async function run(args:string[]) {
  return await new Promise<{code:number|null;stdout:string;stderr:string}>((resolve,reject)=>{
    const child=spawn(updater,args,{cwd:root,env:{...process.env,NO_COLOR:'1'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
    child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',reject);
    const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('AppImageUpdate exceeded 180 seconds'));},180000);
    child.once('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});
  });
}
let servedControl=control,ranges=0,downloaded=0;
const server=createServer((request,response)=>{
  if(request.url==='/update.zsync') {response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':servedControl.length});response.end(request.method==='HEAD'?undefined:servedControl);return;}
  if(request.url!=='/'+name){response.writeHead(404);response.end();return;}
  const headers={'Content-Type':'application/octet-stream','Accept-Ranges':'bytes'};
  if(!request.headers.range){response.writeHead(200,{...headers,'Content-Length':image.length});if(request.method==='HEAD')response.end();else{downloaded+=image.length;response.end(image);}return;}
  const match=/^bytes=(\d+-\d*(?:,\s*\d+-\d*)*)$/.exec(request.headers.range);
  const parts=match?.[1].split(',').map(part=>{const [start,end]=part.trim().split('-');return {start:Number(start),end:Math.min(end?Number(end):image.length-1,image.length-1)};});
  if(!parts?.length||parts.some(p=>p.start<0||p.start>p.end||p.start>=image.length)){response.writeHead(416,{'Content-Range':`bytes */${image.length}`});response.end();return;}
  ranges++;downloaded+=parts.reduce((n,p)=>n+p.end-p.start+1,0);
  if(parts.length===1){const p=parts[0];response.writeHead(206,{...headers,'Content-Range':`bytes ${p.start}-${p.end}/${image.length}`,'Content-Length':p.end-p.start+1});response.end(image.subarray(p.start,p.end+1));return;}
  const boundary='lane_owned_range_boundary';
  response.writeHead(206,{...headers,'Content-Type':'multipart/byteranges; boundary='+boundary});
  for(const p of parts){response.write(`--${boundary}\r\nContent-Type: application/octet-stream\r\nContent-Range: bytes ${p.start}-${p.end}/${image.length}\r\n\r\n`);response.write(image.subarray(p.start,p.end+1));response.write('\r\n');}response.end(`--${boundary}--\r\n`);
});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
const controlURL=base+'/update.zsync',targetURL=base+'/'+name;
// Only redirect the URL of this owned HTTP fixture. All image block checksums
// remain exactly those in the control file produced for the release.
const headerEnd=control.indexOf('\n\n');
servedControl=Buffer.concat([Buffer.from(control.toString('ascii',0,headerEnd).replace('URL: '+appImageDownloadURL(pkg.version),'URL: '+targetURL)+'\n\n'),control.subarray(headerEnd+2)]);
validateZsync(servedControl,image,name,targetURL);
const checks:string[]=[],logs:Record<string,unknown>={};
try {
  const seed=path.join(root,'previous.AppImage');await copyFile(previous.file,seed);await chmod(seed,0o755);
  const check=await run(['-j','-u','zsync|'+controlURL,seed]);logs.check=check;assert.equal(check.code,1,check.stderr);
  const update=await run(['-r','-u','zsync|'+controlURL,seed]);logs.update=update;assert.equal(update.code,0,update.stderr);
  const result=path.join(root,name);assert.equal(sha256(await readFile(result)),sha256(image));assert.equal(readAppImageUpdateInformation(await readFile(result)),appImageUpdateInformation);
  assert.equal(await stat(seed).then(()=>true,()=>false),false);assert.ok(ranges>0);assert.ok(downloaded<image.length,'Updater must reuse old blocks instead of downloading the entire image');
  checks.push('Official AppImageUpdate detects, delta-updates and removes an isolated prior public AppImage only after the result matches the release SHA256.');
  const savedDownloaded=downloaded,savedRanges=ranges;
  const current=await run(['-j','-u','zsync|'+controlURL,result]);logs.current=current;assert.equal(current.code,0,current.stderr);
  checks.push('Checking the resulting image again reports no update.');
  const failure=path.join(root,'corruption-test');await mkdir(failure);const badSeed=path.join(failure,'previous.AppImage');await copyFile(previous.file,badSeed);await chmod(badSeed,0o755);
  servedControl=Buffer.from(servedControl);const originalHash=createHash('sha1').update(image).digest('hex');
  const hashAt=servedControl.indexOf('SHA-1: '+originalHash);assert.ok(hashAt>=0);servedControl.write('0'.repeat(40),hashAt+7,'ascii');
  const rejected=await run(['-r','-u','zsync|'+controlURL,badSeed]);logs.corrupt=rejected;assert.notEqual(rejected.code,0);assert.equal(sha256(await readFile(badSeed)),previous.sha256);
  checks.push('A mismatched final checksum is rejected and the previous AppImage is retained.');
  assert.equal(sha256(await readFile(previous.file)),previous.sha256);
  await writeFile(path.join(qa,'appimage-update-results.json'),JSON.stringify({version:pkg.version,priorVersion:previous.tag,updateInformation:appImageUpdateInformation,metadata,updaterVersion,updaterSHA256,targetSHA256:sha256(image),rangeRequests:savedRanges,downloadedImageBytes:savedDownloaded,imageBytes:image.length,checks,logs,fixture:'real updater; loopback URL override on an unchanged copy of the prior public image; release block checksums unchanged'},null,2));
  for(const check of checks)console.log('PASS: '+check);
} finally {await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});}
