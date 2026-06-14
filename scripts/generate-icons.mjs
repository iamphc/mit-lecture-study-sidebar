import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const iconDir = path.join(rootDir, "assets", "icons");
const sizes = [16, 32, 48, 128];

await mkdir(iconDir, { recursive: true });
for (const size of sizes) {
  await writeFile(path.join(iconDir, `icon-${size}.png`), createIconPng(size));
}

function createIconPng(size) {
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 4;
      const cx = (x + 0.5) / size;
      const cy = (y + 0.5) / size;
      const radius = Math.hypot(cx - 0.5, cy - 0.5);
      const inside = radius <= 0.47;
      const edge = radius > 0.41 && radius <= 0.47;
      const accent = cx > 0.58 && cy < 0.42;
      const color = inside
        ? accent
          ? [255, 209, 102, 255]
          : edge
            ? [142, 202, 230, 255]
            : [20, 32, 50, 255]
        : [0, 0, 0, 0];

      row[offset] = color[0];
      row[offset + 1] = color[1];
      row[offset + 2] = color[2];
      row[offset + 3] = color[3];
    }
    rows.push(row);
  }

  drawLetter(rows, size, "M", 0.23, 0.28, 0.21);
  drawLetter(rows, size, "I", 0.49, 0.28, 0.08);
  drawLetter(rows, size, "T", 0.62, 0.28, 0.18);

  return encodePng(size, size, Buffer.concat(rows));
}

function drawLetter(rows, size, letter, leftRatio, topRatio, widthRatio) {
  const left = Math.round(size * leftRatio);
  const top = Math.round(size * topRatio);
  const width = Math.max(1, Math.round(size * widthRatio));
  const height = Math.max(1, Math.round(size * 0.35));
  const stroke = Math.max(1, Math.round(size * 0.035));

  const fill = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }
    const offset = 1 + x * 4;
    rows[y][offset] = 244;
    rows[y][offset + 1] = 247;
    rows[y][offset + 2] = 251;
    rows[y][offset + 3] = 255;
  };

  const rect = (x, y, w, h) => {
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        fill(xx, yy);
      }
    }
  };

  if (letter === "M") {
    rect(left, top, stroke, height);
    rect(left + width - stroke, top, stroke, height);
    for (let i = 0; i < width / 2; i += 1) {
      rect(left + i, top + i, stroke, stroke);
      rect(left + width - i - stroke, top + i, stroke, stroke);
    }
    return;
  }

  if (letter === "I") {
    rect(left, top, width, stroke);
    rect(left + Math.floor(width / 2) - Math.floor(stroke / 2), top, stroke, height);
    rect(left, top + height - stroke, width, stroke);
    return;
  }

  rect(left, top, width, stroke);
  rect(left + Math.floor(width / 2) - Math.floor(stroke / 2), top, stroke, height);
}

function encodePng(width, height, rgbaRows) {
  const chunks = [
    chunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0])
    ])),
    chunk("IDAT", deflateSync(rgbaRows)),
    chunk("IEND", Buffer.alloc(0))
  ];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data])))
  ]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
