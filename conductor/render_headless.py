import os
import subprocess
import wave
import contextlib
import sys

def render_story(factory, scene_id, **kwargs):
    print(f"🎬 Iniciando Renderização Headless para {factory} / {scene_id}...")
    
    audio_dir = f"pipeline/sync_drive/audio_ready/{factory}/{scene_id}"
    wav_path = None
    if os.path.exists(audio_dir):
        for f in os.listdir(audio_dir):
            if f.endswith('.wav'):
                wav_path = os.path.join(audio_dir, f)
                break

    if not wav_path or not os.path.exists(wav_path):
        print(f"❌ Erro: Áudio não encontrado no diretório {audio_dir}")
        sys.exit(1)

    output_dir = "pipeline/sync_drive/exports"
    os.makedirs(output_dir, exist_ok=True)

    temp_output_path = f"pipeline/sync_drive/exports/{factory}_{scene_id}_temp.mp4"
    final_output_path = f"pipeline/sync_drive/exports/{factory}_{scene_id}.mp4"

    with contextlib.closing(wave.open(wav_path, 'r')) as f:
        frames = f.getnframes()
        rate = f.getframerate()
        duration = frames / float(rate)
    
    duration_rounded = round(duration + 0.2, 2)
    print(f"⏱️ Duração do áudio detectada: {duration_rounded}s")

    if os.path.exists("package.json"):
        print("📦 Compilando assets do projeto (npm run build)...")
        subprocess.run(["npm", "run", "build"], check=True)
    else:
        print("📦 package.json não encontrado, pulando npm run build.")

    print("🎥 Executando Engine-Headless-Recorder...")
    recorder_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../tools/Engine-Headless-Recorder/src/node/record_video.js"))
    
    web_folder = f"pipeline/sync_drive/staging/{factory}/web"
    if not os.path.exists(web_folder):
        print(f"⚠️ Pasta web {web_folder} não encontrada, usando raiz do projeto.")
        web_folder = factory

    cmd = [
        "node", recorder_path,
        web_folder,
        "--canvas=#video-canvas",
        f"--duration={duration_rounded}",
        "--fps=25",
        f"--output={temp_output_path}"
    ]
    
    print(f"🚀 Rodando comando: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    print("🔀 Unindo vídeo e áudio com FFmpeg...")
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-i", temp_output_path,
        "-i", wav_path,
        "-c:v", "copy",
        "-c:a", "aac",
        "-map", "0:v:0",
        "-map", "1:a:0",
        final_output_path
    ]
    subprocess.run(ffmpeg_cmd, check=True, capture_output=True)

    if os.path.exists(temp_output_path):
        os.remove(temp_output_path)

    print(f"🎉 Sucesso! Vídeo finalizado gravado e salvo em: {final_output_path}")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python render_headless.py <factory> <scene_id>")
        sys.exit(1)
    
    factory = sys.argv[1]
    scene_id = sys.argv[2]
    render_story(factory, scene_id)
