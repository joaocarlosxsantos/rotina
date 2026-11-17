import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Color definitions (RGBA)
const OUTLINE = [0x20, 0x3E, 0x32, 0xFF];    // #203e32 (Dark Forest Green)
const BODY = [0xA9, 0xCA, 0x7B, 0xFF];       // #a9ca7b (Fresh Olive Green)
const HIGHLIGHT = [0xC7, 0xE3, 0x9A, 0xFF];  // #c7e39a (Soft Lime)
const BLUSH = [0xD5, 0x80, 0x68, 0xFF];      // #d58068 (Coral Blush)
const PAPER = [0xF8, 0xF7, 0xF2, 0xFF];      // #f8f7f2 (Warm Paper)
const LINE = [0xC5, 0xCB, 0xBF, 0xFF];       // #c5cbbf (Soft Border Line)
const PRIMARY = [0x31, 0x5E, 0x43, 0xFF];    // #315e43 (Primary Green)
const CARD_BG = [0xFF, 0xFE, 0xFB, 0xFF];    // #fffefb (Surface White)
const MUTED = [0x58, 0x69, 0x5E, 0xFF];      // #58695e (Muted Ink)
const TRANSPARENT = [0, 0, 0, 0];

const BODY_ROWS = [
  "................",
  "...kk......kk...",
  "..kggk....kggk..",
  "..kgggkkkkgggk..",
  ".kggggggggggggk.",
  "kgglgggggggglggk",
  "kggggggggggggggk",
  "kggggggggggggggk",
  "kggggggggggggggk",
  "kggggggggggggggk",
  ".kggggggggggggk.",
  ".kggggggggggggk.",
  "..kggggggggggk..",
  "..kggggggggggk..",
  "...kkkk..kkkk...",
  "..kkkk....kkkk..",
];

// Happy Face additions
const EYES = [[3, 7], [4, 6], [5, 7], [10, 7], [11, 6], [12, 7]];
const MOUTH = [[6, 9], [7, 10], [8, 10], [9, 9]];
const CHEEKS = [[2, 9], [3, 9], [12, 9], [13, 9]];

// Build 16x16 sprite matrix
function buildPetMatrix() {
  const matrix = Array.from({ length: 16 }, () => Array(16).fill(null));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const char = BODY_ROWS[y][x];
      if (char === 'k') matrix[y][x] = OUTLINE;
      else if (char === 'g') matrix[y][x] = BODY;
      else if (char === 'l') matrix[y][x] = HIGHLIGHT;
    }
  }
  for (const [x, y] of EYES) matrix[y][x] = OUTLINE;
  for (const [x, y] of MOUTH) matrix[y][x] = OUTLINE;
  for (const [x, y] of CHEEKS) matrix[y][x] = BLUSH;
  return matrix;
}

const PET_MATRIX = buildPetMatrix();

// CRC32 implementation
function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}
const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function encodePNG(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    const rawOffset = y * scanlineLength;
    rawData[rawOffset] = 0; // filter None
    const rowSource = y * width * 4;
    rgbaBuffer.copy(rawData, rawOffset + 1, rowSource, rowSource + width * 4);
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function encodeICO(pngBuffer, width, height) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(1, 4); // count 1

  header[6] = width >= 256 ? 0 : width;
  header[7] = height >= 256 ? 0 : height;
  header[8] = 0;
  header[9] = 0;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngBuffer.length, 14);
  header.writeUInt32LE(22, 18);

  return Buffer.concat([header, pngBuffer]);
}

