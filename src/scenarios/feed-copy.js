// Social Feed copy. Keep it short: playable without reading.

export const QUESTIONS = [
  { q: 'Read/write ratio?', a: 'Reads ≫ writes, about 100:1.', good: true },
  { q: 'How fresh must the feed be?', a: 'A few seconds of lag is fine.', good: true },
  { q: 'Max followers per account?', a: 'Celebrities have millions.', good: true },
  { q: 'Chronological or ranked?', a: 'Chronological at launch.', good: true },
  { q: 'Photos and video?', a: 'Photos now, video later.', good: true },
  { q: 'Exact like counts?', a: 'Approximate is fine.', good: true },
  { q: 'Graph DB + ML ranking day one?', a: '"We have no users yet…"', good: false, flag: 'Over-engineering before requirements' },
  { q: 'Light or dark theme?', a: 'Not a backend question.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

// Single-choice cards. Incidents fire during play; the rest appear in whiteboard breaks.
export const CARDS = {
  start: { icon: '🏗️', title: 'How is the home feed built?', text: 'Reads ≫ writes.', fix: 'timeline', opts: [
    o('Fan-out on write to Redis timelines', true, 'Reads become one list fetch.'),
    o('Join follows + posts on every read', false, 'Heavy query on every refresh.'),
    o('ML-ranked feed from day one', false, 'No signals to rank yet.')] },
  dbload: { icon: '🔥', title: 'Postgres at 100%', text: 'Home feed reads dominate.', fix: 'timeline', opts: [
    o('Precompute timelines in Redis', true, 'Pay once on write, read cheap.'),
    o('Shard Postgres now', false, 'Big complexity for a read problem.'),
    o('Bigger primary, forever', false, 'Vertical scaling has a ceiling.')] },
  media: { icon: '🖼️', title: 'Photos through the API', text: 'Bandwidth is eating servers.', fix: 'cdn', opts: [
    o('Object storage + CDN, post holds URL', true, 'Bytes skip the API.'),
    o('Store images in Postgres', false, 'Now the DB moves bytes.'),
    o('Add more API servers', false, 'Paying compute to move bytes.')] },
  celeb: { icon: '⭐', title: 'A celebrity posted', text: '5M followers = 5M timeline writes.', fix: 'hybrid', opts: [
    o('Hybrid: merge celeb posts at read', true, 'Few celebs, pulled on demand.'),
    o('Add fan-out workers', false, 'Next celebrity melts it again.'),
    o('Fan out to everyone anyway', false, 'Minutes of lag, hot keys.')] },
  double: { icon: '👯', title: 'Post appeared twice', text: 'App retried on flaky 4G.', fix: 'idem', opts: [
    o('Idempotency key per post', true, 'Retry returns the same post.'),
    o('Disable the button', false, 'Network retries still duplicate.'),
    o('Dedupe by identical text', false, 'Users repeat posts on purpose.')] },
  race: { icon: '🏁', title: 'Like count went down', text: 'Two likes, read then write.', fix: 'counter', opts: [
    o('Atomic INCR, flush in batches', true, 'No lost updates, few DB writes.'),
    o('SELECT count, then UPDATE', false, 'Both read 41. Both write 42.'),
    o('COUNT(*) likes on every view', false, 'Scans millions of rows.')] },
  notify: { icon: '🔕', title: 'Notifications are down', text: 'Posts keep coming. Lost?', fix: 'queue', opts: [
    o('Publish events to a durable queue', true, 'Delivered when it recovers.'),
    o('Retry inline while posting', false, 'Posting now fails with it.'),
    o('Skip them, just alerts', false, 'Followers miss new posts.')] },
  viral: { icon: '🚀', title: 'A post is going viral', text: 'Feed reads and likes ×2.', opts: [
    o('Serve cached timelines, batch counts', true, 'Hot reads never touch Postgres.'),
    o('Recompute feeds on every refresh', false, 'Melts the DB at peak.'),
    o('Turn off likes for now', false, 'Kills the engagement you want.')] },
  // whiteboard cards
  ranking: { icon: '🧠', title: 'PM wants a ranked feed', text: 'Launch is next month.', opts: [
    o('Chronological first, rank later', true, 'No signals yet; simple wins.'),
    o('Train an ML ranker now', false, 'No data, high upkeep.'),
    o('Rank by like count only', false, 'Old viral posts forever.')] },
  graph: { icon: '🕸️', title: 'Where does the follow graph live?', text: 'Who follows whom.', opts: [
    o('Postgres table, indexed both ways', true, 'Feeds need one hop only.'),
    o('A graph database', false, 'Built for deep traversals.'),
    o('JSON array on the user row', false, 'Millions of followers per row.')] },
  pagination: { icon: '📜', title: 'Infinite scroll', text: 'New posts arrive mid-scroll.', opts: [
    o('Cursor: posts older than last ID', true, 'Stable pages under inserts.'),
    o('OFFSET 40 LIMIT 20', false, 'Shifts: duplicates and gaps.'),
    o('Send the whole feed once', false, 'Megabytes per open.')] },
  counts: { icon: '❤️', title: 'Exact like counts?', text: 'Shown on every post.', opts: [
    o('Eventually consistent is fine', true, 'Seconds stale, nobody notices.'),
    o('Strongly consistent on every view', false, 'Locks a hot row per like.'),
    o('Hide all counts', false, 'Product wants them.')] },
  inactive: { icon: '💤', title: 'Fan out to inactive users?', text: '60% idle for a month.', opts: [
    o('Skip them; rebuild on next login', true, 'Saves most fan-out writes.'),
    o('Fan out to everyone', false, 'Writes nobody reads.'),
    o('Delete idle accounts', false, 'Not an engineering call.')] },
  final: { icon: '🎯', title: 'MVP with 3 engineers', text: 'What do you keep?', opts: [
    o('Monolith, Redis timelines, chronological', true, 'Fast reads, little to run.'),
    o('Graph DB, ML ranking, services', false, 'Upkeep before users.'),
    o('Skip idempotency and the queue', false, 'Duplicates and lost alerts.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Post IDs and the fan-out model', true, 'Timelines and cursors depend on them.'),
    o('The cache library', false, 'Swappable behind an interface.'),
    o('The CDN vendor', false, 'Mostly configuration.')] },
};

// Interactive whiteboard puzzles
export const PUZZLES = {
  flow: {
    kind: 'order', icon: '🧭', title: 'Publish a post', text: 'Tap the steps in order.',
    items: ['Client sends post + idempotency key', 'Store post in Postgres', 'Enqueue fan-out job', 'Push post ID to follower timelines', 'Notify followers'],
    signal: 'Walked the post flow end to end', flag: 'Shaky on the post publish flow',
  },
  contract: {
    kind: 'pick', icon: '📝', title: 'POST /posts', text: 'Pick the 3 fields the client sends.', pick: 3,
    items: [
      { t: 'text', good: true },
      { t: 'media_ids', good: true },
      { t: 'idempotency_key', good: true },
      { t: 'author_id', good: false, why: 'Comes from the auth token' },
      { t: 'like_count', good: false, why: 'Server owns counters' },
      { t: 'follower_ids', good: false, why: 'Server reads the graph' },
    ],
    signal: 'Designed a safe post contract', flag: 'Post contract trusts the client',
  },
  storage: {
    kind: 'sort', icon: '🔀', title: 'Where does it live?', text: 'Pick a store for each.',
    buckets: ['⚡ Redis', '🐘 Postgres', '🪣 S3 + CDN'],
    items: [
      { t: 'Home timeline (post IDs)', a: 0 },
      { t: 'Like counters', a: 0, why: 'INCR, flushed in batches' },
      { t: 'Posts', a: 1 },
      { t: 'Follow graph', a: 1 },
      { t: 'Photos', a: 2 },
      { t: 'Avatars', a: 2 },
    ],
    signal: 'Right store for each kind of data', flag: 'Mixed up hot, durable and blob data',
  },
};

// Whiteboard breaks happen before the phase with that index.
export const BREAKS = {
  1: ['flow', 'ranking', 'graph'],
  2: ['storage', 'contract', 'pagination'],
  3: ['inactive', 'counts'],
};
export const FINALS = ['final', 'reverse'];
