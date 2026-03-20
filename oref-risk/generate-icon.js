/**
 * Generates public/apple-touch-icon.png and public/icon-192.png
 * Pure Node.js — no extra dependencies needed.
 * Run: node generate-icon.js
 */
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 192, H = 192;
const img = new Uint8ClampedArray(W * H * 4); // RGBA

// ── drawing helpers ──────────────────────────────────────────────────────────

function px(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  img[i]=r; img[i+1]=g; img[i+2]=b; img[i+3]=a;
}

function fillCircle(cx, cy, rad, r, g, b, a = 255) {
  const x0=Math.floor(cx-rad), x1=Math.ceil(cx+rad);
  const y0=Math.floor(cy-rad), y1=Math.ceil(cy+rad);
  for (let y=y0; y<=y1; y++)
    for (let x=x0; x<=x1; x++)
      if ((x-cx)**2+(y-cy)**2 <= rad*rad) px(x,y,r,g,b,a);
}

function fillRect(x0, y0, w, h, r, g, b, a = 255) {
  for (let y=y0; y<y0+h; y++)
    for (let x=x0; x<x0+w; x++) px(x,y,r,g,b,a);
}

// Axis-aligned ellipse fill
function fillEllipse(cx, cy, rx, ry, r, g, b, a = 255) {
  for (let y=Math.floor(cy-ry); y<=Math.ceil(cy+ry); y++)
    for (let x=Math.floor(cx-rx); x<=Math.ceil(cx+rx); x++)
      if ((x-cx)**2/rx**2 + (y-cy)**2/ry**2 <= 1) px(x,y,r,g,b,a);
}

function fillLine(x0, y0, x1, y1, lw, r, g, b, a = 255) {
  const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy);
  const step = 1/Math.max(len,1);
  for (let t=0; t<=1; t+=step) {
    const mx=x0+dx*t, my=y0+dy*t;
    fillRect(Math.round(mx-lw/2), Math.round(my-lw/2), lw, lw, r,g,b,a);
  }
}

// Rounded rectangle
function fillRRect(x0, y0, w, h, rad, r, g, b, a = 255) {
  fillRect(x0+rad, y0,     w-2*rad, h,       r,g,b,a);
  fillRect(x0,     y0+rad, w,       h-2*rad, r,g,b,a);
  fillCircle(x0+rad,   y0+rad,   rad, r,g,b,a);
  fillCircle(x0+w-rad, y0+rad,   rad, r,g,b,a);
  fillCircle(x0+rad,   y0+h-rad, rad, r,g,b,a);
  fillCircle(x0+w-rad, y0+h-rad, rad, r,g,b,a);
}

// ── icon design ───────────────────────────────────────────────────────────────
//  Background: very dark navy
fillRRect(0, 0, W, H, 38, 15, 8, 8);

const CX = W / 2;          // 96
const DOME_TOP = 38;       // y where dome starts
const DOME_CY  = 108;      // centre of the dome arc (sits below canvas)
const DOME_R   = 72;       // radius of dome arc

// Siren dome — filled semicircle (top half only)
for (let y = DOME_TOP; y <= 118; y++) {
  const dy = y - DOME_CY;
  const hw = Math.sqrt(Math.max(0, DOME_R**2 - dy**2));
  for (let x = Math.floor(CX - hw); x <= Math.ceil(CX + hw); x++)
    px(x, y, 220, 35, 35);
}

// Siren body (rectangle below dome)
fillRect(38, 118, 116, 26, 220, 35, 35);

// Siren base bar
fillRect(28, 144, 136, 18, 170, 20, 20);

// Light rays (yellow, radiating upward)
function ray(angleDeg, rayLen, lw) {
  const a = (angleDeg - 90) * Math.PI / 180;
  const x1 = CX + Math.cos(a) * 38;
  const y1 = 82  + Math.sin(a) * 38;
  const x2 = CX + Math.cos(a) * (38 + rayLen);
  const y2 = 82  + Math.sin(a) * (38 + rayLen);
  fillLine(x1, y1, x2, y2, lw, 255, 215, 0);
}
ray(  0, 30, 8);
ray( 38, 22, 7);
ray(-38, 22, 7);
ray( 70, 16, 6);
ray(-70, 16, 6);

// Yellow glow circle
fillCircle(CX, 82, 28, 255, 210, 0);
// White centre (bright light)
fillCircle(CX, 82, 16, 255, 255, 240);

// Small map-pin dot at bottom-centre (hints at map/location purpose)
fillCircle(CX, 172, 7, 255, 80, 80);

// ── PNG encoder ───────────────────────────────────────────────────────────────

function crc32(buf) {
  if (!crc32._t) {
    crc32._t = new Uint32Array(256);
    for (let i=0; i<256; i++) {
      let c=i;
      for (let j=0; j<8; j++) c = (c&1) ? 0xedb88320^(c>>>1) : c>>>1;
      crc32._t[i]=c;
    }
  }
  let crc=0xffffffff;
  for (let i=0; i<buf.length; i++) crc=crc32._t[(crc^buf[i])&0xff]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

function pngChunk(type, data) {
  const tb = Buffer.from(type,'ascii');
  const lb = Buffer.allocUnsafe(4); lb.writeUInt32BE(data.length);
  const cb = Buffer.allocUnsafe(4); cb.writeUInt32BE(crc32(Buffer.concat([tb,data])));
  return Buffer.concat([lb, tb, data, cb]);
}

function encodePNG(w, h, pixels) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;

  // Raw scanlines: filter byte (0=None) + RGBA
  const raw = Buffer.allocUnsafe(h * (1 + w*4));
  for (let y=0; y<h; y++) {
    raw[y*(1+w*4)] = 0;
    for (let x=0; x<w; x++) {
      const s=(y*w+x)*4, d=y*(1+w*4)+1+x*4;
      raw[d]=pixels[s]; raw[d+1]=pixels[s+1]; raw[d+2]=pixels[s+2]; raw[d+3]=pixels[s+3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = encodePNG(W, H, Buffer.from(img.buffer));
const outDir = path.join(__dirname, 'public');
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), png);
fs.writeFileSync(path.join(outDir, 'icon-192.png'), png);
console.log(`Icon written (${png.length} bytes) → public/apple-touch-icon.png + public/icon-192.png`);
