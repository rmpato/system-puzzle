// Static build: `bun run build` → dist/, for any static host.
// Pages live at nested URLs (/play/<id>, /guide/<concept>), so the bundle is referenced from the root,
// and dist/404.html is a copy of the app for hosts that serve it on unknown paths (GitHub Pages, Netlify,
// Cloudflare Pages…): the client router then draws the right screen. `bun start` needs none of this.
import { rm, cp } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
await rm(`${root}dist`, { recursive: true, force: true });
const out = await Bun.build({ entrypoints: [`${root}index.html`], outdir: `${root}dist`, minify: true, publicPath: '/' });
if (!out.success) { for (const l of out.logs) console.error(l); process.exit(1); }
await cp(`${root}assets`, `${root}dist/assets`, { recursive: true });
await cp(`${root}public`, `${root}dist`, { recursive: true });
await cp(`${root}dist/index.html`, `${root}dist/404.html`);
for (const o of out.outputs) console.log(`  ${o.path.replace(root, '')}  ${(o.size / 1024).toFixed(0)} KB`);
console.log('  + assets/, favicon.svg, 404.html (SPA fallback)');
