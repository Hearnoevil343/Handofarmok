/** Picture of DF's highest-flow river tiles (blue) over ours (red); overlap is white. */
import * as fs from "fs";
import * as zlib from "zlib";
import { LayerType } from "#types";
import { readWorldGen } from "@formats/worldgen/read";
import { planWater } from "@helpers/rivers";

const [paramsFile, dumpFile, outFile] = process.argv.slice(2);
const realm = readWorldGen(fs.readFileSync(paramsFile, "utf8"))[0];
const S = realm.size, N = S * S;
const L = realm.layers as Record<LayerType, Int16Array>;
const water = planWater(L.elevation, L.rainfall, S);
const d = JSON.parse(fs.readFileSync(dumpFile, "utf8"));
const flow = new Float64Array(N);
for (const r of d.rivers) for (const [x, y, f] of r.path) flow[y * S + x] = Math.max(flow[y * S + x], f);
let k = 0; for (let i = 0; i < N; i++) if (water.size[i]) k++;
const cut = [...flow].sort((a, b) => b - a)[k];
const K = 3, W = S * K, rgb = Buffer.alloc(W * W * 3);
for (let i = 0; i < N; i++) {
  const x = i % S, y = (i / S) | 0;
  let c = L.elevation[i] < 100 ? [20, 30, 60] : [70, 70, 60];
  const ours = water.size[i] > 0, theirs = flow[i] > cut;
  if (ours && theirs) c = [255, 255, 255]; else if (ours) c = [220, 60, 50]; else if (theirs) c = [60, 140, 255];
  for (let dy = 0; dy < K; dy++) for (let dx = 0; dx < K; dx++) { const o = ((y * K + dy) * W + x * K + dx) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; }
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, data: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(t), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((W * 3 + 1) * W);
for (let y = 0; y < W; y++) rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
const hd = Buffer.alloc(13); hd.writeUInt32BE(W, 0); hd.writeUInt32BE(W, 4); hd[8] = 8; hd[9] = 2;
fs.writeFileSync(outFile, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", hd), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("flow cut", cut, "tiles", k);
