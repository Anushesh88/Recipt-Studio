// ESC/POS: the command language of nearly every thermal receipt printer.
// The receipt is printed as a picture (GS v 0 raster), so it looks exactly
// like the PDF: the design, logo and UPI QR included. Pure functions, no
// browser APIs, so they can be tested.

export type PaperWidth = 58 | 80;

// Printable dots across the paper (203 dpi printheads)
export const PAPER_DOTS: Record<PaperWidth, number> = { 58: 384, 80: 576 };

// Rows per raster command: big images are sent in bands, which small
// printers' buffers handle better than one huge command
const BAND_ROWS = 256;

const ESC = 0x1b;
const GS = 0x1d;

export interface Grey {
  width: number;
  height: number;
  data: Uint8ClampedArray; // one 0-255 brightness per pixel, row by row
}

// RGBA pixels to brightness, over white (transparent prints as paper)
export function toGrey(rgba: Uint8ClampedArray, width: number, height: number): Grey {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const lum = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { width, height, data };
}

// Black and white, one bit per dot (1 = burn). A plain threshold: receipts
// are text, rules and QR codes, which print sharpest without dithering (grey
// text prints solid, and QR modules keep clean edges for scanning)
export function toBits(grey: Grey, threshold = 190): { bytesPerRow: number; bits: Uint8Array } {
  const { width, height, data } = grey;
  const bytesPerRow = Math.ceil(width / 8);
  const bits = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] < threshold) bits[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { bytesPerRow, bits };
}

// Initialise, the picture in bands, feed and (on printers that have one) cut
export function rasterCommands(grey: Grey): Uint8Array {
  const { bytesPerRow, bits } = toBits(grey);
  const parts: number[][] = [[ESC, 0x40]]; // ESC @: reset
  parts.push([ESC, 0x61, 0x01]); // centre
  for (let top = 0; top < grey.height; top += BAND_ROWS) {
    const rows = Math.min(BAND_ROWS, grey.height - top);
    // GS v 0 m xL xH yL yH: raster image, normal size
    parts.push([GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8]);
    parts.push(Array.from(bits.subarray(top * bytesPerRow, (top + rows) * bytesPerRow)));
  }
  parts.push([ESC, 0x64, 0x04]); // ESC d 4: feed 4 lines, past the tear bar
  parts.push([GS, 0x56, 0x42, 0x00]); // GS V B 0: partial cut (ignored without a cutter)
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// Fits an image of `width` x `height` to the paper, keeping its shape
export function fitToPaper(width: number, height: number, paper: PaperWidth): { width: number; height: number } {
  const dots = PAPER_DOTS[paper];
  // Width must be whole bytes; thermal pages are narrow, so scale to fill
  const w = Math.floor(dots / 8) * 8;
  return { width: w, height: Math.max(1, Math.round((height * w) / width)) };
}
