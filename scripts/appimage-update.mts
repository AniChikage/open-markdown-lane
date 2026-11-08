import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export function appImageName(version: string) {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  return `Open-Markdown-Lane-${version}-x86_64.AppImage`;
}
export const appImageUpdateInformation = 'gh-releases-zsync|AniChikage|open-markdown-lane|latest|Open-Markdown-Lane-*-x86_64.AppImage.zsync';
export const appImageDownloadURL = (version: string) => `https://github.com/AniChikage/open-markdown-lane/releases/download/v${version}/${appImageName(version)}`;

function elfSections(bytes: Buffer) {
  assert.ok(bytes.length >= 64 && bytes.subarray(0,4).equals(Buffer.from([0x7f,69,76,70])), 'Expected ELF executable');
  assert.equal(bytes[4],2,'Expected ELF64'); assert.equal(bytes[5],1,'Expected little endian');
  assert.equal(bytes.readUInt16LE(18),62,'Expected x86_64');
  assert.ok(bytes.subarray(8,11).equals(Buffer.from([65,73,2])),'Expected type-2 AppImage');
  const integer = (offset: number) => {const value=bytes.readBigUInt64LE(offset);assert.ok(value<=BigInt(Number.MAX_SAFE_INTEGER));return Number(value);};
  const table=integer(40),entrySize=bytes.readUInt16LE(58),count=bytes.readUInt16LE(60),stringsIndex=bytes.readUInt16LE(62);
  assert.equal(entrySize,64);assert.ok(count>0 && count<=1024 && stringsIndex<count);
  assert.ok(table>=64 && table+count*entrySize<=bytes.length,'ELF section table is out of bounds');
  const region = (index:number) => {
    const entry=table+index*entrySize,offset=integer(entry+24),length=integer(entry+32);
    // Only file-backed sections needed below; SHT_NOBITS can extend past EOF.
    return {entry,offset,length};
  };
  const strings=region(stringsIndex);assert.ok(strings.offset+strings.length<=bytes.length);
  const names=bytes.subarray(strings.offset,strings.offset+strings.length),sections=new Map<string,{offset:number;length:number}>();
  for(let i=0;i<count;i++) {
    const section=region(i),nameOffset=bytes.readUInt32LE(section.entry);assert.ok(nameOffset<names.length);
    const end=names.indexOf(0,nameOffset);assert.ok(end>=nameOffset);
    const name=names.toString('utf8',nameOffset,end);
    if(name==='.upd_info'||name==='.sha256_sig') {
      assert.ok(!sections.has(name),'Duplicate ELF metadata section');
      assert.ok(section.offset>=64 && section.offset+section.length<=bytes.length,'Metadata section is out of bounds');
      sections.set(name,section);
    }
  }
  return sections;
}

export function readAppImageUpdateInformation(bytes: Buffer) {
  const section=elfSections(bytes).get('.upd_info');assert.ok(section,'Missing reserved .upd_info section');
  const region=bytes.subarray(section.offset,section.offset+section.length),end=region.indexOf(0);
  return region.toString('utf8',0,end<0?region.length:end);
}

// Write only the runtime's reserved ELF bytes. Rebuilding the ELF with objcopy
// can discard the appended SquashFS image; leave every other byte untouched.
export function embedAppImageUpdateInformation(bytes: Buffer, information=appImageUpdateInformation) {
  assert.ok(/^[\x20-\x7e]+$/.test(information) && !information.includes('\n'));
  const sections=elfSections(bytes),section=sections.get('.upd_info');assert.ok(section,'Missing reserved .upd_info section');
  const signature=sections.get('.sha256_sig');
  assert.ok(!signature || bytes.subarray(signature.offset,signature.offset+signature.length).every(value=>value===0),'Refusing to invalidate an existing signature');
  assert.ok(Buffer.byteLength(information)<section.length,'Update information exceeds its reserved ELF section');
  bytes.fill(0,section.offset,section.offset+section.length);bytes.write(information,section.offset,'ascii');
  assert.equal(readAppImageUpdateInformation(bytes),information);
  return {offset:section.offset,length:section.length};
}

export function validateZsync(control: Buffer, image: Buffer, name: string, url: string) {
  const split=control.indexOf('\n\n');assert.ok(split>0 && split<65536,'Invalid zsync control header');
  const fields=new Map<string,string>();
  for(const line of control.toString('ascii',0,split).split('\n')) {
    const index=line.indexOf(': ');assert.ok(index>0);const key=line.slice(0,index);assert.ok(!fields.has(key),'Duplicate zsync field');fields.set(key,line.slice(index+2));
  }
  assert.equal(fields.get('Filename'),name);assert.equal(fields.get('URL'),url);
  assert.equal(Number(fields.get('Length')),image.length);assert.equal(fields.get('SHA-1'),createHash('sha1').update(image).digest('hex'));
  const block=Number(fields.get('Blocksize'));assert.ok(block>=1024 && block<=1048576 && (block&(block-1))===0);
  const lengths=fields.get('Hash-Lengths')?.split(',').map(Number);assert.ok(lengths?.length===3 && lengths.every(value=>Number.isInteger(value)&&value>0));
  assert.equal(control.length-split-2,Math.ceil(image.length/block)*(lengths[1]+lengths[2]),'Incomplete zsync block checksums');
  return {filename:name,bytes:image.length,sha1:fields.get('SHA-1'),blockSize:block};
}
