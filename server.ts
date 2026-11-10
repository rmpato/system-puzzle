// Under Load server.
// `bun run dev`: bundles index.html and its modules on the fly, with hot reload.
// `bun start`:   same server in production mode (minified, cached bundle).
//
// Every screen has its own URL. Bun serves the same bundled app at each route and the client
// router (src/main.js, "routes") draws the right screen, so links can be shared, opened in a new tab,
// reloaded, and walked with back/forward:
//   /                 the exercise picker
//   /play/<id>        an exercise
//   /guide            field guide contents
//   /guide/<concept>  one primer
// The server imports the same registries as the client, so an unknown exercise or primer is a real 404.
import index from './index.html';
import { byId } from './src/scenarios/index.js';
import { conceptById } from './src/learn.js';

const port = Number(process.env.PORT) || 5199;
const dev = process.env.NODE_ENV !== 'production';

const notFound = (what = 'This page') => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found · Under Load</title><link rel="icon" href="/favicon.svg">
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f3f0;color:#15171c;font:15px/1.5 system-ui,sans-serif">
  <main style="text-align:center"><p style="font:500 12px ui-monospace,monospace;letter-spacing:.1em;color:#6b7079">404</p>
  <h1 style="margin:6px 0 10px;font-size:28px;letter-spacing:-.02em">${what} isn't on the board.</h1>
  <p><a href="/" style="color:#2450e8">Pick an exercise</a> · <a href="/guide" style="color:#2450e8">Open the field guide</a></p></main>`,
  { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

const server = Bun.serve({
  port,
  development: dev && { hmr: true, console: true },
  routes: {
    '/': index,
    '/guide': index,
    // dynamic pages: check the id against the registry, then serve the app (the bundled page at "/")
    '/play/:id': (req) => (byId(req.params.id) ? app(req) : notFound('That exercise')),
    '/guide/:id': (req) => (conceptById(req.params.id) ? app(req) : notFound('That primer')),
    '/favicon.svg': () => new Response(Bun.file(`${import.meta.dir}/public/favicon.svg`)),
    '/favicon.ico': () => new Response(Bun.file(`${import.meta.dir}/public/favicon.svg`), { headers: { 'Content-Type': 'image/svg+xml' } }),
    '/assets/*': async (req) => {
      const path = decodeURIComponent(new URL(req.url).pathname);
      if (path.includes('..')) return notFound();
      const file = Bun.file(`${import.meta.dir}${path}`);
      return (await file.exists())
        ? new Response(file, { headers: { 'Cache-Control': dev ? 'no-store' : 'public, max-age=86400' } })
        : notFound();
    },
  },
  fetch: () => notFound(), // anything not routed above
});

// The bundled page for a validated dynamic route: ask this same server for "/" (keeps dev hot reload intact).
async function app(req: Request) {
  const res = await fetch(new URL('/', server.url));
  const headers = new Headers(res.headers);
  headers.delete('content-encoding'); // fetch already decoded the body
  headers.delete('content-length');
  return new Response(res.body, { status: 200, headers });
}

console.log(`Under Load → ${server.url}`);
console.log(`  exercises: /play/<id>   field guide: /guide, /guide/<concept>`);
