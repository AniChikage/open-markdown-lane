import {mkdir,writeFile,chmod,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';

export const updaterVersion='2.0.0-alpha-1-20251018';
export const updaterSHA256='d976cdac667b03dee8cb23fb95ef74b042c406c5cbab3ff294d2b16efeaff84f';
export async function prepareAppImageUpdater() {
  if(process.platform!=='linux'||process.arch!=='x64')throw Error('AppImageUpdate acceptance requires Linux x64');
  const folder=path.resolve('build/appimage-updater');await mkdir(folder,{recursive:true});
  const response=await fetch(`https://github.com/AppImageCommunity/AppImageUpdate/releases/download/${updaterVersion}/appimageupdatetool-x86_64.AppImage`,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error('AppImageUpdate download HTTP '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==updaterSHA256)throw Error('AppImageUpdate checksum mismatch');
  const file=path.join(folder,'appimageupdatetool.AppImage');await writeFile(file,bytes);await chmod(file,0o755);
  await rm(path.join(folder,'squashfs-root'),{force:true,recursive:true});
  execFileSync(file,['--appimage-extract'],{cwd:folder,stdio:'ignore'});
  return path.join(folder,'squashfs-root/AppRun');
}
