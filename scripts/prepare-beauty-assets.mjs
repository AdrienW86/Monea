import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
const names = [
  "portrait",
  "regard",
  "ongles",
  "visage",
  "peau",
  "maquillage",
  "ambiance",
];
await mkdir("public/assets/beauty", { recursive: true });
for (const name of names) {
  await sharp(`design/generated/${name}.png`)
    .rotate()
    .resize({
      width: name === "ambiance" ? 1600 : name === "portrait" ? 1280 : 1000,
      withoutEnlargement: true,
    })
    .webp({ quality: 84, effort: 5 })
    .toFile(`public/assets/beauty/${name}.webp`);
  const file = await stat(`public/assets/beauty/${name}.webp`);
  console.log(`${name}.webp: ${Math.round(file.size / 1024)} Ko`);
}
