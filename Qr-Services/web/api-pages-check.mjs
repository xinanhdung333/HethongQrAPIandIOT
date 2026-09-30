import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve(".artifacts");
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const pages = ["/thue-api", "/dashboard/api-keys"];
const viewports = [
  { name: "mobile-320", width: 320, height: 760 },
  { name: "tablet-768", width: 768, height: 900 },
  { name: "desktop-1024", width: 1024, height: 900 }
];

for (const route of pages) {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "networkidle", timeout: 20000 });
    const stats = await page.evaluate(() => {
      const title = document.querySelector("h1")?.textContent ?? "";
      const interactive = Array.from(document.querySelectorAll("button,.btn,input,select"));
      return {
        title,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        visibleInteractive: interactive.every((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
      };
    });
    if (!stats.title) throw new Error(`${route} ${viewport.name}: missing h1`);
    if (!stats.visibleInteractive) throw new Error(`${route} ${viewport.name}: invisible control`);
    if (stats.scrollWidth > stats.clientWidth + 2) {
      throw new Error(`${route} ${viewport.name}: horizontal overflow ${stats.scrollWidth}/${stats.clientWidth}`);
    }
    const severeErrors = consoleErrors.filter((error) => !error.includes("Failed to load resource"));
    if (severeErrors.length) throw new Error(`${route} ${viewport.name}: ${severeErrors.join(" | ")}`);
    await page.screenshot({
      path: path.join(outDir, `${route.replaceAll("/", "_")}-${viewport.name}.png`),
      fullPage: false
    });
    await page.close();
  }
}

await browser.close();
console.log("API page visual check passed.");
