// Publish the preview: build for GitHub Pages (/system-puzzle/) and push dist/ to the gh-pages branch.
// Usage: bun run deploy:pages   (needs push access to origin)
import { $ } from 'bun';
import { mkdtemp, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
await $`BASE_PATH=/system-puzzle/ bun ${root}tools/build.ts`;
const origin = (await $`git -C ${root} remote get-url origin`.text()).trim();
const rev = (await $`git -C ${root} rev-parse --short HEAD`.text()).trim();
const branch = (await $`git -C ${root} rev-parse --abbrev-ref HEAD`.text()).trim();
const dir = await mkdtemp(join(tmpdir(), 'under-load-pages-'));
await cp(join(root, 'dist'), dir, { recursive: true });
await $`git -C ${dir} init -q -b gh-pages && git -C ${dir} add -A && git -C ${dir} commit -q -m ${`Preview build of ${branch} (${rev})`}`;
await $`git -C ${dir} push -q -f ${origin} gh-pages`;
console.log(`Published ${branch} @ ${rev} → https://rmpato.github.io/system-puzzle/ (live in a minute or two)`);
