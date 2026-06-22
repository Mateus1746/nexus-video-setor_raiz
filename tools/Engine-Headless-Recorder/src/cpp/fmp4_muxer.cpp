#include <emscripten.h>
#include "mp4_box_writer.hpp"

extern "C" {

// Estrutura para retorno de dados para o JS
struct MuxResult {
    uint8_t* data;
    uint32_t size;
};

EMSCRIPTEN_KEEPALIVE
MuxResult create_initialization_segment(uint32_t width, uint32_t height, uint8_t* avcc_payload, uint32_t avcc_size) {
    static MP4BoxWriter writer;
    writer.buffer.clear();

    // 1. Escrever Box 'ftyp' (File Type Box)
    writer.begin_box("ftyp");
    writer.write_type("iso5"); // Major brand: iso5 (Fragmented MP4)
    writer.write_u32(1); // Minor version: 1
    writer.write_type("iso5"); // Compatible brand 1
    writer.write_type("avc1"); // Compatible brand 2
    writer.write_type("mp41"); // Compatible brand 3
    writer.end_box(); // ftyp

    // 2. Escrever Box 'moov' (Movie Box)
    writer.begin_box("moov");
    
    // Box 'mvhd' (Movie Header Box)
    writer.begin_box("mvhd");
    writer.write_u32(0); // Version (0) & Flags (0)
    writer.write_u32(0); // Creation time
    writer.write_u32(0); // Modification time
    writer.write_u32(1000); // Timescale (1000 Hz)
    writer.write_u32(0); // Duration (0 para fMP4)
    writer.write_u32(0x00010000); // Preferred rate: 1.0
    writer.write_u16(0x0100); // Preferred volume: 1.0 (Full)
    writer.write_u16(0); // Reserved (2 bytes to align)
    writer.write_u32(0); // Reserved (4 bytes)
    writer.write_u32(0); // Reserved (4 bytes)
    // Matriz de identidade para o vídeo
    writer.write_u32(0x00010000); writer.write_u32(0); writer.write_u32(0);
    writer.write_u32(0); writer.write_u32(0x00010000); writer.write_u32(0);
    writer.write_u32(0); writer.write_u32(0); writer.write_u32(0x40000000);
    for (int i = 0; i < 6; ++i) writer.write_u32(0); // Pre-defined
    writer.write_u32(2); // Next track ID (2)
    writer.end_box(); // mvhd

    // Box 'trak' (Track Box)
    writer.begin_box("trak");
    
    // Box 'tkhd' (Track Header Box)
    writer.begin_box("tkhd");
    writer.write_u32(0x000007); // Flags: Track enabled, in movie, in preview
    writer.write_u32(0); // Creation time
    writer.write_u32(0); // Modification time
    writer.write_u32(1); // Track ID
    writer.write_u32(0); // Reserved
    writer.write_u32(0); // Duration
    writer.write_u32(0); // Reserved (4 bytes)
    writer.write_u32(0); // Reserved (4 bytes)
    writer.write_u32(0); // Layer & alternate_group (4 bytes)
    writer.write_u32(0); // Volume & reserved (4 bytes)
    // Matriz de identidade para a track
    writer.write_u32(0x00010000); writer.write_u32(0); writer.write_u32(0);
    writer.write_u32(0); writer.write_u32(0x00010000); writer.write_u32(0);
    writer.write_u32(0); writer.write_u32(0); writer.write_u32(0x40000000);
    writer.write_u32(width << 16); // Width em formato Ponto Fixo 16.16
    writer.write_u32(height << 16); // Height em formato Ponto Fixo 16.16
    writer.end_box(); // tkhd

    // Box 'mdia' (Media Box)
    writer.begin_box("mdia");
    
    // Box 'mdhd' (Media Header Box)
    writer.begin_box("mdhd");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(0); // Creation time
    writer.write_u32(0); // Modification time
    writer.write_u32(90000); // Timescale: 90kHz (padrão H.264)
    writer.write_u32(0); // Duration
    writer.write_u32(0x55C40000); // Language (und - undefined)
    writer.end_box(); // mdhd

    // Box 'hdlr' (Handler Reference Box)
    writer.begin_box("hdlr");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(0); // Pre-defined
    writer.write_type("vide"); // Handler type: vide (Video)
    for (int i = 0; i < 3; ++i) writer.write_u32(0); // Reserved
    writer.write_type("VideoHandler"); // Name
    writer.buffer.push_back(0); // Null terminator
    writer.end_box(); // hdlr

    // Box 'minf' (Media Information Box)
    writer.begin_box("minf");
    
    // Box 'vmhd' (Video Media Header Box)
    writer.begin_box("vmhd");
    writer.write_u32(1); // Flags
    writer.write_u16(0); // Graphics mode
    for (int i = 0; i < 3; ++i) writer.write_u16(0); // Opcolor
    writer.end_box(); // vmhd

    // Box 'dinf' (Data Information Box)
    writer.begin_box("dinf");
    writer.begin_box("dref");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(1); // Entry count
    writer.begin_box("url ");
    writer.write_u32(1); // Flags: self-contained media data
    writer.end_box(); // url 
    writer.end_box(); // dref
    writer.end_box(); // dinf

    // Box 'stbl' (Sample Table Box)
    writer.begin_box("stbl");
    
    // Box 'stsd' (Sample Description Box)
    writer.begin_box("stsd");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(1); // Entry count
    
    // Visual Sample Entry: 'avc1'
    writer.begin_box("avc1");
    for (int i = 0; i < 6; ++i) writer.buffer.push_back(0); // Reserved
    writer.write_u16(1); // Data reference index
    writer.write_u16(0); // Pre-defined
    writer.write_u16(0); // Reserved
    for (int i = 0; i < 3; ++i) writer.write_u32(0); // Pre-defined
    writer.write_u16(width); // Width
    writer.write_u16(height); // Height
    writer.write_u32(0x00720000); // Horizontal resolution: 72 dpi
    writer.write_u32(0x00720000); // Vertical resolution: 72 dpi
    writer.write_u32(0); // Reserved
    writer.write_u16(1); // Frame count: 1
    for (int i = 0; i < 32; ++i) writer.buffer.push_back(0); // Compressor name placeholder
    writer.write_u16(0x0018); // Depth (24)
    writer.write_u16(0xFFFF); // Pre-defined
    
    // Box 'avcC' (AVC Configuration Box) contendo SPS e PPS do WebCodecs
    writer.begin_box("avcC");
    for (uint32_t i = 0; i < avcc_size; ++i) {
        writer.buffer.push_back(avcc_payload[i]);
    }
    writer.end_box(); // avcC
    
    writer.end_box(); // avc1
    writer.end_box(); // stsd

    // stts (vazio em fMP4)
    writer.begin_box("stts");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(0); // Entry count
    writer.end_box(); // stts

    // stsc (vazio em fMP4)
    writer.begin_box("stsc");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(0); // Entry count
    writer.end_box(); // stsc

    // stsz (vazio em fMP4)
    writer.begin_box("stsz");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(0); // Sample size
    writer.write_u32(0); // Sample count
    writer.end_box(); // stsz

    // stco (vazio em fMP4)
    writer.begin_box("stco");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(0); // Entry count
    writer.end_box(); // stco

    writer.end_box(); // stbl
    writer.end_box(); // minf
    writer.end_box(); // mdia
    writer.end_box(); // trak

    // Box 'mvex' (Movie Extends Box) - Posicionado ao final do 'moov', após 'trak' conforme especificação ISO/IEC 14496-12
    writer.begin_box("mvex");
    writer.begin_box("trex");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(1); // Track ID
    writer.write_u32(1); // Default sample description index
    writer.write_u32(0); // Default sample duration
    writer.write_u32(0); // Default sample size
    writer.write_u32(0); // Default sample flags
    writer.end_box(); // trex
    writer.end_box(); // mvex

    writer.end_box(); // moov

    MuxResult result;
    result.data = writer.buffer.data();
    result.size = writer.buffer.size();
    return result;
}

EMSCRIPTEN_KEEPALIVE
MuxResult create_fragment(uint8_t* payload, uint32_t payload_size, uint32_t sequence_number, uint32_t sample_duration_us, uint32_t is_keyframe) {
    static MP4BoxWriter writer;
    writer.buffer.clear();

    // Converter duração de microsegundos para unidades de timescale (90kHz)
    uint32_t sample_duration = (uint32_t)((uint64_t)sample_duration_us * 90000 / 1000000);

    // 1. Criar Box 'moof' (Movie Fragment Box)
    writer.begin_box("moof");
    
    // Movie Fragment Header
    writer.begin_box("mfhd");
    writer.write_u32(0); // Version & Flags
    writer.write_u32(sequence_number);
    writer.end_box(); // mfhd

    // Track Fragment
    writer.begin_box("traf");
    
    // Track Fragment Header (com default-base-is-moof habilitado)
    writer.begin_box("tfhd");
    writer.write_u32(0x020000); // Flags: default-base-is-moof (0x020000)
    writer.write_u32(1); // Track ID (1 = Video)
    writer.end_box(); // tfhd

    // Track Run (com data-offset-present, first-sample-flags-present, sample-duration-present e sample-size-present habilitados)
    writer.begin_box("trun");
    writer.write_u32(0x000305); // Flags: data-offset-present (0x000001) | first-sample-flags-present (0x000004) | sample-duration-present (0x000100) | sample-size-present (0x000200)
    writer.write_u32(1); // Sample count (1 frame)
    writer.write_u32(0); // Data offset placeholder (será corrigido no final)
    writer.write_u32(is_keyframe ? 0x02000000 : 0x01010000); // first_sample_flags (keyframe vs delta frame)
    writer.write_u32(sample_duration); // Duração em unidades de timescale
    writer.write_u32(payload_size); // Tamanho exato do sample
    writer.end_box(); // trun

    writer.end_box(); // traf
    writer.end_box(); // moof

    // 2. Criar Box 'mdat' (Media Data Box) contendo os bits H.264 codificados
    writer.begin_box("mdat");
    for (uint32_t i = 0; i < payload_size; ++i) {
        writer.buffer.push_back(payload[i]);
    }
    writer.end_box(); // mdat

    // Corrigir o data_offset do trun
    // O offset de dados em trun aponta para o início dos dados de mdat (moof_size + 8 bytes de cabeçalho do mdat)
    uint32_t moof_size = writer.buffer.size() - payload_size - 8;
    uint32_t correct_data_offset = moof_size + 8;
    
    // Encontrar a posição do data_offset em trun:
    // trun estrutura: size (4), type "trun" (4), version/flags (4), sample_count (4), data_offset (4)
    // Então o data_offset está a 12 bytes do início da caixa trun (após 't','r','u','n').
    for (size_t i = 0; i < writer.buffer.size() - 4; ++i) {
        if (writer.buffer[i] == 't' && writer.buffer[i+1] == 'r' && writer.buffer[i+2] == 'u' && writer.buffer[i+3] == 'n') {
            size_t offset_pos = i + 12; // 4 bytes após o sample_count
            writer.buffer[offset_pos] = (correct_data_offset >> 24) & 0xFF;
            writer.buffer[offset_pos + 1] = (correct_data_offset >> 16) & 0xFF;
            writer.buffer[offset_pos + 2] = (correct_data_offset >> 8) & 0xFF;
            writer.buffer[offset_pos + 3] = correct_data_offset & 0xFF;
            break;
        }
    }
    
    MuxResult result;
    result.data = writer.buffer.data();
    result.size = writer.buffer.size();
    return result;
}

}
