import os
import glob
import soundfile as sf
import numpy as np
import torch
from kokoro import KPipeline

STAGING_DIR = "pipeline/sync_drive/staging"
AUDIO_READY_DIR = "pipeline/sync_drive/audio_ready"

def generate_audio_batch(speed=1.05):
    print("🎙️ Inicializando Motor Kokoro para Português ('p')...")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    try:
        pipeline = KPipeline(lang_code='p', device=device)
        print("✅ Kokoro pronto!")
    except Exception as e:
        print(f"❌ Erro ao inicializar o Kokoro: {e}")
        return

    # Buscar todos os arquivos de texto para narrar
    all_txt_files = glob.glob(os.path.join(STAGING_DIR, "**/*.txt"), recursive=True)

    if not all_txt_files:
        print(f"⚠️ Nenhum roteiro .txt encontrado em: {STAGING_DIR}")
        return

    print(f"🎬 Iniciando processamento de {len(all_txt_files)} roteiros...")

    for txt_path in all_txt_files:
        rel_path = os.path.relpath(txt_path, STAGING_DIR)
        scene_id = os.path.splitext(os.path.basename(txt_path))[0]
        
        # Obter caminho do canal
        sub_dirs = os.path.dirname(rel_path)
        canal_dir = sub_dirs.split(os.sep)[0]
        
        dest_dir = os.path.join(AUDIO_READY_DIR, sub_dirs)
        os.makedirs(dest_dir, exist_ok=True)
        final_wav_path = os.path.join(dest_dir, f"{scene_id}.wav")

        # --- RESOLUÇÃO DO DNA VOCAL (.pt) ---
        noticia_voice_path = os.path.join(os.path.dirname(txt_path), "voice.pt")
        canal_voice_path = os.path.join(STAGING_DIR, canal_dir, "voice.pt")

        voice_style = 'pm_alex'
        origin = "Fallback"

        if os.path.exists(noticia_voice_path):
            voice_file = noticia_voice_path
            origin = "Específica da Notícia"
        elif os.path.exists(canal_voice_path):
            voice_file = canal_voice_path
            origin = "Padrão do Canal"
        else:
            voice_file = None

        if voice_file:
            try:
                voice_style = torch.load(voice_file, map_location='cpu').to(device)
                print(f"🧬 DNA Vocal carregado ({origin}): {os.path.basename(voice_file)}")
            except Exception as e:
                print(f"❌ Erro ao carregar {voice_file}: {e}. Usando fallback.")

        # --- LEITURA DO TEXTO ---
        with open(txt_path, 'r', encoding='utf-8') as f:
            text = f.read().strip()

        try:
            print(f"🎙️ Sintetizando: {rel_path}...")
            # Executar síntese
            generator = pipeline(text, voice=voice_style, speed=speed)
            audio_chunks = [audio for _, _, audio in generator]
            combined_wav = np.concatenate(audio_chunks)

            # Salvar WAV
            sf.write(final_wav_path, combined_wav, 24000)
            duration = len(combined_wav) / 24000.0
            print(f"🔊 Áudio gerado: {duration:.2f}s")

            # --- GERAR ALINHAMENTO DE LEGENDA (_words.json) ---
            words = text.split()
            words_data = []
            step = duration / len(words)
            
            for idx, w in enumerate(words):
                words_data.append({
                    "word": w,
                    "start": round(idx * step, 3),
                    "end": round((idx + 1) * step, 3)
                })

            words_json_path = os.path.join(dest_dir, f"{scene_id}_words.json")
            with open(words_json_path, 'w', encoding='utf-8') as f:
                json.dump(words_data, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Arquivos de áudio e legendas salvos em {dest_dir}/")

        except Exception as e:
            print(f"❌ Erro na síntese de {rel_path}: {e}")

if __name__ == "__main__":
    import json
    generate_audio_batch(speed=1.05)
