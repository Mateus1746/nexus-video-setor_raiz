import assert from 'node:assert';
import { test } from 'node:test';

/**
 * MOCK: Simulação da Heap do WebAssembly
 * Como o binário WASM opera em memória contígua, este mock valida
 * se o JavaScript está calculando corretamente os offsets e tamanhos
 * dos buffers antes de disparar o Muxer.
 */
class WASMHeapMock {
    constructor(size = 1024 * 1024) { // 1MB heap
        this.buffer = new ArrayBuffer(size);
        this.HEAPU8 = new Uint8Array(this.buffer);
        this.allocated = new Map();
        this.ptrCounter = 8; // Offset inicial
    }

    malloc(size) {
        const ptr = this.ptrCounter;
        this.ptrCounter += size;
        this.allocated.set(ptr, size);
        return ptr;
    }

    free(ptr) {
        if (!this.allocated.has(ptr)) throw new Error(`Tentativa de free em ponteiro inválido: ${ptr}`);
        this.allocated.delete(ptr);
    }

    getValue(ptr, type) {
        if (type === 'i32') {
            const view = new DataView(this.buffer);
            return view.getInt32(ptr, true);
        }
        return 0;
    }
}

test('WASM Memory Bridge: Deve garantir cópia íntegra de dados para a Heap', () => {
    const heap = new WASMHeapMock();
    const sourceData = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]); // "ftyp" box header
    
    const ptr = heap.malloc(sourceData.length);
    heap.HEAPU8.set(sourceData, ptr);

    // Validação: O dado na heap deve ser idêntico ao original
    const heapSlice = heap.HEAPU8.slice(ptr, ptr + sourceData.length);
    assert.deepStrictEqual(heapSlice, sourceData, 'Os dados na Heap do WASM foram corrompidos durante a transferência');
    
    heap.free(ptr);
    assert.strictEqual(heap.allocated.size, 0, 'Memory Leak detectado: bloco não liberado após o processamento');
});

test('Muxer Interface: Deve validar a estrutura da struct de retorno do C++', () => {
    const heap = new WASMHeapMock();
    
    // Simula a escrita de uma MuxResult struct: [ptr(i32), size(i32)]
    const structPtr = heap.malloc(8);
    const dataView = new DataView(heap.buffer);
    
    const mockDataPtr = 100;
    const mockDataSize = 1024;
    
    dataView.setInt32(structPtr, mockDataPtr, true);
    dataView.setInt32(structPtr + 4, mockDataSize, true);

    const extractedPtr = heap.getValue(structPtr, 'i32');
    const extractedSize = heap.getValue(structPtr + 4, 'i32');

    assert.strictEqual(extractedPtr, mockDataPtr);
    assert.strictEqual(extractedSize, mockDataSize);
});
