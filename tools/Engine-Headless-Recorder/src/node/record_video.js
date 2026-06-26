import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
let _ffmpegPath = 'ffmpeg'; // fallback para sistema
try {
  const ffmpegInstaller = _require('@ffmpeg-installer/ffmpeg');
  _ffmpegPath = ffmpegInstaller.path;
  console.log(`[FFMPEG] Usando binário embutido: ${_ffmpegPath}`);
} catch {
  console.log('[FFMPEG] Binário do sistema (fallback)');
}
import os from 'node:os';
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

// ── Seleção de modo de renderização ──────────────────────────────────────────
// --mode=cpu  → usa FFmpeg + page.screenshot() com workers paralelos (padrão Jules VM)
// --mode=gpu  → usa WebCodecs (pipeline original, requer GPU)
// CPU_RENDER=1 (env var) → força modo CPU
const RENDER_MODE = args.mode || (process.env.CPU_RENDER === '1' ? 'cpu' : 'cpu');
const CPU_WORKERS = Math.max(1, Math.min(os.cpus().length, 4)); // até 4 workers
const CAPTURE_WIDTH  = Math.round((args.width  || 1280));
const CAPTURE_HEIGHT = Math.round((args.height || 720));
// ─────────────────────────────────────────────────────────────────────────────


let PORT; // assigned dynamically by startLocalServer
const PROJECTS_BASE_DIR = path.resolve(__dirname, '../../../../');
// Auto-detect entry page: Vite projects use dist/index.html, static projects use index.html
const ENTRY_PAGE = fs.existsSync(path.join(PROJECTS_BASE_DIR, 'dist/index.html')) ? '/dist/index.html' : '/index.html';
const OUTPUT_FILE_PATH = args.output 
  ? path.resolve(args.output) 
  : path.resolve(__dirname, `../../../${PROJECT_NAME}/genesis_final_SOTA.mp4`);

// Helper para servir um arquivo com headers MIME + COOP/COEP
function serveFile(res, filePath) {
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
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

// 1. Iniciar servidor HTTP estático local para evitar restrições CORS com o OPFS e Web Workers
function startLocalServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const filePath = path.join(PROJECTS_BASE_DIR, urlPath);

    if (!filePath.startsWith(PROJECTS_BASE_DIR)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    // Try project root first, fall back to dist/ for Vite build output
    const relativePath = urlPath.replace(/^\//, '');
    const tryPaths = [filePath, path.join(PROJECTS_BASE_DIR, 'dist', relativePath)];
    (function tryServe(idx) {
      if (idx >= tryPaths.length) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      fs.stat(tryPaths[idx], (err, stats) => {
        if (err || !stats.isFile()) return tryServe(idx + 1);
        serveFile(res, tryPaths[idx]);
      });
    })(0);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      PORT = server.address().port;
      console.log(`[SERVER] Servidor de desenvolvimento ativo em http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// MODO CPU: FFmpeg + page.screenshot() paralelo
// Evita WebCodecs em modo software (lento). Usa x264 ultrafast via FFmpeg pipe.
// ══════════════════════════════════════════════════════════════════════════════
async function renderChunk(browser, projectUrl, canvasSelector, frameIndices, frameIntervalMs, captureWidth, captureHeight) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.toString()}`));

  await page.goto(projectUrl, { waitUntil: 'load', timeout: 30000 });

  // Wait for fonts (3s timeout)
  await page.evaluate(() => Promise.race([
    document.fonts.ready,
    new Promise(r => setTimeout(r, 3000))
  ]));

  // Wait for renderFrame hook to be available (some projects set it async)
  await page.evaluate(async () => {
    if (typeof window.initializeScene === 'function') await window.initializeScene();
    while (typeof window.renderFrame !== 'function') {
      await new Promise(r => setTimeout(r, 50));
    }
  });

  const frames = [];
  for (const frameIndex of frameIndices) {
    const timeMs = frameIndex * frameIntervalMs;
    try {
      await page.evaluate((t) => { window.renderFrame(t); }, timeMs);
      const jpeg = await page.screenshot({
        type: 'jpeg',
        quality: 70,
        captureBeyondViewport: false
      });
      frames.push({ frameIndex, jpeg });
    } catch (ssErr) {
      console.error(`[RENDER] Screenshot error at frame ${frameIndex}: ${ssErr.message}`);
      break;
    }
  }
  await context.close();
  return frames;
}

async function renderAllFrames(browser, projectUrl, canvasSelector, totalFrames, frameIntervalMs, captureWidth, captureHeight) {
  const CHUNK_SIZE = 100; // 100 frames (~4s) — Chrome RSS stays at 63MB (testado), elimina overhead de contexto
  const results = [];
  for (let start = 0; start < totalFrames; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, totalFrames);
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    console.log(`[RENDER] Chunk ${start}-${end-1} (${indices.length} frames)`);
    const chunkFrames = await renderChunk(browser, projectUrl, canvasSelector, indices, frameIntervalMs, captureWidth, captureHeight);
    results.push(chunkFrames);
  }
  return results.flat().sort((a, b) => a.frameIndex - b.frameIndex);
}

