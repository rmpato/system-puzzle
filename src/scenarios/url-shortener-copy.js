// Tiny Links copy. Keep copy short: the game should be playable without reading.

export const QUESTIONS = [
  { q: 'Read/write ratio?', a: '~100 redirects per new link.', good: true },
  { q: 'How many new links?', a: '~100M a month, kept 10 years.', good: true },
  { q: 'Do customers need click stats?', a: 'Yes. That\'s what Pro pays for.', good: true },
  { q: 'Custom aliases?', a: 'Pro can claim /their-name.', good: true },
  { q: 'Redirect latency target?', a: 'Under 50 ms, worldwide.', good: true },
  { q: 'Can a link\'s target change?', a: 'Pro can edit the target.', good: true },
  { q: 'Microservices + sharding from day one?', a: '"We have zero links…"', good: false, flag: 'Over-engineering before requirements' },
  { q: 'Which frontend framework?', a: 'Not relevant to the backend.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

// Single-choice cards. Incidents fire during play; the rest appear in whiteboard breaks.
export const CARDS = {
  start: { icon: '🔢', title: 'How do you make codes?', text: 'Short, unique, never reused.', fix: 'idgen', opts: [
    o('Base62 of a counter (ID ranges)', true, 'Unique by construction, no lookups.'),
    o('First 7 chars of MD5(url)', false, 'Truncated hashes collide.'),
    o('UUID v4 as the code', false, '36 chars isn\'t short.')] },
  collision: { icon: '💥', title: 'Two links, one code', text: 'A random code already existed.', fix: 'idgen', opts: [
    o('ID service hands out counter ranges', true, 'No collisions, no retries.'),
    o('Random codes never collide', false, 'Birthday paradox says otherwise.'),
    o('Overwrite the old link', false, 'Breaks someone\'s live link.')] },
  race: { icon: '🏁', title: 'Two users claim /launch', text: 'Same alias, same millisecond.', fix: 'unique', opts: [
    o('Unique index + atomic insert', true, 'The DB picks one winner.'),
    o('Check it\'s free, then insert', false, 'Both see it free. Both win.'),
    o('Lock the whole links table', false, 'Serializes every create.')] },
  dbload: { icon: '🔥', title: 'Postgres at 100%', text: 'Almost all redirect lookups.', fix: 'cache', opts: [
    o('Cache code → URL in Redis', true, 'Hot codes served from memory.'),
    o('Shard by code now', false, 'Big complexity for a read problem.'),
    o('Bigger primary, forever', false, 'Vertical scaling has a ceiling.')] },
  viral: { icon: '🚀', title: 'A link went viral', text: 'Millions of clicks on one code.', fix: 'cdn', opts: [
    o('Cache the redirect at the CDN, short TTL', true, 'Edge serves it; edge logs count clicks.'),
    o('Add API servers', false, 'Paying compute for one key.'),
    o('Rate limit that link', false, 'Blocks real visitors.')] },
  spam: { icon: '🤖', title: 'Bots mass-create links', text: 'Spam from a few keys and IPs.', fix: 'ratelimit', opts: [
    o('Rate limit per API key and IP', true, 'Cheap rejects before the DB.'),
    o('Scale the database', false, 'Paying to store spam.'),
    o('Review links by hand', false, 'Can\'t keep up.')] },
  statsdown: { icon: '📉', title: 'Analytics is down', text: 'Clicks keep coming. Lost?', fix: 'queue', opts: [
    o('Publish clicks to a durable queue', true, 'Consumers catch up later.'),
    o('Write clicks in the request, retry', false, 'Redirects now fail with it.'),
    o('Drop them, just stats', false, 'Pro customers pay for stats.')] },
  slowstats: { icon: '🐢', title: 'Redirects are slow', text: 'They wait for the click insert.', fix: 'queue', opts: [
    o('Redirect now, log the click async', true, 'Analytics off the hot path.'),
    o('Bigger analytics database', false, 'Still on the hot path.'),
    o('Batch inserts inside the request', false, 'User still waits.')] },
  clickflood: { icon: '📈', title: 'Clicks ×10 tonight', text: 'Analytics ingest falls behind.', fix: 'queue', opts: [
    o('Queue buffers, scale consumers', true, 'Absorb the burst, drain later.'),
    o('Drop clicks above a limit', false, 'Loses paid data.'),
    o('UPDATE count = count + 1', false, 'One hot row, lock contention.')] },
  // whiteboard cards
  http: { icon: '↪️', title: '301 or 302?', text: 'Pro wants stats and edits.', opts: [
    o('302: every click reaches us', true, 'Counted, and target stays editable.'),
    o('301 for everything', false, 'Browsers cache it; clicks vanish.'),
    o('200 page with a JS redirect', false, 'Slower, worse for SEO.')] },
  length: { icon: '📏', title: 'How long is the code?', text: '100M links/month for 10 years.', opts: [
    o('7 chars base62 ≈ 3.5 trillion', true, '12B needed: huge headroom.'),
    o('4 chars base62', false, 'Only ~15M codes.'),
    o('20 chars, to be safe', false, 'Not short anymore.')] },
  index: { icon: '🗂️', title: 'Lookups are slow', text: 'Every redirect scans the table.', opts: [
    o('Unique index on short_code', true, 'Point lookup, enforces uniqueness.'),
    o('Index on long_url', false, 'Wrong lookup key.'),
    o('Cache it, skip the index', false, 'Cache misses still scan.')] },
  edit: { icon: '✏️', title: 'Pro edits a target', text: 'Old URL is cached everywhere.', opts: [
    o('Update DB, invalidate cache, short TTL', true, 'Fresh within seconds.'),
    o('Wait for the cache to expire', false, 'Wrong target for hours.'),
    o('Issue a new code instead', false, 'Printed links stay wrong.')] },
  expiry: { icon: '⌛', title: 'Expired links pile up', text: 'Billions of dead rows.', opts: [
    o('Check on read + batch cleanup', true, 'Cheap, off the hot path.'),
    o('Scan every row each minute', false, 'Full scans forever.'),
    o('Never delete anything', false, 'Breaks the expiry promise.')] },
  final: { icon: '🎯', title: 'Ship v1 next week, 2 devs', text: 'What do you keep?', opts: [
    o('Monolith, Postgres, Redis, async clicks', true, 'Fast reads, no lost stats.'),
    o('Shards and microservices', false, 'Scale you don\'t have yet.'),
    o('Skip analytics for now', false, 'That\'s what customers pay for.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Code format and 301 responses', true, 'Codes and 301s live forever.'),
    o('The Redis client library', false, 'Swappable behind an interface.'),
    o('The CDN vendor', false, 'Mostly configuration.')] },
};

// Interactive whiteboard puzzles
export const PUZZLES = {
  flow: {
    kind: 'order', icon: '🧭', title: 'Redirect path', text: 'Tap the redirect steps in order.',
    items: ['GET /aZ3kQ9x', 'Look up code in Redis', 'On miss, read Postgres', 'Fill the cache', 'Return 302 + Location', 'Consumer records the click'],
    signal: 'Walked the redirect path end to end', flag: 'Shaky on the redirect flow',
  },
  fields: {
    kind: 'pick', icon: '📝', title: 'POST /links', text: 'Pick the 3 fields the client sends.', pick: 3,
    items: [
      { t: 'long_url', good: true },
      { t: 'custom_alias (optional)', good: true },
      { t: 'expires_at (optional)', good: true },
      { t: 'short_code', good: false, why: 'Server generates it' },
      { t: 'user_id', good: false, why: 'Comes from the auth token' },
      { t: 'click_count', good: false, why: 'Server-owned stat' },
    ],
    signal: 'Designed a clean create-link contract', flag: 'Create-link contract trusts the client',
  },
  routing: {
    kind: 'sort', icon: '🔀', title: 'Where does it live?', text: 'Pick the store for each.',
    buckets: ['🧺 Redis', '🐘 Postgres', '📊 Analytics'],
    items: [
      { t: 'Hot code → URL', a: 0 },
      { t: 'Rate-limit counters', a: 0 },
      { t: 'Claim a custom alias', a: 1, why: 'Needs the unique constraint' },
      { t: 'Link owner and expiry', a: 1 },
      { t: 'Clicks per country', a: 2 },
      { t: 'Top referrers this week', a: 2 },
    ],
    signal: 'Right store for each kind of data', flag: 'Mixed up cache, source of truth and analytics',
  },
  status: {
    kind: 'sort', icon: '↪️', title: '301 or 302?', text: 'Pick the redirect for each link.',
    buckets: ['📌 301 Permanent', '🔁 302 Temporary'],
    items: [
      { t: 'Pro link with click stats', a: 1, why: '301 is cached; clicks skip us' },
      { t: 'Campaign link, target may change', a: 1 },
      { t: 'A/B test destination', a: 1 },
      { t: 'Old domain moved for good', a: 0 },
      { t: 'Docs link, never edited, no stats', a: 0, why: 'Cache it forever, save load' },
    ],
    signal: 'Knows the 301 vs 302 trade-off', flag: 'Unclear on 301 vs 302',
  },
};

// Whiteboard breaks happen before the phase with that index.
export const BREAKS = {
  1: ['flow', 'fields', 'length'],
  2: ['routing', 'http', 'index'],
  3: ['status', 'edit', 'expiry'],
};
export const FINALS = ['final', 'reverse'];
