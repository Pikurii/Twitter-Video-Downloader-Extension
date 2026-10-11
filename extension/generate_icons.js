// generate_icons.js
// Generates PNG icons for the Chrome extension using pure Node.js (zlib + raw PNG chunk encoder)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(size) {
  const width = size;
  const height = size;

  // RGBA buffer (height rows, width * 4 bytes per row)
  // Each scanline in PNG has 1 filter byte prefix (0 = None) followed by width * 4 bytes
  const rowStride = 1 + width * 4;
  const rawData = Buffer.alloc(rowStride * height);

  // Draw a sleek modern icon:
  // Rounded squircle with gradient (dark purple/indigo to cyan/blue: #1e1b4b -> #0284c7)
  // Inside: download arrow with video play triangle symbol
  const r = width / 2;
  const cornerRadius = size * 0.22;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowStride;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Rounded rect mask
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      let inside = true;
      let alpha = 255;

      if (dx < cornerRadius && dy < cornerRadius) {
        const dist = Math.hypot(cornerRadius - dx, cornerRadius - dy);
        if (dist > cornerRadius) {
          inside = false;
        } else if (dist > cornerRadius - 1) {
          alpha = Math.round((cornerRadius - dist) * 255);
        }
      }

      if (!inside) {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
        continue;
      }

      // Base gradient (blue-indigo to cyan)
      const gradT = (x + y) / (width + height);
      let red = Math.round(15 + gradT * 0);       // 15 -> 0
      let green = Math.round(120 + gradT * 90);   // 120 -> 210
      let blue = Math.round(230 + gradT * 25);    // 230 -> 255

      // Border highlight
      const distFromEdge = Math.min(x, width - 1 - x, y, height - 1 - y);
      if (distFromEdge <= 1 && size >= 32) {
        red = Math.min(255, red + 60);
        green = Math.min(255, green + 60);
        blue = Math.min(255, blue + 40);
      }

      // Check if point is inside download arrow icon
      // Normalized coords (0 to 1)
      const nx = x / width;
      const ny = y / height;

      // Down arrow geometry:
      // Stem: center x in [0.42, 0.58], y in [0.22, 0.50]
      // Arrow head: triangle pointing down: y from 0.50 to 0.68, x in [0.26, 0.74]
      // Bottom tray: y in [0.74, 0.82], x in [0.24, 0.76], with tray opening
      let isIcon = false;

      // Arrow stem
      if (nx >= 0.43 && nx <= 0.57 && ny >= 0.22 && ny <= 0.50) {
        isIcon = true;
      }
      // Arrow head
      if (ny >= 0.48 && ny <= 0.68) {
        const headProgress = (ny - 0.48) / 0.20; // 0 to 1
        const halfWidth = 0.26 * (1 - headProgress);
        if (Math.abs(nx - 0.5) <= halfWidth) {
          isIcon = true;
        }
      }
      // Tray bar at bottom
      if (ny >= 0.74 && ny <= 0.82 && nx >= 0.22 && nx <= 0.78) {
        isIcon = true;
      }

      if (isIcon) {
        // Pure white icon with slight glow
        red = 255;
        green = 255;
        blue = 255;
      }

      rawData[pixelOffset] = red;
      rawData[pixelOffset + 1] = green;
      rawData[pixelOffset + 2] = blue;
      rawData[pixelOffset + 3] = alpha;
    }
  }

  // Compress with zlib
  const compressedData = zlib.deflateSync(rawData);

  // PNG Chunks
  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    // CRC
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Simple CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${filePath} (${png.length} bytes)`);
});
