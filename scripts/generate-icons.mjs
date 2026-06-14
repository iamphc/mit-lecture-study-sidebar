import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const iconDir = path.join(rootDir, "assets", "icons");
const sizes = [16, 32, 48, 128];

function createIconPng(size) {
  const canvas = new Canvas(size, size);
  const scale = size / 128;

  canvas.roundRect(5 * scale, 5 * scale, 118 * scale, 118 * scale, 28 * scale, [12, 22, 38, 255]);
  canvas.roundRect(9 * scale, 9 * scale, 110 * scale, 110 * scale, 24 * scale, [18, 30, 52, 255]);
  canvas.circle(91 * scale, 34 * scale, 27 * scale, [255, 209, 102, 245]);
  canvas.circle(94 * scale, 34 * scale, 20 * scale, [255, 159, 104, 230]);

  canvas.roundRect(22 * scale, 26 * scale, 64 * scale, 50 * scale, 10 * scale, [244, 247, 251, 255]);
  canvas.roundRect(26 * scale, 31 * scale, 56 * scale, 40 * scale, 6 * scale, [231, 237, 247, 255]);
  canvas.triangle(
    47 * scale,
    42 * scale,
    47 * scale,
    60 * scale,
    63 * scale,
    51 * scale,
    [20, 32, 50, 255]
  );

  canvas.roundRect(74 * scale, 50 * scale, 30 * scale, 56 * scale, 8 * scale, [142, 202, 230, 255]);
  canvas.roundRect(78 * scale, 57 * scale, 22 * scale, 5 * scale, 2 * scale, [20, 32, 50, 255]);
  canvas.roundRect(78 * scale, 69 * scale, 22 * scale, 5 * scale, 2 * scale, [20, 32, 50, 255]);
  canvas.roundRect(78 * scale, 81 * scale, 16 * scale, 5 * scale, 2 * scale, [20, 32, 50, 255]);
  canvas.roundRect(78 * scale, 93 * scale, 20 * scale, 5 * scale, 2 * scale, [20, 32, 50, 255]);

  if (size >= 32) {
    drawMit(canvas, scale);
  } else {
    canvas.roundRect(25 * scale, 88 * scale, 35 * scale, 8 * scale, 3 * scale, [255, 209, 102, 255]);
    canvas.roundRect(25 * scale, 101 * scale, 28 * scale, 6 * scale, 3 * scale, [244, 247, 251, 255]);
  }

  return encodePng(size, size, canvas.toFilteredRows());
}

function drawMit(canvas, scale) {
  const color = [244, 247, 251, 255];
  const accent = [255, 209, 102, 255];
  const y = 89 * scale;
  const h = 24 * scale;
  const s = Math.max(1.5 * scale, 1);

  canvas.rect(24 * scale, y, 5 * scale, h, color);
  canvas.rect(39 * scale, y, 5 * scale, h, color);
  canvas.polygon(
    [
      [29 * scale, y],
      [34 * scale, (y + 10 * scale)],
      [39 * scale, y],
      [39 * scale, y + 8 * scale],
      [34 * scale, y + 18 * scale],
      [29 * scale, y + 8 * scale]
    ],
    color
  );

  canvas.rect(52 * scale, y, 5 * scale, h, accent);
  canvas.rect(49 * scale, y, 11 * scale, 4 * scale, accent);
  canvas.rect(49 * scale, y + h - 4 * scale, 11 * scale, 4 * scale, accent);

  canvas.rect(65 * scale, y, 22 * scale, 5 * scale, color);
  canvas.rect(74 * scale, y, 5 * scale, h, color);
  canvas.line(22 * scale, 118 * scale, 94 * scale, 118 * scale, s, [142, 202, 230, 255]);
}

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  setPixel(x, y, color, alphaMultiplier = 1) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const offset = (y * this.width + x) * 4;
    const alpha = Math.max(0, Math.min(255, Math.round(color[3] * alphaMultiplier)));
    const inverse = 255 - alpha;
    this.pixels[offset] = Math.round((color[0] * alpha + this.pixels[offset] * inverse) / 255);
    this.pixels[offset + 1] = Math.round((color[1] * alpha + this.pixels[offset + 1] * inverse) / 255);
    this.pixels[offset + 2] = Math.round((color[2] * alpha + this.pixels[offset + 2] * inverse) / 255);
    this.pixels[offset + 3] = Math.min(255, alpha + Math.round((this.pixels[offset + 3] * inverse) / 255));
  }

  rect(x, y, width, height, color) {
    this.shape((px, py) => px >= x && px <= x + width && py >= y && py <= y + height, color);
  }

  roundRect(x, y, width, height, radius, color) {
    this.shape((px, py) => {
      const left = x + radius;
      const right = x + width - radius;
      const top = y + radius;
      const bottom = y + height - radius;
      const dx = px < left ? left - px : px > right ? px - right : 0;
      const dy = py < top ? top - py : py > bottom ? py - bottom : 0;
      return px >= x && px <= x + width && py >= y && py <= y + height && dx * dx + dy * dy <= radius * radius;
    }, color);
  }

  circle(cx, cy, radius, color) {
    this.shape((px, py) => Math.hypot(px - cx, py - cy) <= radius, color);
  }

  triangle(x1, y1, x2, y2, x3, y3, color) {
    this.polygon(
      [
        [x1, y1],
        [x2, y2],
        [x3, y3]
      ],
      color
    );
  }

  polygon(points, color) {
    this.shape((px, py) => pointInPolygon(px, py, points), color);
  }

  line(x1, y1, x2, y2, width, color) {
    const half = width / 2;
    this.shape((px, py) => distanceToSegment(px, py, x1, y1, x2, y2) <= half, color);
  }

  shape(predicate, color) {
    const samples = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75]
    ];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        let hits = 0;
        for (const [sx, sy] of samples) {
          if (predicate(x + sx, y + sy)) {
            hits += 1;
          }
        }
        if (hits) {
          this.setPixel(x, y, color, hits / samples.length);
        }
      }
    }
  }

  toFilteredRows() {
    const rows = [];
    for (let y = 0; y < this.height; y += 1) {
      const row = Buffer.alloc(1 + this.width * 4);
      row[0] = 0;
      for (let x = 0; x < this.width; x += 1) {
        const source = (y * this.width + x) * 4;
        const target = 1 + x * 4;
        row[target] = this.pixels[source];
        row[target + 1] = this.pixels[source + 1];
        row[target + 2] = this.pixels[source + 2];
        row[target + 3] = this.pixels[source + 3];
      }
      rows.push(row);
    }
    return Buffer.concat(rows);
  }
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared)) : 0;
  const x = x1 + t * dx;
  const y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

function encodePng(width, height, rgbaRows) {
  const chunks = [
    chunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", deflateSync(rgbaRows)),
    chunk("IEND", Buffer.alloc(0))
  ];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]);
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

await mkdir(iconDir, { recursive: true });
for (const size of sizes) {
  await writeFile(path.join(iconDir, `icon-${size}.png`), createIconPng(size));
}
