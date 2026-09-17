const { cpSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const root = join(__dirname, "..");
const source = join(root, "node_modules/pdfjs-dist");
const dest = join(root, "public/pdfjs");
mkdirSync(dest, { recursive: true });
for (const name of [
  "build/pdf.mjs",
  "build/pdf.worker.mjs",
  "cmaps",
  "standard_fonts",
  "wasm",
  "LICENSE",
]) {
  cpSync(join(source, name), join(dest, name), { recursive: true });
}
/* global __dirname */