// Canvas buffer helper
class Canvas {
  constructor(width, height, bg = PAPER) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      this.buffer[i * 4] = bg[0];
      this.buffer[i * 4 + 1] = bg[1];
      this.buffer[i * 4 + 2] = bg[2];
      this.buffer[i * 4 + 3] = bg[3];
    }
  }

  setPixel(x, y, color) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (color[3] === 0xFF) {
      this.buffer[idx] = color[0];
      this.buffer[idx + 1] = color[1];
      this.buffer[idx + 2] = color[2];
      this.buffer[idx + 3] = color[3];
    } else if (color[3] > 0) {
      const alpha = color[3] / 255;
      const invAlpha = 1 - alpha;
      this.buffer[idx] = Math.round(color[0] * alpha + this.buffer[idx] * invAlpha);
      this.buffer[idx + 1] = Math.round(color[1] * alpha + this.buffer[idx + 1] * invAlpha);
      this.buffer[idx + 2] = Math.round(color[2] * alpha + this.buffer[idx + 2] * invAlpha);
      this.buffer[idx + 3] = 0xFF;
    }
  }

  fillRect(x0, y0, w, h, color) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        this.setPixel(x, y, color);
      }
    }
  }

  strokeRect(x0, y0, w, h, color, lineWidth = 1) {
    this.fillRect(x0, y0, w, lineWidth, color);
    this.fillRect(x0, y0 + h - lineWidth, w, lineWidth, color);
    this.fillRect(x0, y0, lineWidth, h, color);
    this.fillRect(x0 + w - lineWidth, y0, lineWidth, h, color);
  }

  drawPet(startX, startY, scale) {
    for (let py = 0; py < 16; py++) {
      for (let px = 0; px < 16; px++) {
        const color = PET_MATRIX[py][px];
        if (color) {
          this.fillRect(startX + px * scale, startY + py * scale, scale, scale, color);
        }
      }
    }
  }

  toPNG() {
    return encodePNG(this.width, this.height, this.buffer);
  }
}

