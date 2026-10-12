// ============================================================
// GENERAR ICONOS GESBASE (PNG sin dependencias externas)
// Produce icon-192.png, icon-512.png, apple-touch-icon.png
// en la raíz del proyecto.
// ============================================================

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dir, "..", "..");

// CRC32 para chunks PNG
const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) {
        c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0; // filtro none
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type RGBA
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

// Glyph "G" 8x10 (1 = tinta)
const GLYPH = [
    ".XXXXXX.",
    "XX....XX",
    "XX......",
    "XX......",
    "XX..XXXX",
    "XX....XX",
    "XX....XX",
    "XX....XX",
    ".XXXXXX."
];
const GW = GLYPH[0].length;
const GH = GLYPH.length;

const BG = [18, 52, 59];      // #12343B (theme_color)
const FG = [255, 255, 255];   // letra
const ACCENT = [76, 175, 150]; // franja inferior

function drawIcon(size, radius) {
    const px = Buffer.alloc(size * size * 4);
    const glyphScale = Math.floor(size * 0.09);
    const glyphW = GW * glyphScale;
    const glyphH = GH * glyphScale;
    const ox = Math.floor((size - glyphW) / 2);
    const oy = Math.floor((size - glyphH) / 2) - Math.floor(size * 0.03);
    const bandH = Math.floor(size * 0.1);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // esquinas redondeadas
            const dx = Math.min(x, size - 1 - x);
            const dy = Math.min(y, size - 1 - y);
            const inCorner = dx < radius && dy < radius;
            const dist = Math.hypot(radius - dx, radius - dy);
            const outside = inCorner && dist > radius;

            let color = BG;
            if (!outside && y >= size - bandH) color = ACCENT;

            // letra G
            const gx = x - ox;
            const gy = y - oy;
            if (
                !outside &&
                gx >= 0 && gx < glyphW &&
                gy >= 0 && gy < glyphH
            ) {
                const col = Math.floor(gx / glyphScale);
                const row = Math.floor(gy / glyphScale);
                if (GLYPH[row][col] === "X") color = FG;
            }

            const i = (y * size + x) * 4;
            if (outside) {
                px[i + 3] = 0; // transparente
            } else {
                px[i] = color[0];
                px[i + 1] = color[1];
                px[i + 2] = color[2];
                px[i + 3] = 255;
            }
        }
    }
    return encodePNG(size, size, px);
}

for (const [name, size, radius] of [
    ["icon-192.png", 192, 40],
    ["icon-512.png", 512, 108],
    ["apple-touch-icon.png", 180, 40]
]) {
    fs.writeFileSync(path.join(rootDir, name), drawIcon(size, radius));
    console.log(`${name} generado (${size}x${size})`);
}
