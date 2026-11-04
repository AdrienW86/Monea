// Original vector lettering and botanical monogram, drawn for MONÉA.
// No embedded bitmap or external font is required. Run from the project root.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
const dir = "public/assets/brand";
await mkdir(dir, { recursive: true });
const letters = (ink, copper) => `<g fill="${ink}">
<path d="M20 160V30l65 90 65-90v130h-18V57l-49 69-59-81v115Z"/>
<path fill-rule="evenodd" d="M235 29c-42 0-64 28-64 66s22 67 64 67 64-29 64-67-22-66-64-66Zm0 3c31 0 44 29 44 63s-13 64-44 64-44-30-44-64 13-63 44-63Z"/>
<path d="M320 160V30l100 108V30h4v132L324 54v106Z"/>
<path d="M548 160 600 29l59 131h-21l-18-42h-51l-17 42Zm23-46h47l-25-57Z"/>
</g><g fill="${copper}"><path d="M447 30h81v4h-62v58h52v4h-52v60h62v4h-81Z"/><path d="m460 17 58-34 5 16-62 22Z"/></g>`;
const svg = (body, viewBox) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="MONÉA">${body}</svg>`;
for (const [variant, ink, copper] of [
  ["light", "#fff8f2", "#edb1a4"],
  ["dark", "#111816", "#ae403c"],
]) {
  await writeFile(
    `${dir}/monea-logo-${variant}.svg`,
    svg(letters(ink, copper), "0 -23 680 200"),
  );
}
const symbol = (ink, copper) =>
  `<path d="M194 65C170 20 103 16 62 53 17 94 23 166 66 198c44 34 108 20 132-26" fill="none" stroke="${copper}" stroke-width="3" stroke-linecap="round"/><path d="M67 174V74l43 61 44-61v100h-13V96l-32 45-39-54v87Z" fill="${ink}"/><g fill="${copper}"><path d="M157 178c1-35 7-70 37-104 13 42-11 66-37 104Z"/><path d="M163 177c16-29 33-39 61-36-12 25-32 28-61 36Z"/></g><g fill="none" stroke="${ink}" stroke-width="2"><path d="m157 181 35-94M162 178l49-31"/></g>`;
await writeFile(
  `${dir}/monea-symbol.svg`,
  svg(symbol("#111816", "#ae403c"), "0 0 240 240"),
);
await writeFile(
  `${dir}/monea-symbol-light.svg`,
  svg(symbol("#f5d6ca", "#edb1a4"), "0 0 240 240"),
);
const icon = svg(
  `<rect width="240" height="240" rx="52" fill="#111816"/>${symbol("#f5d6ca", "#edb1a4")}`,
  "0 0 240 240",
);
await writeFile("public/favicon.svg", icon);
await writeFile("src/app/icon.svg", icon);
for (const [name, size] of [
  ["apple-touch-icon", 180],
  ["icon-192", 192],
  ["icon-512", 512],
]) {
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toFile(`public/${name}.png`);
}
const og = svg(
  `<rect width="1200" height="630" fill="#111816"/><circle cx="1110" cy="620" r="360" fill="#edb1a4" opacity=".05"/><g transform="translate(90 52) scale(.65)">${symbol("#f5d6ca", "#edb1a4")}</g><g transform="translate(210 230) scale(1.15)">${letters("#fff8f2", "#edb1a4")}</g><path d="M365 465h470" stroke="#edb1a4"/><text x="600" y="518" fill="#fff8f2" font-family="sans-serif" font-size="22" letter-spacing="5" text-anchor="middle">INSTITUT DE BEAUTÉ · PERPIGNAN</text>`,
  "0 0 1200 630",
);
await writeFile(`${dir}/opengraph.svg`, og);
await sharp(Buffer.from(og)).png().toFile(`${dir}/opengraph.png`);