// 5x7 Pixel Font for Crisp Retro Rendering in OG images
const FONT_5X7 = {
  'A': [0x0E, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'B': [0x1E, 0x11, 0x11, 0x1E, 0x11, 0x11, 0x1E],
  'C': [0x0E, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0E],
  'D': [0x1C, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1C],
  'E': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F],
  'F': [0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x10],
  'G': [0x0E, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0F],
  'H': [0x11, 0x11, 0x11, 0x1F, 0x11, 0x11, 0x11],
  'I': [0x0E, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0E],
  'J': [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0C],
  'K': [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  'L': [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1F],
  'M': [0x11, 0x1B, 0x15, 0x15, 0x11, 0x11, 0x11],
  'N': [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  'O': [0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'P': [0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10],
  'Q': [0x0E, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0D],
  'R': [0x1E, 0x11, 0x11, 0x1E, 0x14, 0x12, 0x11],
  'S': [0x0E, 0x11, 0x10, 0x0E, 0x01, 0x11, 0x0E],
  'T': [0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  'U': [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E],
  'V': [0x11, 0x11, 0x11, 0x11, 0x11, 0x0A, 0x04],
  'W': [0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11],
  'X': [0x11, 0x11, 0x0A, 0x04, 0x0A, 0x11, 0x11],
  'Y': [0x11, 0x11, 0x0A, 0x04, 0x04, 0x04, 0x04],
  'Z': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1F],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  '+': [0x00, 0x04, 0x04, 0x1F, 0x04, 0x04, 0x00],
  '-': [0x00, 0x00, 0x00, 0x1F, 0x00, 0x00, 0x00],
  ':': [0x00, 0x0C, 0x0C, 0x00, 0x0C, 0x0C, 0x00],
  '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C],
  ',': [0x00, 0x00, 0x00, 0x00, 0x0C, 0x0C, 0x08],
  '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  '0': [0x0E, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0E],
  '1': [0x04, 0x0C, 0x04, 0x04, 0x04, 0x04, 0x0E],
  '2': [0x0E, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1F],
  '3': [0x1F, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0E],
  '4': [0x02, 0x06, 0x0A, 0x12, 0x1F, 0x02, 0x02],
  '5': [0x1F, 0x10, 0x1E, 0x01, 0x01, 0x11, 0x0E],
  '6': [0x06, 0x08, 0x10, 0x1E, 0x11, 0x11, 0x0E],
  '7': [0x1F, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0E, 0x11, 0x11, 0x0E, 0x11, 0x11, 0x0E],
  '9': [0x0E, 0x11, 0x11, 0x0F, 0x01, 0x02, 0x0C],
  '/': [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  '•': [0x00, 0x00, 0x0E, 0x0E, 0x0E, 0x00, 0x00],
};

function drawPixelText(canvas, text, startX, startY, scale, color) {
  let cx = startX;
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const char = upper[i];
    const bitmap = FONT_5X7[char] || FONT_5X7[' '];
    for (let r = 0; r < 7; r++) {
      const row = bitmap[r];
      for (let c = 0; c < 5; c++) {
        if ((row >> (4 - c)) & 1) {
          canvas.fillRect(cx + c * scale, startY + r * scale, scale, scale, color);
        }
      }
    }
    cx += 6 * scale; // 5 width + 1 letter spacing
  }
}

// 1. Generate Apple Icon (180x180)
function generateAppleIcon() {
  const canvas = new Canvas(180, 180, PAPER);
  // Soft rounded border
  canvas.strokeRect(0, 0, 180, 180, LINE, 2);
  // 16x16 sprite scaled by 8 = 128x128
  const scale = 8;
  const size = 16 * scale;
  const x = Math.round((180 - size) / 2);
  const y = Math.round((180 - size) / 2);
  canvas.drawPet(x, y, scale);
  return canvas.toPNG();
}

// 2. Generate PWA 192 (192x192)
function generatePwa192() {
  const canvas = new Canvas(192, 192, PAPER);
  const scale = 9; // 144x144
  const size = 16 * scale;
  const x = Math.round((192 - size) / 2);
  const y = Math.round((192 - size) / 2);
  canvas.drawPet(x, y, scale);
  return canvas.toPNG();
}

// 3. Generate PWA 512 (512x512)
function generatePwa512() {
  const canvas = new Canvas(512, 512, PAPER);
  const scale = 24; // 384x384
  const size = 16 * scale;
  const x = Math.round((512 - size) / 2);
  const y = Math.round((512 - size) / 2);
  canvas.drawPet(x, y, scale);
  return canvas.toPNG();
}

// 4. Generate PWA 192 Maskable (192x192 with safe zone padding)
function generatePwa192Maskable() {
  const canvas = new Canvas(192, 192, PAPER);
  // Safe zone diameter is 80% (153.6px)
  const scale = 7; // 112x112
  const size = 16 * scale;
  const x = Math.round((192 - size) / 2);
  const y = Math.round((192 - size) / 2);
  canvas.drawPet(x, y, scale);
  return canvas.toPNG();
}

// 5. Generate PWA 512 Maskable (512x512 with safe zone padding)
function generatePwa512Maskable() {
  const canvas = new Canvas(512, 512, PAPER);
  // Safe zone diameter is 80% (409px)
  const scale = 18; // 288x288
  const size = 16 * scale;
  const x = Math.round((512 - size) / 2);
  const y = Math.round((512 - size) / 2);
  canvas.drawPet(x, y, scale);
  return canvas.toPNG();
}

// 6. Generate Favicon ICO (48x48 icon)
function generateFaviconIco() {
  const canvas = new Canvas(48, 48, PAPER);
  canvas.strokeRect(0, 0, 48, 48, LINE, 1);
  const scale = 2; // 32x32
  const size = 16 * scale;
  const x = Math.round((48 - size) / 2);
  const y = Math.round((48 - size) / 2);
  canvas.drawPet(x, y, scale);
  const png = canvas.toPNG();
  return encodeICO(png, 48, 48);
}

// 7. Generate OG Image (1200x630)
function generateOgImage() {
  const canvas = new Canvas(1200, 630, PAPER);

  // Outer subtle margin and border
  canvas.strokeRect(24, 24, 1152, 582, LINE, 2);

  // Accent band top
  canvas.fillRect(24, 24, 1152, 12, PRIMARY);

  // Left card: Pet avatar showcase
  const cardX = 80;
  const cardY = 100;
  const cardW = 420;
  const cardH = 430;
  canvas.fillRect(cardX, cardY, cardW, cardH, CARD_BG);
  canvas.strokeRect(cardX, cardY, cardW, cardH, LINE, 2);

  // Pet inside left card (16x16 scaled by 18 = 288x288)
  const petScale = 18;
  const petW = 16 * petScale;
  const petX = cardX + Math.round((cardW - petW) / 2);
  const petY = cardY + 50;
  canvas.drawPet(petX, petY, petScale);

  // Status badge under pet
  canvas.fillRect(cardX + 90, cardY + 360, 240, 40, PRIMARY);
  drawPixelText(canvas, "HUMOR: FELIZ", cardX + 115, cardY + 372, 3, CARD_BG);

  // Right side: Brand & Typography
  const textX = 540;

  // Small Category / Eyebrow
  drawPixelText(canvas, "CADERNO DE HABITOS GAMIFICADO", textX, 130, 3, MUTED);

  // Giant Title: ROTINA PET
  drawPixelText(canvas, "ROTINA", textX, 180, 11, OUTLINE);
  drawPixelText(canvas, "PET", textX + 540, 180, 11, PRIMARY);

  // Tagline
  drawPixelText(canvas, "SEUS HABITOS COM UM COMPANHEIRO PIXEL", textX, 290, 4, OUTLINE);

  // Features Cards
  // Card 1: +10 pts
  const fCardY = 360;
  canvas.fillRect(textX, fCardY, 280, 90, CARD_BG);
  canvas.strokeRect(textX, fCardY, 280, 90, LINE, 2);
  drawPixelText(canvas, "+10 PONTOS", textX + 24, fCardY + 20, 4, PRIMARY);
  drawPixelText(canvas, "POR CONCLUSAO", textX + 24, fCardY + 55, 3, MUTED);

  // Card 2: Sequencia
  canvas.fillRect(textX + 300, fCardY, 280, 90, CARD_BG);
  canvas.strokeRect(textX + 300, fCardY, 280, 90, LINE, 2);
  drawPixelText(canvas, "SEQUENCIA", textX + 324, fCardY + 20, 4, OUTLINE);
  drawPixelText(canvas, "DIAS CONSECUTIVOS", textX + 324, fCardY + 55, 3, MUTED);

  // Footer domain / attribution
  drawPixelText(canvas, "ROTINA-PET.VERCEL.APP", textX, 490, 3, MUTED);

  return canvas.toPNG();
}

// Main execution
function main() {
  const root = path.resolve(import.meta.dirname, '..');
  const appDir = path.join(root, 'src', 'app');
  const publicDir = path.join(root, 'public');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log('Gerando assets de marca...');

  // 1. Apple Icon
  const appleIcon = generateAppleIcon();
  fs.writeFileSync(path.join(appDir, 'apple-icon.png'), appleIcon);
  console.log('✓ src/app/apple-icon.png (180x180)');

  // 2. Favicon ICO
  const faviconIco = generateFaviconIco();
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), faviconIco);
  fs.writeFileSync(path.join(root, 'favicon.ico'), faviconIco);
  console.log('✓ src/app/favicon.ico & favicon.ico (48x48 ICO)');

  // 3. PWA Icons in public/
  fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generatePwa192());
  console.log('✓ public/icon-192.png (192x192)');

  fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generatePwa512());
  console.log('✓ public/icon-512.png (512x512)');

  fs.writeFileSync(path.join(publicDir, 'icon-192-maskable.png'), generatePwa192Maskable());
  console.log('✓ public/icon-192-maskable.png (192x192 maskable)');

  fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), generatePwa512Maskable());
  console.log('✓ public/icon-512-maskable.png (512x512 maskable)');

  // 4. OpenGraph and Twitter images
  const ogImage = generateOgImage();
  fs.writeFileSync(path.join(appDir, 'opengraph-image.png'), ogImage);
  fs.writeFileSync(path.join(appDir, 'twitter-image.png'), ogImage);
  console.log('✓ src/app/opengraph-image.png & twitter-image.png (1200x630)');

  console.log('Todos os assets de imagem gerados com sucesso!');
}

main();
