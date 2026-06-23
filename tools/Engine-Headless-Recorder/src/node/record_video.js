import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ler argumentos simples da linha de comando (ex: --project=olhos --duration=10)
const args = {};
process.argv.slice(2).forEach(val => {
  const parts = val.split('=');
  if (parts.length === 2 && parts[0].startsWith('--')) {
    const key = parts[0].substring(2);
    let value = parts[1];
    if (!isNaN(value)) value = Number(value);
    args[key] = value;
  }
});

// Configurações padrão com parâmetros extraídos da CLI
const PROJECT_NAME = args.project || 'olhos';
const CANVAS_SELECTOR = args.canvas || '#nox-canvas';
const DURATION_S = args.duration || 35;
const FPS = args.fps || 60;
const BITRATE = args.bitrate || 6000000;

const PORT = 8080;
const PROJECTS_BASE_DIR = path.resolve(__dirname, '../../../'); // Pasta raiz contendo Engine-Headless-Recorder e nexus_media
const OUTPUT_FILE_PATH = args.output 
  ? path.resolve(args.output) 
  : path.resolve(__dirname, `../../../nexus_media/video/${PROJECT_NAME}/genesis_final_SOTA.mp4`);

// 1. Iniciar servidor HTTP estático local para evitar restrições CORS com o OPFS e Web Workers
function startLocalServer() {
  const server = http.createServer((req, res) => {
    // Decodificar URL e remover parâmetros de consulta
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(PROJECTS_BASE_DIR, urlPath);

    // Garantir proteção contra Path Traversal
    if (!filePath.startsWith(PROJECTS_BASE_DIR)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }

      // Tipos MIME necessários para a pipeline
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
        '.mp4': 'video/mp4',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        // Cabeçalhos de segurança CORS exigidos para WebCodecs e isolamento de Workers/SharedBuffers
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[SERVER] Servidor de desenvolvimento ativo em http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

async function record() {
  const totalFrames = FPS * DURATION_S;
  const frameIntervalMs = 1000 / FPS;

  // Inicializar o servidor
  const server = await startLocalServer();
  let browser;

  try {
    console.log(`[RECORDER] Inicializando gravação para o projeto: ${PROJECT_NAME}`);
    console.log(`[RECORDER] Destino do arquivo local: ${OUTPUT_FILE_PATH}`);
    console.log(`[RECORDER] Config: ${DURATION_S}s | ${FPS} FPS | Bitrate: ${BITRATE} bps | Canvas: ${CANVAS_SELECTOR}`);

    // Iniciar Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--use-gl=swiftshader',
        '--ignore-gpu-blacklist',
        '--disable-web-security',
        '--font-render-hinting=none'
      ],
      defaultViewport: { width: 1080, height: 1080 }
    });

    const page = await browser.newPage();
    
    // Encaminhar logs e erros do console para o terminal
    page.on('console', msg => console.log(`[BROWSER LOG] ${msg.text()}`));
    page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.toString()}`));

    // Abrir a fábrica web correspondente usando o servidor local
    const projectUrl = `http://127.0.0.1:${PORT}/nexus_media/video/${PROJECT_NAME}/index.html?headless=true`;
    console.log(`[RECORDER] Navegando para ${projectUrl}`);
    await page.goto(projectUrl, { waitUntil: 'networkidle0' });

    console.log(`[RECORDER] Aguardando fontes estarem prontas...`);
    await page.evaluate(() => document.fonts.ready);
    console.log(`[RECORDER] Fontes carregadas.`);

    // 1. Injetar o CoreRecorder dinamicamente na página
    console.log(`[RECORDER] Injetando gravador na página...`);
    await page.addScriptTag({ url: `http://127.0.0.1:${PORT}/Engine-Headless-Recorder/src/browser/recorder-core.js` });

    // 2. Inicializar o gravador no contexto do browser
    console.log(`[RECORDER] Inicializando o CoreRecorder e abrindo fluxo fMP4 no OPFS...`);
    await page.evaluate(async (fpsCount, bitrateValue) => {
      window.recorder = new window.CoreRecorder({
        fps: fpsCount,
        width: 1080,
        height: 1080,
        bitrate: bitrateValue
      });
      await window.recorder.initialize();
      window.recorder.start();
    }, FPS, BITRATE);

    console.log(`[RECORDER] Iniciando loop de gravação virtual síncrona: ${totalFrames} frames...`);
    const renderStart = Date.now();

    for (let i = 0; i < totalFrames; i++) {
      const timeMs = i * frameIntervalMs;
      
      // 3. Atualizar frame e gravar usando o buffer do Canvas
      await page.evaluate(async (t, canvasSelector) => {
        // Avança a simulação física/gráfica para o tempo t se implementado
        if (typeof window.renderFrame === 'function') {
          window.renderFrame(t);
        } else if (t === 0) {
          console.warn('[RECORDER BROWSER] Alerta: window.renderFrame não está definido. A gravação prosseguirá capturando o estado do canvas.');
        }
        // Codifica os pixels gráficos no encoder (usa seletor ou fallback de canvas genérico)
        const canvas = document.querySelector(canvasSelector) || document.querySelector('canvas');
        if (!canvas) {
          throw new Error(`[RECORDER BROWSER] Canvas não encontrado com o seletor: ${canvasSelector}`);
        }
        await window.recorder.recordFrame(canvas, t);
      }, timeMs, CANVAS_SELECTOR);

      // Logs de progresso
      if ((i + 1) % FPS === 0) {
        const secRecorded = (i + 1) / FPS;
        const elapsedSec = (Date.now() - renderStart) / 1000;
        const renderFps = (i + 1) / elapsedSec;
        console.log(`[RECORDER] Progresso: ${secRecorded}/${DURATION_S}s (${i + 1}/${totalFrames} frames) | Velocidade virtual: ${renderFps.toFixed(1)} FPS`);
      }
    }

    // 4. Parar a gravação no browser (fecha o codificador e o OPFS)
    console.log(`[RECORDER] Finalizando streams e fechando arquivo fMP4...`);
    await page.evaluate(async () => {
      await window.recorder.stop();
    });

    // 5. Transferir o arquivo MP4 resultante do OPFS do browser para o disco local
    console.log(`[RECORDER] Baixando arquivo gerado do OPFS...`);
    const base64Mp4 = await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle("output_fragmented.mp4");
      const file = await fileHandle.getFile();
      console.log(`[OPFS] Tamanho do arquivo lido no navegador principal: ${file.size} bytes`);
      const arrayBuffer = await file.arrayBuffer();

      // Converte ArrayBuffer em Base64 usando blocos rápidos
      let binary = '';
      const bytes = new Uint8Array(arrayBuffer);
      const len = bytes.byteLength;
      const chunkSize = 65536;
      for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    });

    // 6. Escrever o arquivo MP4 localmente
    const videoBuffer = Buffer.from(base64Mp4, 'base64');
    fs.writeFileSync(OUTPUT_FILE_PATH, videoBuffer);
    console.log(`[RECORDER] Arquivo de vídeo gravado com sucesso em: ${OUTPUT_FILE_PATH}`);

  } finally {
    if (browser) {
      await browser.close();
    }
    server.close();
    console.log(`[RECORDER] Pipeline finalizada e recursos liberados.`);
  }
}

record().catch(err => {
  console.error('[RECORDER] Falha crítica na execução da pipeline:', err);
});
