/**
 * Builds Whoply-Introduction.pdf from whoply-intro.template.html.
 *   node brochure/build.mjs
 * {{icon:name}} becomes an inline Lucide icon (read from whoply-app's lucide-react),
 * {{logo}} / {{logo:navy}} the Whoply mark. Printing is done by the Chrome on this
 * PC in headless mode (set CHROME_PATH if it lives somewhere else).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const iconDir = path.join(dir, '..', 'whoply-app', 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const OUT = path.join(dir, 'Whoply-Introduction.pdf');
const TMP = path.join(dir, '.build.html');
const PORT = 9334;
const previewAt = process.argv.indexOf('--preview');
const previewDir = previewAt > -1 ? process.argv[previewAt + 1] : null;

const chromePath = [
    process.env.CHROME_PATH,
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
].find((p) => p && existsSync(p));
if (!chromePath) throw new Error('Chrome not found — set CHROME_PATH');

function icon(name) {
    const src = readFileSync(path.join(iconDir, `${name}.js`), 'utf8');
    const m = src.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*?\])\s*\);/);
    if (!m) throw new Error(`Icon ${name}: unexpected file format`);
    const nodes = new Function(`return ${m[1]}`)();
    const body = nodes
        .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
        .join('');
    return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
const logo = (onNavy) =>
    `<svg class="logo" viewBox="0 0 40 40" fill="none" aria-hidden="true"><rect width="40" height="40" rx="11" fill="${onNavy ? '#D9C8B0' : '#0F2B46'}"/>` +
    `<path d="M9 13.5L14 27L20 16L26 27L31 13.5" stroke="${onNavy ? '#0F2B46' : '#ffffff'}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="20" cy="10.5" r="2.4" fill="#CC5500"/></svg>`;

const html = readFileSync(path.join(dir, 'whoply-intro.template.html'), 'utf8')
    .replace(/\{\{icon:([a-z0-9-]+)\}\}/g, (_, n) => icon(n))
    .replace(/\{\{logo:navy\}\}/g, logo(true))
    .replace(/\{\{logo\}\}/g, logo(false));
writeFileSync(TMP, html);

const profile = path.join(os.tmpdir(), 'whoply-brochure-chrome');
const chrome = spawn(chromePath, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' });

async function target() {
    for (let i = 0; i < 60; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const page = list.find((t) => t.type === 'page');
            if (page) return page.webSocketDebuggerUrl;
        } catch { /* not up yet */ }
        await sleep(500);
    }
    throw new Error('Chrome did not start');
}

const ws = new WebSocket(await target());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('socket failed')); });
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (!m.id || !pending.has(m.id)) return;
    const { res, rej } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) rej(new Error(m.error.message)); else res(m.result);
};
const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

try {
    await send('Page.enable');
    await send('Page.navigate', { url: pathToFileURL(TMP).href });
    for (let i = 0; i < 60 && (await evaluate('document.readyState')) !== 'complete'; i++) await sleep(250);
    await evaluate('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {})))).then(() => 1)');

    // A page whose content is taller than the sheet would be cut off silently — say so instead.
    const spill = await evaluate(`JSON.stringify([...document.querySelectorAll('.page')].map((p, i) => [i + 1, p.scrollHeight - p.clientHeight]).filter((r) => r[1] > 1))`);
    if (spill !== '[]') console.warn('Content overflows on [page, px]:', spill);

    const { data } = await send('Page.printToPDF', {
        printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
    });
    writeFileSync(OUT, Buffer.from(data, 'base64'));
    console.log(`Saved ${OUT} (${Math.round(Buffer.from(data, 'base64').length / 1024)} KB)`);

    // --preview <folder>: also save each page as a picture, to check the layout by eye.
    if (previewDir) {
        mkdirSync(previewDir, { recursive: true });
        await send('Emulation.setEmulatedMedia', { media: 'print' });
        await send('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1.5, mobile: false });
        const rects = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('.page')].map((p) => { const r = p.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height]; }))`));
        for (const [i, [x, y, width, height]] of rects.entries()) {
            const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x, y, width, height, scale: 1 } });
            writeFileSync(path.join(previewDir, `page-${i + 1}.png`), Buffer.from(shot.data, 'base64'));
        }
        console.log(`Saved ${rects.length} page pictures to ${previewDir}`);
    }
} finally {
    send('Browser.close').catch(() => {}); // the socket closes before a reply comes, so don't wait for one
    await sleep(400);
    chrome.kill();
    rmSync(TMP, { force: true });
}
