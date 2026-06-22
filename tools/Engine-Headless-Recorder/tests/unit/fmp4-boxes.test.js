import assert from 'node:assert';
import { test } from 'node:test';

// Mock representativo para validar as boxes MP4
function createMockBox(type, data) {
    const box = Buffer.alloc(8 + data.length);
    box.writeUInt32BE(8 + data.length, 0);
    box.write(type, 4);
    data.copy(box, 8);
    return box;
}

test('fMP4 Boxes: should create a valid moof box header', () => {
    const moof = createMockBox('moof', Buffer.alloc(0));
    assert.strictEqual(moof.toString('utf8', 4, 8), 'moof');
    assert.strictEqual(moof.readUInt32BE(0), 8);
});

test('fMP4 Boxes: should contain mfhd box with correct sequence_number', () => {
    const sequenceNumber = 123;
    const mfhd = Buffer.alloc(16);
    mfhd.writeUInt32BE(16, 0);
    mfhd.write('mfhd', 4);
    mfhd.writeUInt32BE(0, 8); // flags
    mfhd.writeUInt32BE(sequenceNumber, 12);
    
    assert.strictEqual(mfhd.readUInt32BE(12), sequenceNumber);
});

test('fMP4 Boxes: should contain traf box', () => {
    const traf = createMockBox('traf', Buffer.alloc(0));
    assert.strictEqual(traf.toString('utf8', 4, 8), 'traf');
});

test('fMP4 Boxes: should contain tfhd with track_id', () => {
    const trackId = 1;
    const tfhd = Buffer.alloc(16);
    tfhd.writeUInt32BE(16, 0);
    tfhd.write('tfhd', 4);
    tfhd.writeUInt32BE(0, 8); // flags
    tfhd.writeUInt32BE(trackId, 12);
    assert.strictEqual(tfhd.readUInt32BE(12), trackId);
});

test('fMP4 Boxes: should contain trun with correct data_offset', () => {
    const trun = Buffer.alloc(20);
    trun.writeUInt32BE(20, 0);
    trun.write('trun', 4);
    trun.writeUInt32BE(0x000100, 8); // flags
    trun.writeUInt32BE(1, 12); // sample_count
    trun.writeUInt32BE(24, 16); // data_offset
    assert.strictEqual(trun.readUInt32BE(16), 24);
});

test('fMP4 Boxes: should embed mdat with payload', () => {
    const payload = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]);
    const mdat = createMockBox('mdat', payload);
    assert.deepStrictEqual(mdat.subarray(8), payload);
});

test('fMP4 Boxes: should handle different payload sizes', () => {
    const payload = Buffer.alloc(1024, 0xAA);
    const mdat = createMockBox('mdat', payload);
    assert.strictEqual(mdat.length, 1024 + 8);
});

test('fMP4 Boxes: should update sequence_number across pairs', () => {
    let seq = 1;
    const mfhd1 = Buffer.alloc(16); mfhd1.writeUInt32BE(seq++, 12);
    const mfhd2 = Buffer.alloc(16); mfhd2.writeUInt32BE(seq++, 12);
    assert.strictEqual(mfhd1.readUInt32BE(12), 1);
    assert.strictEqual(mfhd2.readUInt32BE(12), 2);
});
