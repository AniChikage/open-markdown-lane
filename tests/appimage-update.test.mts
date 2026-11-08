import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {appImageName,appImageDownloadURL,appImageUpdateInformation,embedAppImageUpdateInformation,readAppImageUpdateInformation,validateZsync} from '../scripts/appimage-update.mts';

function fixture() {
  const bytes=Buffer.alloc(1024);Buffer.from([127,69,76,70,2,1,1,0,65,73,2]).copy(bytes);bytes.writeUInt16LE(62,18);
  bytes.writeBigUInt64LE(128n,40);bytes.writeUInt16LE(64,58);bytes.writeUInt16LE(4,60);bytes.writeUInt16LE(1,62);
  const names=Buffer.from('\0.shstrtab\0.upd_info\0.sha256_sig\0');names.copy(bytes,400);
  for(const [index,name,offset,size] of [[1,1,400,names.length],[2,11,512,256],[3,21,768,64]]) {
    const entry=128+index*64;bytes.writeUInt32LE(name,entry);bytes.writeBigUInt64LE(BigInt(offset),entry+24);bytes.writeBigUInt64LE(BigInt(size),entry+32);
  }
  bytes.write('payload stays intact',900);return bytes;
}
test('AppImage names and stable update channel follow AppImage conventions',()=>{
  assert.equal(appImageName('0.24.5'),'Open-Markdown-Lane-0.24.5-x86_64.AppImage');
  assert.equal(appImageDownloadURL('0.24.5'),'https://github.com/AniChikage/open-markdown-lane/releases/download/v0.24.5/Open-Markdown-Lane-0.24.5-x86_64.AppImage');
  assert.equal(appImageUpdateInformation,'gh-releases-zsync|AniChikage|open-markdown-lane|latest|Open-Markdown-Lane-*-x86_64.AppImage.zsync');
  assert.throws(()=>appImageName('../0.1.0'));
});
test('embedding update information changes only the existing reserved ELF section',()=>{
  const bytes=fixture(),before=Buffer.from(bytes);assert.equal(readAppImageUpdateInformation(bytes),'');
  const region=embedAppImageUpdateInformation(bytes);assert.deepEqual(region,{offset:512,length:256});
  assert.equal(readAppImageUpdateInformation(bytes),appImageUpdateInformation);
  assert.deepEqual(bytes.subarray(0,512),before.subarray(0,512));assert.deepEqual(bytes.subarray(768),before.subarray(768));
  assert.throws(()=>embedAppImageUpdateInformation(bytes,'x'.repeat(256)));
  bytes[768]=1;assert.throws(()=>embedAppImageUpdateInformation(bytes),/signature/);
});
test('malformed ELF or unsafe update information is rejected before mutation',()=>{
  assert.throws(()=>embedAppImageUpdateInformation(Buffer.alloc(128)));
  const bytes=fixture();bytes.writeBigUInt64LE(9999999n,40);assert.throws(()=>embedAppImageUpdateInformation(bytes));
  assert.throws(()=>embedAppImageUpdateInformation(fixture(),'gh-releases-zsync|bad\nvalue'));
});
test('zsync control must name, size, hash and cover the exact published image',()=>{
  const image=fixture(),name=appImageName('0.24.5'),url=appImageDownloadURL('0.24.5');
  const header=`zsync: 0.6.2\nFilename: ${name}\nBlocksize: 2048\nLength: ${image.length}\nHash-Lengths: 1,2,3\nURL: ${url}\nSHA-1: ${createHash('sha1').update(image).digest('hex')}\n\n`;
  const control=Buffer.concat([Buffer.from(header),Buffer.alloc(5)]);assert.equal(validateZsync(control,image,name,url).bytes,image.length);
  assert.throws(()=>validateZsync(control,image,name+'.wrong',url));
  assert.throws(()=>validateZsync(control,Buffer.concat([image,Buffer.from('x')]),name,url));
  assert.throws(()=>validateZsync(control.subarray(0,control.length-1),image,name,url));
});
