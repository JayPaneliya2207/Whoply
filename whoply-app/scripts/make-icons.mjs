/**
 * Builds every Whoply icon from the logo mark (components/Logo.tsx) so the app,
 * admin and landing site all use the same one. Run after changing the mark:
 *
 *   npm run icons        (from whoply-app — uses the sharp that ships with Next)
 *
 * Writes:
 *   whoply-app/public/icon-192.png, icon-512.png   manifest "any" — navy tile, clear corners
 *   whoply-app/public/icon-maskable-512.png         manifest "maskable" — full navy square,
 *                                                   mark inside the 80% safe circle
 *   <app>/src/app/icon.svg                          favicon (Next adds the <link> tag)
 *   <app>/src/app/apple-icon.png                    180px iOS home-screen icon, full square
 * for <app> = whoply-app, whoply-admin, whoply-front.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const NAVY = '#0F2B46';
const DOT = '#CC5500'; // --accent-bright: fine for a graphic, never for text
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// The mark on a 40×40 grid (same paths as Logo.tsx). The stroke is a little
// heavier than on screen so it survives at 16px in a browser tab.
const mark = (stroke = 3) =>
    `<path d="M9 13.5L14 27L20 16L26 27L31 13.5" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    `<circle cx="20" cy="10.5" r="2.6" fill="${DOT}"/>`;

/** Rounded navy tile with clear corners — for tabs and "any" icons. */
const tile = () =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="11" fill="${NAVY}"/>${mark()}</svg>`;

/** Full navy square with the mark shrunk towards the centre — the OS cuts its own shape. */
const fullBleed = (scale) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${NAVY}"/>` +
    // the mark's own centre is (20, 17.8); move it to the middle, then scale
    `<g transform="translate(20 20) scale(${scale}) translate(-20 -17.8)">${mark()}</g></svg>`;

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 72 * (size / 40) }).resize(size, size).png().toFile(file);

const out = [];
const write = async (rel, make) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); await make(f); out.push(rel); };

await write('whoply-app/public/icon-192.png', (f) => png(tile(), 192, f));
await write('whoply-app/public/icon-512.png', (f) => png(tile(), 512, f));
// Maskable: Android may crop to a circle of 80% of the width — keep the mark well inside it.
await write('whoply-app/public/icon-maskable-512.png', (f) => png(fullBleed(0.8), 512, f));
for (const app of ['whoply-app', 'whoply-admin', 'whoply-front']) {
    await write(`${app}/src/app/icon.svg`, async (f) => fs.writeFileSync(f, tile() + '\n'));
    // iOS rounds the corners itself and shows any transparency as black, so no clear corners here.
    await write(`${app}/src/app/apple-icon.png`, (f) => png(fullBleed(0.9), 180, f));
}
console.log(out.map((f) => '  ' + f).join('\n'));
