/**
 * Creates simple PNG icons for the extension using pure Node.js
 * Uses zlib to create valid PNG files
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size, bgColor, textColor) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  function makeIHDR(width, height) {
    const data = Buffer.alloc(13);
    data.writeUInt32BE(width, 0);
    data.writeUInt32BE(height, 4);
    data[8] = 8;  // bit depth
    data[9] = 2;  // color type: RGB
    data[10] = 0; // compression
    data[11] = 0; // filter
    data[12] = 0; // interlace
    return makeChunk('IHDR', data);
  }

  function crc32(buf) {
    const table = makeCRCTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  let crcTable = null;
  function makeCRCTable() {
    if (crcTable) return crcTable;
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[n] = c;
    }
    return crcTable;
  }

  function makeChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const crcData = Buffer.concat([typeBuffer, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([length, typeBuffer, data, crcBuf]);
  }

  // Create pixel data: teal background with "M" letter
  const [bgR, bgG, bgB] = bgColor;
  const [txR, txG, txB] = textColor;

  // Simple pixel grid
  const pixels = [];
  for (let y = 0; y < size; y++) {
    pixels.push(0); // filter type: None
    for (let x = 0; x < size; x++) {
      // Draw a simple "M↓" shape
      const cx = size / 2;
      const cy = size / 2;
      const margin = Math.floor(size * 0.15);
      const inBox = x >= margin && x < size - margin && y >= margin && y < size - margin;

      // Draw rounded rect background is default (teal)
      // Draw letter pixels: simple "M" shape
      let isLetter = false;

      if (size >= 16) {
        const lx = x - margin;
        const ly = y - margin;
        const lw = size - margin * 2;
        const lh = size - margin * 2;
        const midX = Math.floor(lw / 2);
        const colW = Math.max(1, Math.floor(lw * 0.15));

        // Left vertical bar of M
        if (lx >= 0 && lx < colW && ly >= 0 && ly < lh * 0.65) isLetter = true;
        // Right vertical bar of M
        if (lx >= lw - colW && lx < lw && ly >= 0 && ly < lh * 0.65) isLetter = true;
        // Left diagonal of M
        if (lx >= colW && lx < midX && ly >= 0 && ly < lh * 0.4) {
          const progress = (lx - colW) / (midX - colW);
          const expectedY = Math.floor(progress * (lh * 0.3));
          if (Math.abs(ly - expectedY) < Math.max(1, Math.floor(lh * 0.15))) isLetter = true;
        }
        // Right diagonal of M
        if (lx >= midX && lx < lw - colW && ly >= 0 && ly < lh * 0.4) {
          const progress = 1 - (lx - midX) / (lw - colW - midX);
          const expectedY = Math.floor(progress * (lh * 0.3));
          if (Math.abs(ly - expectedY) < Math.max(1, Math.floor(lh * 0.15))) isLetter = true;
        }

        // Down arrow below M
        const arrowTop = Math.floor(lh * 0.65);
        const arrowMidX = Math.floor(lw / 2);
        const stemW = Math.max(1, Math.floor(lw * 0.15));
        // Stem
        if (Math.abs(lx - arrowMidX) < stemW && ly >= arrowTop && ly < lh * 0.85) isLetter = true;
        // Arrow head (triangle)
        if (ly >= lh * 0.78 && ly < lh) {
          const spread = (ly - lh * 0.78) / (lh * 0.22);
          const halfW = Math.floor(spread * lw * 0.35);
          if (Math.abs(lx - arrowMidX) < halfW) isLetter = true;
        }
      }

      if (isLetter) {
        pixels.push(txR, txG, txB);
      } else {
        pixels.push(bgR, bgG, bgB);
      }
    }
  }

  const rawData = Buffer.from(pixels);
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));
  const ihdr = makeIHDR(size, size);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const iconsDir = path.join(__dirname, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const teal = [13, 115, 119];
const white = [255, 255, 255];

[16, 32, 128].forEach(size => {
  const png = createPNG(size, teal, white);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png`);
});
