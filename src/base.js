// Where the app is served from: "/" under `bun run dev` / `bun start`, "/system-puzzle/" on GitHub Pages.
// The static build writes it into <meta name="app-base">; every URL the app builds goes through url().
const meta = typeof document !== 'undefined' && document.querySelector('meta[name="app-base"]');
export const BASE = (meta?.content || '/').replace(/\/?$/, '/');
export const url = (p = '') => BASE + String(p).replace(/^\//, '');
