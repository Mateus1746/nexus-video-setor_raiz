class CoreRecorder {
  constructor(options = {}) {
    this.fps = options.fps ?? 60;
    this.width = options.width ?? 1080;
    this.height = options.height ?? 1080;
    this.bitrate = options.bitrate ?? 5000000; // 5 Mbps
    this.status = 'IDLE';
    this.frameCount = 0;
    this.encoder = null;
    this.worker = null;
    this.frameDurationMs = 1000 / this.fps;
  }

  async initialize() {
    this.status = 'INITIALIZING';
    
    // Iniciar o worker do Muxer usando caminho absoluto na origem HTTP (modo clássico para suportar importScripts)
    this.worker = new Worker('/Engine-Headless-Recorder/src/browser/muxer-worker.js');
    
    // Configurar listener para saber quando o worker e o OPFS estão prontos
    const workerReadyPromise = new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        if (e.data.status === 'STREAM_READY') {
          resolve();
        }
      };
    });

    // Enviar mensagem para inicializar a stream no worker
    this.worker.postMessage({ type: 'INIT_MUSE_STREAM' });
    
    await workerReadyPromise;
    console.log('[CoreRecorder] Worker Muxer e OPFS prontos para gravação.');

    // Configurar o VideoEncoder de WebCodecs
    const init = {
      output: (chunk, metadata) => {
        // Se for o primeiro frame ou houver metadados de codec (SPS/PPS), envia ao Worker para gerar o Initialization Segment
        if (metadata && metadata.decoderConfig && metadata.decoderConfig.description) {
          const desc = metadata.decoderConfig.description;
          // Se for uma visualização de array (Uint8Array), extrai o buffer correspondente
          const avccBuffer = desc.buffer ? desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength) : desc.slice(0);
          
          this.worker.postMessage({
            type: 'INIT_METADATA',
            payload: {
              avccBuffer: avccBuffer,
              width: this.width,
              height: this.height
            }
          }, [avccBuffer]);
        }

        const buffer = new ArrayBuffer(chunk.byteLength);
        chunk.copyTo(buffer);
        
        // Enviar os dados binários encapsulados em H.264 para o worker
        this.worker.postMessage({
          type: 'ENCODED_CHUNK',
          payload: {
            dataBuffer: buffer,
            duration: chunk.duration ?? (this.frameDurationMs * 1000), // em microssegundos
            isKeyframe: chunk.type === 'key'
          }
        }, [buffer]); // Transferir a propriedade do buffer para evitar cópias de memória
      },
      error: (e) => {
        console.error('[CoreRecorder] Erro no VideoEncoder:', e);
      }
    };

    const config = {
      codec: 'avc1.42e028', // H.264 Baseline Profile, Level 4.0 (suporta 1080x1080)
      width: this.width,
      height: this.height,
      bitrate: this.bitrate,
      framerate: this.fps,
      latencyMode: 'quality'
    };

    this.encoder = new VideoEncoder(init);
    this.encoder.configure(config);
    this.status = 'READY';
  }

  start() {
    if (this.status !== 'READY') throw new Error('[CoreRecorder] Gravador não está pronto ou já está rodando');
    this.status = 'RECORDING';
    this.frameCount = 0;
    console.log('[CoreRecorder] Gravação iniciada.');
  }

  async recordFrame(canvas, timestampMs) {
    if (this.status !== 'RECORDING') {
      console.warn('[CoreRecorder] Tentativa de gravar frame fora do estado de gravação.');
      return;
    }

    const timestampUs = timestampMs * 1000; // Converter milissegundos do renderizador para microssegundos
    
    // Criar o frame WebCodecs usando o canvas
    const frame = new VideoFrame(canvas, { timestamp: timestampUs });
    
    // Forçar Keyframe a cada 60 frames (1 segundo) para indexação rápida no container fMP4
    const isKeyframe = this.frameCount % 60 === 0;
    this.encoder.encode(frame, { keyFrame: isKeyframe });
    
    // Fechar imediatamente para liberar VRAM no browser headless
    frame.close();
    this.frameCount++;
  }

  async stop() {
    if (this.status !== 'RECORDING') throw new Error('[CoreRecorder] Gravação não está em andamento');
    this.status = 'STOPPING';
    
    // Aguardar que todos os frames restantes sejam codificados
    await this.encoder.flush();
    this.encoder.close();
    
    // Configurar Promise para esperar o worker fechar o arquivo OPFS
    const workerClosedPromise = new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        if (e.data.status === 'STREAM_CLOSED') {
          resolve();
        }
      };
    });

    // Enviar mensagem de finalização para fechar o AccessHandle de forma limpa
    this.worker.postMessage({ type: 'CLOSE_STREAM' });
    
    await workerClosedPromise;
    
    // Fechar o worker
    this.worker.terminate();
    this.status = 'STOPPED';
    console.log(`[CoreRecorder] Gravação finalizada de forma limpa. Total de frames gravados: ${this.frameCount}`);
  }
}

// Exportar globalmente para acesso fácil via Puppeteer
window.CoreRecorder = CoreRecorder;
