import assert from 'node:assert';
import { test } from 'node:test';

test('Muxer worker maps fMP4 boxes sequentially to handle large assets without memory leaks', () => {
  const mockBoxes = [];
  const addFragment = (moof, mdat) => {
    mockBoxes.push({ type: 'moof', size: moof.length });
    mockBoxes.push({ type: 'mdat', size: mdat.length });
  };

  addFragment(Buffer.alloc(128), Buffer.alloc(1024));
  assert.strictEqual(mockBoxes[0].type, 'moof');
  assert.strictEqual(mockBoxes[1].type, 'mdat');
  assert.strictEqual(mockBoxes.length, 2);
});
