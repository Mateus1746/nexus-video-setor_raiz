// Web Worker dedicado ao encapsulamento fMP4 via WebAssembly C++ e escrita no OPFS
let wasmMuxerModule = null;
let sequenceNumber = 1;
let accessHandle = null;
let fileOffset = 0;

// Promise para sincronizar a inicialização assíncrona do WASM
let wasmReadyResolve;
const wasmReadyPromise = new Promise((resolve) => {
  wasmReadyResolve = resolve;
});

// O Emscripten usa o objeto global self.Module para customizar o ciclo de vida
self.Module = {
  onRuntimeInitialized: () => {
    wasmMuxerModule = self.Module;
    wasmReadyResolve();
  }
};

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT_MUSE_STREAM') {
    try {
      console.log('[MuxerWorker] Inicializando stream e OPFS...');
      
      // 1. Inicializa o armazenamento síncrono do OPFS
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle("output_fragmented.mp4", { create: true });
      accessHandle = await fileHandle.createSyncAccessHandle();
      
      // Trunca o arquivo para garantir que comecemos com 0 bytes (limpa gravações antigas)
      accessHandle.truncate(0);
      fileOffset = 0;
      sequenceNumber = 1;
      
      // 2. Carrega o Glue Code do Emscripten para WASM
      importScripts('/Engine-Headless-Recorder/src/browser/fmp4_muxer_core.js');
      
      // 3. Aguarda o runtime do WebAssembly estar totalmente pronto
      await wasmReadyPromise;
      
      console.log('[MuxerWorker] Muxer C++ compilado para WASM carregado com sucesso!');
      self.postMessage({ status: 'STREAM_READY' });
    } catch (err) {
      console.error('[MuxerWorker] Falha crítica na inicialização:', err);
      self.postMessage({ status: 'ERROR', error: err.toString() });
    }
  }

  if (type === 'INIT_METADATA') {
    if (!wasmMuxerModule || !accessHandle) {
      console.error('[MuxerWorker] INIT_METADATA recebido sem inicialização do WASM.');
      return;
    }

    try {
      const { avccBuffer, width, height } = payload;
      console.log(`[MuxerWorker] Gerando Initialization Segment (ftyp+moov) para resolução: ${width}x${height}...`);

      const bufferSize = avccBuffer.byteLength;
      const wasmBufferPtr = wasmMuxerModule._malloc(bufferSize);
      
      const wasmHeapView = new Uint8Array(HEAPU8.buffer, wasmBufferPtr, bufferSize);
      wasmHeapView.set(new Uint8Array(avccBuffer));

      // Aloca 8 bytes para a estrutura de retorno MuxResult { data: ptr, size: uint32 }
      const retPtr = wasmMuxerModule._malloc(8);

      // Invoca a função C++ passando o retPtr como primeiro argumento (sret)
      wasmMuxerModule._create_initialization_segment(retPtr, width, height, wasmBufferPtr, bufferSize);
      
      const dataPtr = wasmMuxerModule.getValue(retPtr, 'i32');
      const size = wasmMuxerModule.getValue(retPtr + 4, 'i32');
      console.log(`[MuxerWorker Debug INIT] retPtr: ${retPtr}, dataPtr: ${dataPtr}, size: ${size}`);
      
      // Cria uma cópia nativa independente (slice) fora da heap do WASM para evitar erros do OPFS
      const outputBuffer = new Uint8Array(HEAPU8.buffer, dataPtr, size).slice(0);

      // Grava no início do arquivo OPFS
      const bytesWritten = accessHandle.write(outputBuffer, { at: 0 });
      fileOffset = bytesWritten;
      
      wasmMuxerModule._free(wasmBufferPtr);
      wasmMuxerModule._free(retPtr);
      console.log(`[MuxerWorker] Initialization Segment gravado: ${bytesWritten} bytes.`);
    } catch (err) {
      console.error('[MuxerWorker] Erro ao gravar Initialization Segment:', err);
    }
  }

  if (type === 'CLOSE_STREAM') {
    if (accessHandle) {
      try {
        console.log(`[MuxerWorker] Fechando access handle do OPFS e garantindo flush. Tamanho final: ${fileOffset} bytes.`);
        accessHandle.flush();
        accessHandle.close();
        accessHandle = null;
        console.log('[MuxerWorker] Arquivo fechado com sucesso.');
        self.postMessage({ status: 'STREAM_CLOSED' });
      } catch (err) {
        console.error('[MuxerWorker] Erro ao fechar arquivo:', err);
        self.postMessage({ status: 'ERROR', error: err.toString() });
      }
    } else {
      self.postMessage({ status: 'STREAM_CLOSED' });
    }
  }

  if (type === 'ENCODED_CHUNK') {
    if (!wasmMuxerModule || !accessHandle) {
      console.error('[MuxerWorker] Tentativa de processar chunk sem inicialização.');
      return;
    }

    try {
      const { dataBuffer, duration, isKeyframe } = payload;

      // 4. Aloca memória na Heap do WASM para transferir os dados comprimidos para o C++
      const bufferSize = dataBuffer.byteLength;
      const wasmBufferPtr = wasmMuxerModule._malloc(bufferSize);
      
      // Copia os dados do ArrayBuffer JS para a Heap do WASM (HEAPU8 é global no worker clássico)
      const wasmHeapView = new Uint8Array(HEAPU8.buffer, wasmBufferPtr, bufferSize);
      wasmHeapView.set(new Uint8Array(dataBuffer));

      // Aloca 8 bytes para a estrutura de retorno MuxResult { data: ptr, size: uint32 }
      const retPtr = wasmMuxerModule._malloc(8);

      // 5. Invoca o Muxer C++ Bare-Metal para envelopar o fragmento fMP4 (sret)
      wasmMuxerModule._create_fragment(retPtr, wasmBufferPtr, bufferSize, sequenceNumber++, duration, isKeyframe ? 1 : 0);
      
      // Lê o resultado estruturado retornado pelo C++ (MuxResult: { data: ptr, size: uint32 })
      const dataPtr = wasmMuxerModule.getValue(retPtr, 'i32');
      const size = wasmMuxerModule.getValue(retPtr + 4, 'i32');
      console.log(`[MuxerWorker Debug CHUNK] retPtr: ${retPtr}, dataPtr: ${dataPtr}, size: ${size}`);
      
      // Cria uma cópia nativa independente (slice) fora da heap do WASM para evitar erros do OPFS
      const outputBuffer = new Uint8Array(HEAPU8.buffer, dataPtr, size).slice(0);

      // 6. Escrita síncrona de altíssima performance direto no disco via OPFS usando offset explícito
      const bytesWritten = accessHandle.write(outputBuffer, { at: fileOffset });
      fileOffset += bytesWritten;

      // 7. Libera a memória alocada na Heap do WASM para evitar memory leaks
      wasmMuxerModule._free(wasmBufferPtr);
      wasmMuxerModule._free(retPtr);
    } catch (err) {
      console.error('[MuxerWorker] Erro ao processar frame codificado:', err);
    }
  }
};
