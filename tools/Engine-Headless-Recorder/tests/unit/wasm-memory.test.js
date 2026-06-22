import assert from 'node:assert';
import { test } from 'node:test';

class WASMHeapMock {
    constructor(size = 1024 * 1024) {
        this.buffer = new ArrayBuffer(size);
        this.HEAPU8 = new Uint8Array(this.buffer);
        this.HEAP32 = new Int32Array(this.buffer);
        this.HEAPF32 = new Float32Array(this.buffer);
        this.allocated = new Map();
        this.ptrCounter = 8;
    }

    malloc(size) {
        const ptr = this.ptrCounter;
        this.ptrCounter += size;
        this.allocated.set(ptr, size);
        return ptr;
    }

    free(ptr) {
        if (!this.allocated.has(ptr)) throw new Error('Invalid pointer');
        this.allocated.delete(ptr);
    }

    setValue(ptr, val, type) {
        if (type === 'i32') this.HEAP32[ptr >> 2] = val;
        if (type === 'f32') this.HEAPF32[ptr >> 2] = val;
    }

    getValue(ptr, type) {
        if (type === 'i32') return this.HEAP32[ptr >> 2];
        if (type === 'f32') return this.HEAPF32[ptr >> 2];
        return 0;
    }
}

test('WASM Memory: malloc and free', () => {
    const heap = new WASMHeapMock();
    const ptr = heap.malloc(16);
    assert.ok(ptr > 0);
    heap.free(ptr);
});

test('WASM Memory: double-free prevention', () => {
    const heap = new WASMHeapMock();
    const ptr = heap.malloc(16);
    heap.free(ptr);
    assert.throws(() => heap.free(ptr), /Invalid pointer/);
});

test('WASM Memory: i32 set and get', () => {
    const heap = new WASMHeapMock();
    const ptr = heap.malloc(4);
    heap.setValue(ptr, 12345, 'i32');
    assert.strictEqual(heap.getValue(ptr, 'i32'), 12345);
});

test('WASM Memory: f32 set and get', () => {
    const heap = new WASMHeapMock();
    const ptr = heap.malloc(4);
    heap.setValue(ptr, 3.14, 'f32');
    assert.ok(Math.abs(heap.getValue(ptr, 'f32') - 3.14) < 0.0001);
});

test('WASM Memory: transfer ArrayBuffer to heap', () => {
    const heap = new WASMHeapMock();
    const data = new Uint8Array([1, 2, 3]);
    const ptr = heap.malloc(3);
    heap.HEAPU8.set(data, ptr);
    assert.deepStrictEqual(heap.HEAPU8.subarray(ptr, ptr + 3), data);
});

test('WASM Memory: transfer ArrayBuffer from heap', () => {
    const heap = new WASMHeapMock();
    const data = new Uint8Array([4, 5, 6]);
    const ptr = heap.malloc(3);
    heap.HEAPU8.set(data, ptr);
    const extracted = heap.HEAPU8.slice(ptr, ptr + 3);
    assert.deepStrictEqual(extracted, data);
});

test('WASM Memory: MuxResult struct parsing', () => {
    const heap = new WASMHeapMock();
    const ptr = heap.malloc(8);
    heap.setValue(ptr, 100, 'i32');
    heap.setValue(ptr + 4, 1024, 'i32');
    assert.strictEqual(heap.getValue(ptr, 'i32'), 100);
    assert.strictEqual(heap.getValue(ptr + 4, 'i32'), 1024);
});

test('WASM Memory: memory leak detection', () => {
    const heap = new WASMHeapMock();
    heap.malloc(16);
    assert.strictEqual(heap.allocated.size, 1);
});

test('WASM Memory: invalid pointer handling', () => {
    const heap = new WASMHeapMock();
    assert.throws(() => heap.free(99999), /Invalid pointer/);
});

test('WASM Memory: ensure heap growth', () => {
    const heap = new WASMHeapMock();
    const ptr1 = heap.malloc(100);
    const ptr2 = heap.malloc(100);
    assert.ok(ptr2 > ptr1);
});
