"use strict";
const zlib = require("zlib");
const fs = require("fs");

/**
 * Minimal PNG writer, so the harness has no dependencies at all.
 *
 * Images exist here for one reason: every visual bug found in this project so
 * far — the wall of crust at the map edge, the ruled bands across the ocean —
 * was invisible to every metric being collected at the time. Numbers catch
 * problems you already know the shape of. A picture is the only thing that
 * catches the next category. So the harness renders a handful: the best run,
 * the worst, and any outlier, and nothing else, because nobody can page through
 * thousands.
 */
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function writePng(file, width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[p++] = rgb[i]; raw[p++] = rgb[i + 1]; raw[p++] = rgb[i + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

/** False-colour terrain: depth in the sea, relief on the land, snow on the peaks. */
function paint(el, tp, N, scale = 3) {
  const W = N * scale;
  const rgb = Buffer.alloc(W * W * 3);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const sx = (x / scale) | 0, sy = (y / scale) | 0;
      const i = sy * N + sx;
      const v = el[i];
      let r, g, b;
      if (v < 100) {
        const t = Math.max(0, Math.min(1, v / 100));
        r = 12 + t * 26; g = 32 + t * 54; b = 70 + t * 88;
      } else {
        const L = sx > 0 ? el[i - 1] : v, R = sx < N - 1 ? el[i + 1] : v;
        const U = sy > 0 ? el[i - N] : v, D = sy < N - 1 ? el[i + N] : v;
        const shade = 1 + ((L - R) + (U - D)) / 260;
        const t = Math.max(0, Math.min(1, (v - 100) / 300));
        if (v >= 300) { r = 190; g = 190; b = 198; }
        else { r = 70 + t * 150; g = 120 + t * 90; b = 60 + t * 60; }
        const k = Math.max(0.55, Math.min(1.45, shade));
        r = Math.min(255, r * k); g = Math.min(255, g * k); b = Math.min(255, b * k);
      }
      if (tp && tp[i] <= -4 && v >= 100) { r = 232; g = 240; b = 246; }
      const o = (y * W + x) * 3;
      rgb[o] = r | 0; rgb[o + 1] = g | 0; rgb[o + 2] = b | 0;
    }
  }
  return { rgb, size: W };
}

function renderWorld(file, el, tp, N, scale = 3) {
  const { rgb, size } = paint(el, tp, N, scale);
  writePng(file, size, size, rgb);
}

module.exports = { renderWorld, writePng };
