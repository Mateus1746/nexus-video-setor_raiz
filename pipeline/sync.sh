#!/bin/bash
# NEXUS SYNC - RESTRUTURADO

FACTORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
FACTORY_NAME=$(basename "$FACTORY_ROOT")
LOCAL_SYNC_DIR="$FACTORY_ROOT/pipeline/sync_drive"
REMOTE_NAME="gdrive"
REMOTE_PATH="nexus_pipeline"

echo "=== Nexus Sync: Factory ($FACTORY_NAME) ==="

case "$1" in
    up)
        echo "[🚀] Enviando staging para a nuvem..."
        rclone sync "$LOCAL_SYNC_DIR/staging/$FACTORY_NAME" "$REMOTE_NAME:$REMOTE_PATH/staging/$FACTORY_NAME" -P
        echo "[🧬] Enviando DNA vocal customizado..."
        rclone sync "$LOCAL_SYNC_DIR/custom_voices" "$REMOTE_NAME:$REMOTE_PATH/custom_voices" -P
        ;;
    down)
        echo "[🛸] Baixando ativos processados..."
        rclone sync "$REMOTE_NAME:$REMOTE_PATH/audio_ready/$FACTORY_NAME" "$LOCAL_SYNC_DIR/audio_ready/$FACTORY_NAME" -P
        echo "[🧬] Baixando DNA vocal customizado..."
        rclone sync "$REMOTE_NAME:$REMOTE_PATH/custom_voices" "$LOCAL_SYNC_DIR/custom_voices" -P
        ;;
    *)
        echo "Uso: ./sync.sh [up|down]"
        ;;
esac
