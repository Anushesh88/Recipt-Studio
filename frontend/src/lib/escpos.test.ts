import { describe, expect, it } from "vitest";
import { fitToPaper, PAPER_DOTS, rasterCommands, toBits, toGrey } from "./escpos";

const grey = (width: number, height: number, at: (x: number, y: number) => number) => ({
  width, height, data: Uint8ClampedArray.from({ length: width * height }, (_, i) => at(i % width, Math.floor(i / width))),
});

describe("ESC/POS raster printing", () => {
  it("turns dark pixels into burnt dots, eight to a byte", () => {
    // Left half black, right half white, 16 wide
    const { bytesPerRow, bits } = toBits(grey(16, 2, (x) => (x < 8 ? 0 : 255)));
    expect(bytesPerRow).toBe(2);
    expect(Array.from(bits)).toEqual([0xff, 0x00, 0xff, 0x00]);
  });

  it("prints transparent pixels as paper", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]); // clear, then black
    expect(Array.from(toGrey(rgba, 2, 1).data)).toEqual([255, 0]);
  });

  it("prints grey text solid, and pale tints as paper", () => {
    const { bits } = toBits(grey(8, 2, (_x, y) => (y === 0 ? 163 : 230))); // #9CA3AF light grey, a pale tint
    expect(Array.from(bits)).toEqual([0xff, 0x00]);
  });

  it("wraps the picture in reset, raster bands, feed and cut", () => {
    const bytes = rasterCommands(grey(16, 300, () => 0));
    expect(Array.from(bytes.slice(0, 5))).toEqual([0x1b, 0x40, 0x1b, 0x61, 0x01]);
    // First band: GS v 0, 2 bytes wide, 256 rows
    expect(Array.from(bytes.slice(5, 13))).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 0, 1]);
    // Second band: the remaining 44 rows
    const second = 13 + 2 * 256;
    expect(Array.from(bytes.slice(second, second + 8))).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 44, 0]);
    expect(Array.from(bytes.slice(-7))).toEqual([0x1b, 0x64, 0x04, 0x1d, 0x56, 0x42, 0x00]);
    expect(bytes.length).toBe(5 + 8 * 2 + 2 * 300 + 7);
  });

  it("fits the receipt to the paper's width", () => {
    // The thermal 80 mm PNG is 604 px wide
    expect(fitToPaper(604, 1000, 58)).toEqual({ width: 384, height: 636 });
    expect(fitToPaper(604, 1000, 80)).toEqual({ width: PAPER_DOTS[80], height: 954 });
  });
});
