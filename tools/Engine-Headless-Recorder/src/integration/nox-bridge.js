import puppeteer from 'puppeteer';
import { TimeOrchestrator } from '../node/orchestrator.js';

async function launchBridge(targetUrl) {
  const url = targetUrl || 'http://localhost:5173';
  console.log(`🚀 [Bridge] Conectando ao motor headless em ${url}...`);
  
  const browser = await puppeteer.launch({ 
      headless: false,
      args: ['--disable-extensions', '--no-sandbox'] 
  });
  const page = await browser.newPage();
  
  // 1. Conectar à Fábrica de Conteúdo
  console.log("🌐 Navegando para a Fábrica...");
  await page.goto(url, { waitUntil: 'networkidle2' });

  // 2. Injetar o core do gravador
  await page.addScriptTag({ path: './src/browser/recorder-core.js' });
  
  // 3. Ativar Virtual Time
  const client = await page.target().createCDPSession();
  await client.send('Emulation.setVirtualTimePolicy', { policy: 'advance' });

  // 4. Iniciar loop de renderização determinística
  const orchestrator = new TimeOrchestrator({ fps: 60 });
  console.log("🔗 Ponte estabelecida. Iniciando gravação determinística...");

  for (let frame = 0; frame < 600; frame++) { 
    const virtualTick = orchestrator.nextFrameTick();
    
    await page.evaluate((time) => {
      if (window.__FACTORY_RENDER_FRAME__) {
        window.__FACTORY_RENDER_FRAME__(time);
      }
    }, virtualTick);

    await client.send('Emulation.setVirtualTimePolicy', { policy: 'advance' });
  }

  console.log("✅ Gravação concluída. Vídeo pronto no disco via OPFS.");
  await browser.close();
}

const targetUrl = process.argv[2];
launchBridge(targetUrl).catch(console.error);
