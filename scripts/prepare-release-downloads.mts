import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import pkg from '../package.json' with {type:'json'};
const require=createRequire(import.meta.url),releases=new Map<string,Promise<any>>();
export function verifyReleaseDownload(bytes:Buffer,expected:string) {
  if(!/^[a-f0-9]{64}$/.test(expected)||createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Release dependency SHA-256 mismatch');
}
async function request(url:string,binary=false) {
  const headers:Record<string,string>={Accept:binary?'application/octet-stream':'application/vnd.github+json'};
  if(process.env.GH_TOKEN)headers.Authorization='Bearer '+process.env.GH_TOKEN;
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error('Official release dependency HTTP '+response.status);
  return Buffer.from(await response.arrayBuffer());
}
async function seed(repo:string,tag:string,name:string,destination:string,expected:string) {
  try{verifyReleaseDownload(await readFile(destination),expected);console.log('Verified cached dependency: '+name);return;}catch{}
  const key=repo+'/'+tag;
  if(!releases.has(key))releases.set(key,request(`https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`).then(b=>JSON.parse(b.toString())));
  const release=await releases.get(key),matches=release.assets.filter((a:{name:string})=>a.name===name);
  if(matches.length!==1)throw Error('Missing or ambiguous official dependency: '+name);
  const asset=matches[0];if(asset.size>512*1024*1024)throw Error('Oversized official dependency: '+name);
  // Use the publisher's official asset API when its browser-download route is
  // unavailable. Hashes remain pinned by our locked dependencies below.
  const bytes=await request(`https://api.github.com/repos/${repo}/releases/assets/${asset.id}`,true);
  if(bytes.length!==asset.size)throw Error('Release dependency length mismatch: '+name);
  verifyReleaseDownload(bytes,expected);
  if(asset.digest)verifyReleaseDownload(bytes,String(asset.digest).replace(/^sha256:/,''));
  await mkdir(path.dirname(destination),{recursive:true});const temp=destination+'.'+process.pid+'.tmp';await writeFile(temp,bytes);await rename(temp,destination);
  console.log('Verified official release dependency: '+name);
}
export async function verifiedElectronArchive() {
  const {Cache}=await import(pathToFileURL(path.join(path.dirname(require.resolve('@electron/get')),'Cache.js')).href);
  const version=pkg.devDependencies.electron,name=`electron-v${version}-${process.platform}-${process.arch}.zip`;
  const expected=require('electron/checksums.json')[name];if(!expected)throw Error('Missing pinned Electron checksum');
  const file=new Cache().getCachePath(`https://github.com/electron/electron/releases/download/v${version}/${name}`,name);
  await seed('electron/electron','v'+version,name,file,expected);return file as string;
}
async function prepare() {
  if(!((process.platform==='darwin'&&process.arch==='arm64')||(['linux','win32'].includes(process.platform)&&process.arch==='x64')))throw Error('Unsupported release dependency target');
  await verifiedElectronArchive();
  // Electron's own installer validates its shipped checksums again and extracts
  // from the cache; no dependency source, TLS or checksum checks are patched.
  execFileSync(process.execPath,[require.resolve('electron/install.js')],{stdio:'inherit'});
  const {getCacheDirectory}=require('app-builder-lib/out/util/electronGet');
  // The same pinned toolset versions/hashes used by electron-builder 26.15.3.
  const binaries=process.platform==='darwin' ? [
    ['dmg-builder@1.2.5','dmgbuild-bundle-arm64-75c8a6c.tar.gz','793404d0c96687e27d5ee40a668d498c92e36a64d6c2906df511031adb33cbeb'],
  ] : process.platform==='win32' ? [
    ['winCodeSign-2.6.0','winCodeSign-2.6.0.7z','cdaec7154dda7cc31f88d886e2489379a0625a737d610b5ae7f62a12f16743a4'],
    ['nsis-3.0.4.1','nsis-3.0.4.1.7z','9877df902530f96357d13a7a31ae2b9df67f48b11ffc9a1700a7c961574ec5fa'],
    ['nsis-resources-3.4.1','nsis-resources-3.4.1.7z','593a9a92ef958321293ac6a2ee61e64bf1bd543142a5bd6b3d310709cc924103'],
  ] : [
    ['fpm@2.1.4','fpm-1.17.0-ruby-3.4.3-linux-amd64.7z','44b0ec6025c14ec137f56180e62675c0eae36233cdce53d0953d9c73ced8989f'],
    ['appimage-12.0.1','appimage-12.0.1.7z','d12ff7eb8f1d1ec4652ca5237a7fbdca33acc0c758045636feca62dc6ecb8ec4'],
  ];
  for(const [tag,name,hash] of binaries)await seed('electron-userland/electron-builder-binaries',tag,name,path.join(getCacheDirectory({allowEnvVarOverride:true}),tag,name),hash);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepare();
