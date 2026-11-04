import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = "design/monogramme/monea-symbol-derived.png";
const meta = await sharp(source).metadata();
if (!meta.hasAlpha)
  throw new Error("Le monogramme doit conserver un canal alpha.");
const master = await sharp(source)
  .trim({ threshold: 25 })
  .resize(1024, 1024, {
    fit: "contain",
    background: "#00000000",
  })
  .png()
  .toBuffer();
await mkdir("public/branding", { recursive: true });
await writeFile("public/branding/monea-symbol.png", master);
const icon = async (size) =>
  sharp(master)
    .resize(size - 2, size - 2)
    .extend({
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
      background: "#00000000",
    })
    .png()
    .toBuffer();
for (const [file, size] of [
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 180],
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-touch-icon.png", 180],
])
  await writeFile(file, await icon(size));
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(icon));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let i = 0; i < sizes.length; i++) {
  const entry = 6 + i * 16;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frames[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frames[i].length;
  await writeFile(`public/branding/favicon-${sizes[i]}.png`, frames[i]);
}
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...frames]));
console.log(
  JSON.stringify({
    source: { width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha },
    output: "public/branding/monea-symbol.png",
    faviconFrames: sizes,
  }),
);
