import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const target = resolve("src/generated/build-timestamp.ts");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, `export const BUILD_TIMESTAMP = ${JSON.stringify(new Date().toISOString())};\n`);