async function recordCPU() {
  const totalFrames  = Math.ceil(FPS * DURATION_S);
  const frameIntervalMs = 1000 / FPS;
  const server = await startLocalServer();
  let browser;

  // Garantir que os assets Vite estão compilados antes de iniciar o browser
  try {
    const projectRoot = path.resolve(__dirname, '../../../..');
    console.log('[CPU-RECORDER] Executando npm run build para compilar assets Vite...');
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit', timeout: 120000 });
    console.log('[CPU-RECORDER] Build concluído.');
  } catch (buildErr) {
    console.warn(`[CPU-RECORDER] Build falhou (continuando mesmo assim): ${buildErr.message}`);
  }

  try {
    console.log(`[CPU-RECORDER] Iniciando modo CPU (renderização em página única)`);
    console.log(`[CPU-RECORDER] Resolução de captura: ${CAPTURE_WIDTH}x${CAPTURE_HEIGHT} → upscale 1920x1080`);
    console.log(`[CPU-RECORDER] Config: ${DURATION_S}s | ${FPS} FPS | ${totalFrames} frames | ${CPU_WORKERS} workers`);

    // Viewport define a resolução máxima. Upscale 1920x1080 é feito no FFmpeg.
    const VIEWPORT_W = 1280, VIEWPORT_H = 720;
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blacklist',
        '--disable-web-security',
        '--font-render-hinting=none'
      ],
      defaultViewport: { width: VIEWPORT_W, height: VIEWPORT_H }
    });

    const projectUrl = `http://127.0.0.1:${PORT}${ENTRY_PAGE}?headless=true`;

    console.log(`[CPU-RECORDER] Renderizando ${totalFrames} frames em uma única página...`);
    const renderStart = Date.now();

    const allFrames = await renderAllFrames(browser, projectUrl, CANVAS_SELECTOR, totalFrames, frameIntervalMs, CAPTURE_WIDTH, CAPTURE_HEIGHT);

    const renderElapsed = ((Date.now() - renderStart) / 1000).toFixed(1);
    console.log(`[CPU-RECORDER] Renderização concluída em ${renderElapsed}s. Iniciando encoding com FFmpeg...`);

    // Garantir que o diretório de saída existe
    fs.mkdirSync(path.dirname(OUTPUT_FILE_PATH), { recursive: true });

    // Encoding com FFmpeg via stdin pipe
    await new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-y',
        '-f', 'image2pipe',
        '-framerate', String(FPS),
        '-i', 'pipe:0',
        '-vf', `scale=1920:1080:flags=lanczos`,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-threads', '0',
        OUTPUT_FILE_PATH
      ];

      const ffmpeg = spawn(_ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
      ffmpeg.on('error', err => reject(new Error(`FFmpeg não encontrado: ${err.message}. Instale com: apt-get install ffmpeg`)));
      ffmpeg.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg saiu com código ${code}`));
      });

      // Escrever frames em ordem no stdin do FFmpeg
      (async () => {
        for (const { jpeg } of allFrames) {
          const canWrite = ffmpeg.stdin.write(jpeg);
          if (!canWrite) await new Promise(r => ffmpeg.stdin.once('drain', r));
        }
        ffmpeg.stdin.end();
      })();
    });

    const totalElapsed = ((Date.now() - renderStart) / 1000).toFixed(1);
    console.log(`[CPU-RECORDER] ✅ Vídeo gerado com sucesso em ${totalElapsed}s: ${OUTPUT_FILE_PATH}`);

  } finally {
    if (browser) await browser.close();
    server.close();
    console.log(`[CPU-RECORDER] Pipeline CPU finalizada e recursos liberados.`);
  }
}
// ══════════════════════════════════════════════════════════════════════════════
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
      headless: true,
      protocolTimeout: 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=swiftshader',
        '--enable-unsafe-swiftshader',
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
    const projectUrl = `http://127.0.0.1:${PORT}${ENTRY_PAGE}?headless=true`;
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

// Dispatcher: seleciona modo CPU ou GPU com base em --mode flag
if (RENDER_MODE === 'cpu') {
  console.log('[DISPATCHER] Modo selecionado: CPU (FFmpeg + screenshot paralelo)');
  recordCPU().catch(err => {
    console.error('[CPU-RECORDER] Falha crítica:', err);
    process.exit(1);
  });
} else {
  console.log('[DISPATCHER] Modo selecionado: GPU (WebCodecs pipeline original)');
  record().catch(err => {
    console.error('[RECORDER] Falha crítica na execução da pipeline:', err);
    process.exit(1);
  });
}
