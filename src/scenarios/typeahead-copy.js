// Type Ahead copy. Keep copy short: the game should be playable without reading.

export const QUESTIONS = [
  { q: 'Latency target?', a: 'Under 100 ms per keystroke.', good: true },
  { q: 'How much traffic?', a: '~10B searches a day, ~8 keys each.', good: true },
  { q: 'How many suggestions?', a: 'Top 5, ranked by popularity.', good: true },
  { q: 'How fresh must they be?', a: 'Daily is fine; news within minutes.', good: true },
  { q: 'Any content rules?', a: 'No offensive suggestions, ever.', good: true },
  { q: 'Languages and spelling fixes?', a: 'English, prefix match only for v1.', good: true },
  { q: 'Personalized ML ranking on day one?', a: '"We don\'t have query logs yet…"', good: false, flag: 'Over-engineering before requirements' },
  { q: 'Which JS framework for the box?', a: 'Not relevant to the backend.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

// Single-choice cards. Incidents fire during play; the rest appear in whiteboard breaks.
export const CARDS = {
  start: { icon: '🌳', title: 'Where do suggestions come from?', text: 'Top 5 for "wea", in 100 ms.', fix: 'trie', opts: [
    o('Precomputed top-k per prefix, in memory', true, 'One lookup per keystroke.'),
    o('LIKE \'wea%\' + ORDER BY count', false, 'Scan and sort on every key.'),
    o('Rank all terms live per request', false, 'Way over the latency budget.')] },
  dbload: { icon: '🔥', title: 'Postgres at 100%', text: 'Prefix scans on every keystroke.', fix: 'trie', opts: [
    o('Serve from an in-memory top-k trie', true, 'O(prefix length), no DB.'),
    o('Add read replicas', false, 'Still scanning, just more copies.'),
    o('Shard the terms table', false, 'Spreads a bad query around.')] },
  hot: { icon: '🔥', title: 'Everyone types "weath…"', text: 'Same few prefixes, millions of times.', fix: 'cdn', opts: [
    o('Cache hot prefixes at the edge', true, 'Same answer for everyone. Cache it.'),
    o('Add API servers', false, 'Paying compute for identical answers.'),
    o('Rate limit those prefixes', false, 'Blocks real users.')] },
  stale: { icon: '📰', title: 'News term not suggested', text: 'Trie was built last night.', fix: 'trend', opts: [
    o('Stream recent counts, merge hot terms', true, 'Trends appear in minutes.'),
    o('Rebuild the whole trie every minute', false, 'Huge cost for a few new terms.'),
    o('Fall back to a DB scan', false, 'Slow, and melts the DB.')] },
  surge: { icon: '🚨', title: 'Breaking news!', text: 'One term, ×3 traffic, right now.', fix: 'trend', opts: [
    o('Edge cache + trending merge', true, 'Hot and fresh, no DB.'),
    o('Scale servers ×10 instantly', false, 'Slow to boot, still stale.'),
    o('Turn suggestions off', false, 'Search box feels broken.')] },
  logsdown: { icon: '📉', title: 'Log pipeline is down', text: 'Searches keep coming. Logs lost?', fix: 'queue', opts: [
    o('Publish query logs to a durable queue', true, 'Aggregation catches up later.'),
    o('Write logs in the request, retry', false, 'Searches now fail with it.'),
    o('Drop them, it\'s just logs', false, 'Logs are what build the trie.')] },
  slowlog: { icon: '🐢', title: 'Searches are slow', text: 'They wait for the log write.', fix: 'queue', opts: [
    o('Log async, off the request path', true, 'Users never wait on analytics.'),
    o('Bigger log database', false, 'Still on the hot path.'),
    o('Sample 1% of logs', false, 'Rare terms vanish from counts.')] },
  offensive: { icon: '🙊', title: 'Offensive suggestion spotted', text: 'Screenshots are spreading.', opts: [
    o('Blocklist at build + live kill switch', true, 'Clean trie, instant removal.'),
    o('Retrain the ranking model', false, 'Takes days. It\'s live now.'),
    o('Let users report it', false, 'Damage is already done.')] },
  // whiteboard cards
  debounce: { icon: '⏱️', title: 'Typing "weather" = 7 calls', text: 'Most results are never seen.', fix: 'debounce', opts: [
    o('Debounce ~150 ms, min 2 chars', true, 'Fewer calls, same feel.'),
    o('Send one call per keystroke', false, 'Pays for discarded answers.'),
    o('Only suggest after Enter', false, 'That\'s not autocomplete.')] },
  topk: { icon: '🔝', title: 'What does a trie node hold?', text: 'Need top 5 instantly.', opts: [
    o('Its precomputed top 5 terms', true, 'No subtree walk at read time.'),
    o('Just a child pointer map', false, 'Walk the subtree every keystroke.'),
    o('Every term below it', false, 'Memory explodes near the root.')] },
  like: { icon: '🐘', title: 'Why not SQL LIKE?', text: '"LIKE \'ab%\' uses an index."', opts: [
    o('Still scans + sorts matches per key', true, 'Short prefixes match millions.'),
    o('LIKE is fine at any scale', false, '"a%" matches everything.'),
    o('Use LIKE \'%ab%\' instead', false, 'No index at all.')] },
  fresh: { icon: '♻️', title: 'Rebuild the trie how often?', text: 'Freshness vs cost.', opts: [
    o('Daily batch + real-time trending', true, 'Cheap base, fresh where it matters.'),
    o('Rebuild on every search', false, 'Rebuild cost × billions.'),
    o('Monthly is enough', false, 'Misses everything new.')] },
  personal: { icon: '👤', title: 'Personalize from day one?', text: 'PM wants "for you" suggestions.', opts: [
    o('Global first, re-rank per user later', true, 'Needs logs and caching works.'),
    o('Per-user trie for everyone', false, 'Memory ×users, no edge cache.'),
    o('ML ranker on every keystroke', false, 'Blows the 100 ms budget.')] },
  final: { icon: '🎯', title: 'Ship v1 next week, 2 devs', text: 'What do you keep?', opts: [
    o('Trie, debounce, edge cache, async logs', true, 'Fast, cheap, keeps learning.'),
    o('Sharded tries and personal ML', false, 'Scale you don\'t have yet.'),
    o('LIKE queries, optimize later', false, 'Dies on the first traffic.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Query log schema and retention', true, 'Lost history can\'t be rebuilt.'),
    o('The edge cache TTL', false, 'One config change.'),
    o('Debounce delay', false, 'Ship a new client value.')] },
};

// Interactive whiteboard puzzles
export const PUZZLES = {
  pipeline: {
    kind: 'order', icon: '🏭', title: 'Build the suggestions', text: 'Tap the offline steps in order.',
    items: ['Collect query logs', 'Aggregate counts per term', 'Compute top-k per prefix', 'Build trie snapshot', 'Swap it in atomically', 'Serve from memory'],
    signal: 'Walked the offline trie pipeline', flag: 'Shaky on how suggestions get built',
  },
  fields: {
    kind: 'pick', icon: '📝', title: 'Query log record', text: 'Pick the 3 fields to log.', pick: 3,
    items: [
      { t: 'query text', good: true },
      { t: 'timestamp', good: true },
      { t: 'locale / country', good: true },
      { t: 'full suggestion list HTML', good: false, why: 'Bulky, rebuildable' },
      { t: 'user password hash', good: false, why: 'Never log secrets' },
      { t: 'every keystroke typed', good: false, why: 'Log final searches only' },
    ],
    signal: 'Logged what ranking needs, nothing more', flag: 'Query log misses or overshares',
  },
  tiers: {
    kind: 'sort', icon: '🗃️', title: 'Where does it live?', text: 'Pick the tier for each.',
    buckets: ['🌐 Edge cache', '🧠 In memory', '🗄️ Offline storage'],
    items: [
      { t: 'Top 5 for "weather"', a: 0, why: 'Same for everyone, cache it' },
      { t: 'Top 5 for a rare prefix', a: 1 },
      { t: 'Trending terms, last 10 min', a: 1 },
      { t: 'Blocklist kill switch', a: 1, why: 'Must apply instantly' },
      { t: 'Raw query logs', a: 2 },
      { t: 'Daily term counts', a: 2 },
    ],
    signal: 'Right tier for each piece of data', flag: 'Mixed up edge, memory and offline data',
  },
};

// Whiteboard breaks happen before the phase with that index.
export const BREAKS = {
  1: ['pipeline', 'debounce', 'like'],
  2: ['fields', 'topk', 'fresh'],
  3: ['tiers', 'personal'],
};
export const FINALS = ['final', 'reverse'];
