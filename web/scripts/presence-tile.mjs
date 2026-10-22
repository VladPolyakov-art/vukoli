/*
 * Cut the seamless dot tile for Presence (D49) from the owner's pattern.
 *
 * Why: the owner's image (docs/assets/presence-dots.webp, 1290 × 860) is not uniform. Dot size and density change
 * across it, so repeating the whole image shows seams and bald patches. The tile is a dense, even region whose width
 * and height are whole numbers of dot periods, so the lattice continues across the tile edges when CSS repeats it
 * (mask-repeat).
 *
 * How:
 *  1. Measure the horizontal dot period in the dense top-right block. Sum the alpha per column, take the
 *     sub-pixel peaks, then a least-squares fit of peak position against peak index. The owner's pattern gives
 *     ≈ 7.68 file px.
 *  2. Crop TW × TH at (X0, Y0). The defaults, 645 × 430 at (500, 0), are ≈ 84 × 56 periods. Print the mean alpha of
 *     the four quadrants: roughly equal values mean an even region.
 *  3. Write the crop as webp (q 0.9) and a 2 × 2 preview around the tile corner, to check the seams by eye.
 *
 * The tile is used as a 2× image: 645 × 430 file px = 20.15625 × 13.4375rem in Presence.module.css. If you change TW
 * or TH, update mask-size there.
 *
 * Usage (from app/web):
 *   node scripts/presence-tile.mjs ../../docs/assets/presence-dots.webp src/ds/assets/presence-dots.webp [preview.png]
 * Env: TILE_X0, TILE_Y0, TILE_W, TILE_H override the crop.
 * Uses the Chromium that Playwright keeps in ~/Library/Caches/ms-playwright (playwright-core, no browser download).
 * Runs locally on a file: no network.
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const [src, out, preview] = process.argv.slice(2);
if (!src || !out) {
  console.error("usage: node scripts/presence-tile.mjs <owner-pattern.webp> <tile-out.webp> [preview.png]");
  process.exit(2);
}
const crop = {
  x0: Number(process.env.TILE_X0 ?? 500),
  y0: Number(process.env.TILE_Y0 ?? 0),
  w: Number(process.env.TILE_W ?? 645),
  h: Number(process.env.TILE_H ?? 430),
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: crop.w * 2, height: crop.h * 2 } });
const result = await page.evaluate(
  async ({ dataUrl, crop: c }) => {
    const im = new Image();
    im.src = dataUrl;
    await im.decode();
    const W = im.naturalWidth;
    const H = im.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(im, 0, 0);
    const px = ctx.getImageData(0, 0, W, H).data;
    const alpha = (x, y) => px[(y * W + x) * 4 + 3] / 255;

    // 1. Horizontal period: column alpha profile of the dense block, sub-pixel peaks, linear fit.
    const prof = new Float64Array(W);
    for (let y = 0; y < Math.min(400, H); y++) for (let x = c.x0 - 20; x < W; x++) prof[x] += alpha(x, y);
    const peaks = [];
    for (let i = c.x0 - 18; i < W - 2; i++) {
      if (prof[i] > prof[i - 1] && prof[i] >= prof[i + 1] && prof[i] > prof[i - 2] && prof[i] >= prof[i + 2]) {
        const s = prof[i - 1] + prof[i] + prof[i + 1];
        peaks.push(((i - 1) * prof[i - 1] + i * prof[i] + (i + 1) * prof[i + 1]) / s);
      }
    }
    const n = peaks.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    peaks.forEach((v, i) => { sx += i; sy += v; sxx += i * i; sxy += i * v; });
    const period = (n * sxy - sx * sy) / (n * sxx - sx * sx);

    // 2. Evenness: mean alpha per quadrant of the crop.
    const quadrants = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => {
      let s = 0;
      for (let y = c.y0 + (j * c.h) / 2; y < c.y0 + ((j + 1) * c.h) / 2; y++)
        for (let x = c.x0 + (i * c.w) / 2; x < c.x0 + ((i + 1) * c.w) / 2; x++) s += alpha(x | 0, y | 0);
      return Number((s / ((c.w * c.h) / 4)).toFixed(4));
    });

    // 3. The tile, and a 2 × 2 repeat on a dark ground for the seam check.
    const tile = document.createElement("canvas");
    tile.width = c.w;
    tile.height = c.h;
    tile.getContext("2d").drawImage(canvas, c.x0, c.y0, c.w, c.h, 0, 0, c.w, c.h);
    const view = document.createElement("canvas");
    view.width = c.w * 2;
    view.height = c.h * 2;
    const vx = view.getContext("2d");
    vx.fillStyle = "#0b1a40"; // preview ground only (a dark blue like the glow in dark theme), not a design value
    vx.fillRect(0, 0, view.width, view.height);
    vx.fillStyle = vx.createPattern(tile, "repeat");
    vx.fillRect(0, 0, view.width, view.height);
    document.body.style.margin = "0";
    document.body.appendChild(view);
    return { period, periods: [c.w / period, c.h / period], peaks: n, quadrants, url: tile.toDataURL("image/webp", 0.9) };
  },
  { dataUrl: "data:image/webp;base64," + readFileSync(src).toString("base64"), crop },
);

const bytes = Buffer.from(result.url.split(",")[1], "base64");
writeFileSync(out, bytes);
if (preview) {
  // The tile corner (where four copies meet) in the middle of the shot.
  await page.screenshot({ path: preview, clip: { x: crop.w - 160, y: crop.h - 110, width: 320, height: 220 } });
}
console.log(JSON.stringify({ out, bytes: bytes.length, period: result.period, periods: result.periods, peaks: result.peaks, quadrants: result.quadrants }));
await browser.close();
