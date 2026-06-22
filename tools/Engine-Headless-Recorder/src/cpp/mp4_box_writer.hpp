#ifndef MP4_BOX_WRITER_HPP
#define MP4_BOX_WRITER_HPP

#include <vector>
#include <cstdint>
#include <string>
#include <algorithm>

class MP4BoxWriter {
public:
    std::vector<uint8_t> buffer;

    void write_u32(uint32_t val) {
        buffer.push_back((val >> 24) & 0xFF);
        buffer.push_back((val >> 16) & 0xFF);
        buffer.push_back((val >> 8) & 0xFF);
        buffer.push_back(val & 0xFF);
    }

    void write_u16(uint16_t val) {
        buffer.push_back((val >> 8) & 0xFF);
        buffer.push_back(val & 0xFF);
    }

    void write_u64(uint64_t val) {
        write_u32((uint32_t)(val >> 32));
        write_u32((uint32_t)val);
    }

    void write_type(const std::string& type) {
        for (char c : type) buffer.push_back(c);
    }

    // Escreve o tamanho e o tipo da box
    void begin_box(const std::string& type) {
        write_u32(0); // Placeholder para o tamanho
        write_type(type);
        box_starts.push_back(buffer.size() - 8);
    }

    void end_box() {
        size_t start = box_starts.back();
        box_starts.pop_back();
        uint32_t size = buffer.size() - start;
        buffer[start] = (size >> 24) & 0xFF;
        buffer[start + 1] = (size >> 16) & 0xFF;
        buffer[start + 2] = (size >> 8) & 0xFF;
        buffer[start + 3] = size & 0xFF;
    }

private:
    std::vector<size_t> box_starts;
};

#endif
