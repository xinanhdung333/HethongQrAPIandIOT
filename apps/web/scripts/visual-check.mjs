import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve(".artifacts");
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 }
];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".hero-command-card", { timeout: 15000 });
  await page.waitForSelector(".qr-grid", { timeout: 15000 });
  await page.waitForFunction(() => {
    const hero = document.querySelector(".qr-landing-hero");
    if (!hero) return false;
    return getComputedStyle(hero).backgroundImage !== "none";
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, `landing-${viewport.name}.png`), fullPage: false });
  const heroStats = await page.evaluate(() => {
    const card = document.querySelector(".hero-command-card");
    const preview = document.querySelector(".hero-preview");
    const qrCells = Array.from(document.querySelectorAll(".qr-grid span"));
    const cardRect = card?.getBoundingClientRect();
    const previewRect = preview?.getBoundingClientRect();
    return {
      hasCard: Boolean(card),
      hasPreview: Boolean(preview),
      qrCells: qrCells.length,
      cardVisible: cardRect ? cardRect.width > 300 && cardRect.height > 300 : false,
      previewVisible: previewRect ? previewRect.width > 300 && previewRect.height > 200 : false
    };
  });
  if (!heroStats.hasCard || !heroStats.hasPreview || heroStats.qrCells < 20 || !heroStats.cardVisible || !heroStats.previewVisible) {
    throw new Error(`QR hero failed visual checks on ${viewport.name}: ${JSON.stringify(heroStats)}`);
  }
  await page.close();
}

await browser.close();
console.log("Visual check passed: screenshots written to apps/web/.artifacts");
