// Static build: `bun run build` → dist/, for any static host.
//   BASE_PATH=/system-puzzle/ bun tools/build.ts   (or `bun run build:pages`) for a sub-path such as GitHub Pages.
// Pages live at nested URLs (/play/<id>, /guide/<concept>), so the bundle is referenced from the base,
// the base is written into <meta name="app-base"> for the client router and asset URLs (src/base.js),
// and dist/404.html is a copy of the app for hosts that serve it on unknown paths (GitHub Pages, Netlify,
// Cloudflare Pages…): the client router then draws the right screen. `bun start` needs none of this.
import { rm, cp, writeFile, readFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
await rm(`${root}dist`, { recursive: true, force: true });
const out = await Bun.build({ entrypoints: [`${root}index.html`], outdir: `${root}dist`, minify: true, publicPath: base });
if (!out.success) { for (const l of out.logs) console.error(l); process.exit(1); }
await cp(`${root}assets`, `${root}dist/assets`, { recursive: true });
await cp(`${root}public`, `${root}dist`, { recursive: true });
const html = (await readFile(`${root}dist/index.html`, 'utf8')).replace(/<meta name="app-base" content="[^"]*"/, `<meta name="app-base" content="${base}"`);
await writeFile(`${root}dist/index.html`, html);
await writeFile(`${root}dist/404.html`, html);
// a real page for every route, so deep links answer 200 on hosts with no rewrites (404.html stays as the fallback)
const { SCENARIOS } = await import(`${root}src/scenarios/index.js`);
const { CONCEPTS } = await import(`${root}src/learn.js`);
const routes = ['guide', ...SCENARIOS.map((x) => `play/${x.id}`), ...CONCEPTS.map((c) => `guide/${c.id}`)];
for (const r of routes) { await mkdir(`${root}dist/${r}`, { recursive: true }); await writeFile(`${root}dist/${r}/index.html`, html); }
await writeFile(`${root}dist/.nojekyll`, ''); // GitHub Pages: serve files as they are
for (const o of out.outputs) console.log(`  ${o.path.replace(root, '')}  ${(o.size / 1024).toFixed(0)} KB`);
console.log(`  + assets/, favicon.svg, ${routes.length} route pages, 404.html (fallback) · base ${base}`);
