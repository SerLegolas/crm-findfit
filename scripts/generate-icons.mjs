// Genera favicon.ico (ICO con PNG dentro), icon-192.png, icon-512.png
// Usa zlib (built-in) — nessuna dipendenza esterna
import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

function createPNGBytes(w, h, getPixel) {
  // Crea raw data RGBA (color type 6)
  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0); // filter none
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getPixel(x, y);
      raw.push(r, g, b, a);
    }
  }
  const compressed = deflateSync(Buffer.from(raw));

  const crc32 = (buf) => {
    let c = 0xffffffff;
    const t = new Int32Array(256);
    for (let i = 0; i < 256; i++) { let v = i; for (let j = 0; j < 8; j++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1; t[i] = v; }
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32BE(v); return b; };

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.concat([u32(w), u32(h), Buffer.from([8, 6, 0, 0, 0])]); // 8-bit RGBA
  const ihdr = Buffer.concat([u32(13), Buffer.from("IHDR"), ihdrData, u32(crc32(Buffer.concat([Buffer.from("IHDR"), ihdrData])))]);

  const idatData = Buffer.concat([Buffer.from("IDAT"), compressed]);
  const idat = Buffer.concat([u32(compressed.length), idatData, u32(crc32(idatData))]);

  const iendData = Buffer.from("IEND");
  const iend = Buffer.concat([u32(0), iendData, u32(crc32(iendData))]);

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function roundedRectPixel(w, h, radius, r, g, b) {
  return (x, y) => {
    const cx = w / 2, cy = h / 2;
    const rx = w / 2 - radius, ry = h / 2 - radius;
    // Angoli arrotondati
    let inside = true;
    if (x < rx && y < ry) inside = (x - rx) ** 2 + (y - ry) ** 2 <= radius * radius;
    else if (x > w - rx && y < ry) inside = (x - (w - rx)) ** 2 + (y - ry) ** 2 <= radius * radius;
    else if (x < rx && y > h - ry) inside = (x - rx) ** 2 + (y - (h - ry)) ** 2 <= radius * radius;
    else if (x > w - rx && y > h - ry) inside = (x - (w - rx)) ** 2 + (y - (h - ry)) ** 2 <= radius * radius;
    else if (x < rx || x > w - rx || y < ry || y > h - ry) inside = false;
    return inside ? [r, g, b, 255] : [0, 0, 0, 0];
  };
}

// Genera i file
for (const { file, size } of [
  { file: "public/favicon.ico", size: 32 },
  { file: "public/icon-192.png", size: 192 },
  { file: "public/icon-512.png", size: 512 },
]) {
  const radius = Math.max(4, size * 0.18);
  const pngData = createPNGBytes(size, size, roundedRectPixel(size, size, radius, 0x25, 0x63, 0xeb));

  if (file.endsWith(".ico")) {
    // ICO formato: header + directory entry + PNG data
    const dataSize = pngData.length;
    const offset = 6 + 16; // header (6) + 1 entry (16)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);      // reserved
    header.writeUInt16LE(1, 2);      // type = ICO
    header.writeUInt16LE(1, 4);      // count = 1
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 32 ? 32 : 0, 0); // width (0 = 256)
    entry.writeUInt8(size, 1);       // height
    entry.writeUInt8(0, 2);          // colors
    entry.writeUInt8(0, 3);          // reserved
    entry.writeUInt16LE(1, 4);       // planes
    entry.writeUInt16LE(32, 6);      // bpp
    entry.writeUInt32LE(dataSize, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    writeFileSync(file, Buffer.concat([header, entry, pngData]));
  } else {
    writeFileSync(file, pngData);
  }
  console.log(`✅ ${file} (${size}x${size})`);
}
