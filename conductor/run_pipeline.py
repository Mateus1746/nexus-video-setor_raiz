import os
import subprocess
import sys

def run_unified_pipeline():
    print("🚀 Iniciando Pipeline Completo de Vídeos Políticos...")

    # Passo 1: Captação de Notícias e Geração de Roteiros
    print("\n--- Passo 1: Captação de Notícias (Crawler) ---")
    try:
        subprocess.run(["uv", "run", "nexus_crawler.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro ao rodar o crawler: {e}")
        return

    # Passo 2: Geração de Narração e Sincronia de Legendas (Kokoro Local)
    print("\n--- Passo 2: Síntese de Voz (Kokoro Local) ---")
    try:
        subprocess.run(["uv", "run", "python", "conductor/generate_audio.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Erro ao rodar a síntese de voz: {e}")
        return

    # Passo 3: Renderização Automática dos Vídeos (Headless Recorder)
    print("\n--- Passo 3: Renderização Headless dos Vídeos ---")
    staging_dir = "pipeline/sync_drive/staging"
    
    rendered_count = 0
    for canal in ["canal_esquerda", "canal_direita"]:
        canal_path = os.path.join(staging_dir, canal)
        if not os.path.exists(canal_path):
            continue
        
        for item_name in os.listdir(canal_path):
            item_path = os.path.join(canal_path, item_name)
            # Ignorar arquivos soltos como default voice.pt
            if not os.path.isdir(item_path):
                continue
            
            # Verificar se já existe áudio pronto antes de renderizar
            wav_path = f"pipeline/sync_drive/audio_ready/{canal}/{item_name}/{item_name}.wav"
            if os.path.exists(wav_path):
                try:
                    print(f"🎥 Renderizando: {canal} -> {item_name}")
                    subprocess.run([
                        "uv", "run", "python", "conductor/render_headless.py",
                        canal, item_name
                    ], check=True)
                    rendered_count += 1
                except subprocess.CalledProcessError as e:
                    print(f"❌ Erro ao renderizar {canal}/{item_name}: {e}")

    print(f"\n🎉 Pipeline finalizado com sucesso! Total de vídeos renderizados: {rendered_count}")

if __name__ == "__main__":
    run_unified_pipeline()
