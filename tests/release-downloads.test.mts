import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyReleaseDownload} from '../scripts/prepare-release-downloads.mts';
test('release dependency verification refuses corrupt or unpinned bytes',()=>{
  const bytes=Buffer.from('owned release archive'),hash=createHash('sha256').update(bytes).digest('hex');
  assert.doesNotThrow(()=>verifyReleaseDownload(bytes,hash));
  assert.throws(()=>verifyReleaseDownload(Buffer.from('corrupt'),hash),/SHA-256 mismatch/);
  for(const invalid of ['', 'a'.repeat(63),'x'.repeat(64)])assert.throws(()=>verifyReleaseDownload(bytes,invalid),/SHA-256 mismatch/);
});
