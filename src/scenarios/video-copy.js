// Video Night copy. Keep it short: playable without reading.

export const QUESTIONS = [
  { q: 'Views vs uploads ratio?', a: 'Views ≫ uploads, ~100:1.', good: true },
  { q: 'Max video size?', a: 'Up to a few GB.', good: true },
  { q: 'How exact must view counts be?', a: 'Approximate, a few seconds late is fine.', good: true },
  { q: 'How soon is an upload watchable?', a: 'Within minutes is fine.', good: true },
  { q: 'Which devices and networks?', a: 'Mostly phones on shaky mobile data.', good: true },
  { q: 'Global audience?', a: 'Yes, viewers worldwide.', good: true },
  { q: 'Build our own codec and CDN?', a: '"We have zero viewers…"', good: false, flag: 'Over-engineering before requirements' },
  { q: 'Which player skin color?', a: 'Not relevant to the backend.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

export const CARDS = {
  start: { icon: '🏗️', title: 'First architecture?', text: 'Small team, launch in a month.', opts: [
    o('Monolith API + object storage + CDN', true, 'Managed pieces, simple core.'),
    o('Microservices per feature', false, 'Distributed cost, no reason yet.'),
    o('Own data centers and edge', false, 'Years of work before users.')] },
  stream: { icon: '📺', title: 'Video served by the API', text: 'Playback is most of the traffic.', fix: 'cdn', opts: [
    o('Serve segments from a CDN', true, 'Bytes from the edge, not servers.'),
    o('Add more API servers', false, 'Paying compute to move bytes.'),
    o('Store video in Postgres', false, 'Now the DB chokes too.')] },
  bigupload: { icon: '⏳', title: 'Uploads time out', text: '2 GB files through the API.', fix: 'presign', opts: [
    o('Pre-signed URL, upload to storage', true, 'API only signs, bytes skip it.'),
    o('Raise the API timeout', false, 'Workers stay tied up.'),
    o('Limit videos to 50 MB', false, 'Creators leave.')] },
  dupjob: { icon: '♻️', title: 'Same video transcoded twice', text: 'Client retried after a timeout.', fix: 'idem', opts: [
    o('Idempotent job ID per upload', true, 'Retries map to one job.'),
    o('Tell users not to retry', false, 'Networks retry for them.'),
    o('Delete duplicates nightly', false, 'Compute already wasted.')] },
  transcode: { icon: '🔥', title: 'Transcoders are down', text: 'Uploads keep arriving. Lost?', fix: 'queue', opts: [
    o('Queue jobs, workers drain it later', true, 'Durable jobs survive the outage.'),
    o('Transcode inside the upload call', false, 'Upload fails with it.'),
    o('Ask creators to re-upload', false, 'They go elsewhere.')] },
  viral: { icon: '🚀', title: 'A video goes viral', text: 'Millions of views on one row.', fix: 'counter', opts: [
    o('Buffer counts, flush batched deltas', true, 'One write per batch, not per view.'),
    o('UPDATE views+1 per view', false, 'One hot row, lock contention.'),
    o('Shard the videos table', false, 'Same row, same shard.')] },
  dbload: { icon: '🐘', title: 'Database at 100%', text: 'Mostly view-count UPDATEs.', fix: 'counter', opts: [
    o('Aggregate counts in Redis, flush', true, 'Batches turn N writes into 1.'),
    o('Add read replicas', false, 'Replicas don\'t take writes.'),
    o('Bigger primary', false, 'Writes keep growing.')] },
  search: { icon: '🐢', title: 'Title search is slow', text: 'LIKE \'%cats%\' on every video.', fix: 'search', opts: [
    o('Dedicated search index', true, 'Inverted index, scales alone.'),
    o('More DB CPU', false, 'Buys time, not a fix.'),
    o('Cache every query', false, 'Long tail, low hit rate.')] },
  // whiteboard cards
  sync: { icon: '🎞️', title: 'Transcode during the upload?', text: 'It takes minutes per video.', opts: [
    o('No: enqueue a job, reply 202', true, 'Slow work goes async.'),
    o('Yes, keep the request open', false, 'Timeouts and stuck workers.'),
    o('Transcode in the browser', false, 'Slow phones, untrusted output.')] },
  feedcache: { icon: '🏠', title: 'Home feed hits the DB', text: 'Same trending list for millions.', fix: 'cache', opts: [
    o('Cache the feed for a minute', true, 'One query serves millions.'),
    o('Recompute per request', false, 'Same answer, paid every time.'),
    o('Precompute for every user', false, 'Wasted on inactive users.')] },
  abr: { icon: '📶', title: 'Buffering on mobile', text: 'One 1080p MP4 per video.', opts: [
    o('HLS/DASH: segments in many bitrates', true, 'Player adapts to the network.'),
    o('Only serve 1080p', false, 'Stalls on weak networks.'),
    o('Only serve 360p', false, 'Blurry on good networks.')] },
  counting: { icon: '🔢', title: 'Counting views at scale', text: '1M views/min on one video.', opts: [
    o('Count in memory, flush per interval', true, 'Batched writes, tiny DB load.'),
    o('One INSERT per view, COUNT(*)', false, 'Huge table, slow reads.'),
    o('Lock the row on each view', false, 'Serializes every viewer.')] },
  eventual: { icon: '⏱️', title: 'View count lags', text: 'Creator sees 9,950, not 10,000.', opts: [
    o('Fine: counts are eventually consistent', true, 'Accuracy later, speed now.'),
    o('Bug: make it strongly consistent', false, 'Costs a hot-row write per view.'),
    o('Hide view counts', false, 'Creators need them.')] },
  final: { icon: '🎯', title: 'MVP next week, 3 people', text: 'What do you keep?', opts: [
    o('CDN, direct uploads, async transcode', true, 'The core paths that must scale.'),
    o('Own CDN and codec first', false, 'Commodity, buy it.'),
    o('Skip the job queue', false, 'Outages lose uploads.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Storage layout and video IDs', true, 'Every URL and job depends on them.'),
    o('The CDN vendor', false, 'Mostly configuration.'),
    o('The cache library', false, 'Swappable behind an interface.')] },
};

export const PUZZLES = {
  pipeline: {
    kind: 'order', icon: '🧭', title: 'Upload pipeline', text: 'Tap the steps in order.',
    items: ['Request upload URL', 'Upload to object storage', 'Enqueue transcode job', 'Transcode renditions', 'Publish HLS manifest', 'Notify subscribers'],
    signal: 'Walked the upload pipeline end to end', flag: 'Shaky on the upload pipeline',
  },
  fields: {
    kind: 'pick', icon: '📝', title: 'POST /uploads', text: 'Pick the 3 fields the client sends.', pick: 3,
    items: [
      { t: 'title', good: true },
      { t: 'size_bytes', good: true },
      { t: 'content_type', good: true },
      { t: 'video_id', good: false, why: 'Server generates it' },
      { t: 'user_id', good: false, why: 'From the auth token' },
      { t: 'storage_url', good: false, why: 'Server signs it' },
      { t: 'renditions', good: false, why: 'Server decides' },
    ],
    signal: 'Designed a safe upload contract', flag: 'Upload contract trusts the client',
  },
  where: {
    kind: 'sort', icon: '🗃️', title: 'Where does it live?', text: 'Pick the right store.',
    buckets: ['🌐 CDN', '🪣 Object store', '🐘 Postgres', '🧺 Redis'],
    items: [
      { t: 'Video segments being watched', a: 0 },
      { t: 'Thumbnails', a: 0 },
      { t: 'Original uploaded file', a: 1 },
      { t: 'Master renditions', a: 1, why: 'CDN pulls from the origin' },
      { t: 'Title, owner, status', a: 2 },
      { t: 'Comments', a: 2 },
      { t: 'Live view counter', a: 3, why: 'Hot increments, flushed later' },
      { t: 'Trending feed', a: 3 },
    ],
    signal: 'Put every byte in the right store', flag: 'Mixed up blob, metadata and cache stores',
  },
};

export const BREAKS = {
  1: ['pipeline', 'fields', 'sync'],
  2: ['where', 'feedcache', 'abr'],
  3: ['counting', 'eventual'],
};
export const FINALS = ['final', 'reverse'];
