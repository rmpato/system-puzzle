// Video Night: a YouTube-lite. Playback via CDN, direct uploads, async transcoding, view counters.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './video-copy.js';

export default {
  id: 'video',
  title: 'Video Night',
  icon: '🎬',
  pitch: 'Uploads, transcoding, playback and a viral hit.',
  topics: ['CDN', 'Pre-signed uploads', 'Async jobs', 'Counters', 'HLS'],
  difficulty: 'Medium',
  brief: '"Build a video platform. Creators upload videos, viewers watch, search and see view counts."',
  money: 100,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { instance: 8, owncdn: 6, codec: 3, micro: 4 } },
    db: { node: 'db', base: 12 },
    read: { node: 'db', base: 0, per: { replica: 12 }, fallback: 'db' },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Viewers' },
    { id: 'api', model: 'servers', pos: [0, 0], label: 'API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Postgres', color: '#ffd59a' },
    { id: 'storage', model: 'stack', pos: [-5, 8.5], label: 'Object storage', color: '#c9e7ff' },
    { id: 'transcode', model: 'gear', pos: [12.5, 9.5], label: 'Transcoders', color: '#ffc9a8' },
  ],

  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'cdn', icon: '🌐', name: 'CDN', cost: 160, desc: 'Video segments skip the API', model: 'cloud', pos: [-8, -7.5], label: 'CDN', symptom: 'type:watch', relieves: 'api' },
    { id: 'presign', icon: '🪪', name: 'Direct upload', cost: 140, desc: 'Pre-signed URLs, API skipped', model: 'key', color: '#b7ebc6', pos: [-10, 4.5], label: 'Pre-signed URL', symptom: ['type:upload', 'hazard:timeout'], relieves: 'api' },
    { id: 'queue', icon: '📬', name: 'Job queue', cost: 180, desc: 'Jobs survive worker outages', model: 'tube', color: '#dbe2ec', pos: [4, 10.5], label: 'Job queue', symptom: 'outage', proactive: 2 },
    { id: 'idem', icon: '🔑', name: 'Job IDs', cost: 120, desc: 'No double transcoding', model: 'lock', color: '#ffd76a', pos: [-0.5, 12], label: 'Idempotent jobs', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'counter', icon: '🔢', name: 'View counter', cost: 170, desc: 'Batched view counts', model: 'counter', color: '#ffb3b3', pos: [8.5, -4.5], label: 'Redis counters', symptom: 'hot:db', proactive: 2 },
    { id: 'cache', icon: '🧺', name: 'Feed cache', cost: 150, desc: 'Cached home feed', model: 'box', color: '#ffcfcf', pos: [5.5, 5], label: 'Feed cache', symptom: 'hot:db', proactive: 2, relieves: 'read' },
    { id: 'search', icon: '🔍', name: 'Search index', cost: 200, desc: 'Cheap title search', model: 'octa', color: '#d5c5ff', pos: [3.5, -7.5], label: 'Search index', symptom: 'type:search', relieves: 'api' },
    { id: 'replica', icon: '📚', name: 'Read replica', cost: 220, max: 2, desc: 'More DB reads (not writes)', model: 'cyl', color: '#ffe6c2', slots: [[15.6, -3.2], [15.6, 3.2]], label: 'Replica', scales: 'read' },
    { id: 'owncdn', icon: '🛰️', name: 'Own CDN', cost: 400, upkeep: 3, trap: true, desc: '+capacity · costs $3/s', model: 'globe', color: '#9fdcff', pos: [-12, -6], label: 'Own edge PoPs' },
    { id: 'codec', icon: '🧪', name: 'Custom codec', cost: 300, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'film', color: '#e2c6ff', pos: [16.5, 7], label: 'Custom codec' },
    { id: 'micro', icon: '🧩', name: 'Microservices', cost: 300, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'cluster', pos: [0, 5.6], ghost: 4.6, label: '8 services' },
  ],

  wires: [
    ['users', 'api'],
    ['users', 'cdn', { if: 'cdn' }],
    ['cdn', 'storage', { if: 'cdn', dashed: true }],
    ['users', 'presign', { if: 'presign' }],
    ['presign', 'storage', { if: 'presign' }],
    ['api', 'storage', { unless: 'presign' }],
    ['api', 'db'],
    ['api', 'cache', { if: 'cache' }],
    ['api', 'search', { if: 'search' }],
    ['api', 'counter', { if: 'counter' }],
    ['counter', 'db', { if: 'counter', dashed: true }],
    ['db', 'replica', { if: 'replica', dashed: true }],
    ['storage', 'queue', { if: 'queue' }],
    ['queue', 'transcode', { if: 'queue' }],
    ['storage', 'transcode', { unless: 'queue' }],
    ['idem', 'queue', { if: 'idem', dashed: true }],
  ],

  types: {
    feed: { name: 'Home feed', color: '#2f6fed', steps: [{ pool: 'api', cost: 1 }, { pool: 'read', cost: 1, mods: { cache: 0.3 }, via: [{ item: 'cache', p: 0.7 }, { item: 'replica', p: 0.5 }] }] },
    watch: { name: 'Playback', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 4 }], cardOnSeen: 'stream', firstText: 'Video segments started hitting the API' },
    view: { name: 'View (ad)', color: '#1f9d55', value: 1, steps: [{ pool: 'api', cost: 0.5 }, { pool: 'db', cost: 1.5, mods: { counter: 0.1 }, via: [{ item: 'counter', p: 1 }] }], cashAt: 'api' },
    search: { name: 'Search', color: '#8b5cf6', steps: [{ pool: 'api', cost: 3, mods: { search: 0.25 } }, { pool: 'read', cost: 2, mods: { search: 0 } }], hops: [{ node: 'search', if: 'search' }], cardOnFail: 'search', cardOnFailUnless: 'search', firstText: 'Title search started hitting the DB' },
    upload: { name: 'Upload', color: '#e8559a', value: 6, steps: [{ pool: 'api', cost: 6, mods: { presign: 0.1 } }, { pool: 'db', cost: 1 }], hops: [{ node: 'storage' }], cashAt: 'storage', firstText: 'First 2 GB upload went through the API',
      event: { from: 'storage', to: 'transcode', via: 'queue', type: 'job' } },
  },
  events: { job: { name: 'Transcode job', color: '#f08c3a' } },

  phases: [
    { name: 'Launch', dur: 30, rates: { feed: 2, watch: 0.6, view: 0.8, upload: 0.15 }, news: ['feed', 'watch', 'view', 'upload'] },
    { name: 'Creators', dur: 50, rates: { feed: 4, watch: 2.5, view: 3, upload: 0.6, search: 1.2 }, news: ['search', 'More creators'], hazards: { duplicate: 0.1, timeout: 0.15 } },
    { name: 'Growth', dur: 55, rates: { feed: 8, watch: 6, view: 6, upload: 1.1, search: 3 }, news: ['Traffic ×3'], hazards: { duplicate: 0.12, timeout: 0.15, outage: [18, 34] } },
    { name: 'Viral hit', dur: 60, rates: { feed: 14, watch: 12, view: 15, upload: 1.8, search: 5.5 }, news: ['One video ×100'], hazards: { duplicate: 0.15, timeout: 0.15, spike: 8 } },
  ],

  hazards: {
    duplicate: { type: 'upload', fix: 'idem', card: 'dupjob', rep: 3, money: 8, text: '♻️ transcoded twice', blocked: '🔑 same job ID', at: 'transcode', firstText: 'A retried upload was transcoded twice', score: 6 },
    timeout: { type: 'upload', fix: 'presign', card: 'bigupload', rep: 1.5, text: '⏳ upload timed out', at: 'api', firstText: 'A big upload timed out in the API', score: 4 },
    outage: { node: 'transcode', label: 'Transcoders', card: 'transcode', rep: 1.5, startText: 'Transcoder workers went down', lostText: 'Uploads were lost: never transcoded', event: { to: 'transcode', via: 'queue', type: 'job' }, score: 3 },
    spike: { card: 'viral' },
    overload: { node: 'db', card: 'dbload', after: 3 },
  },

  questions: QUESTIONS,
  cards: CARDS,
  puzzles: PUZZLES,
  breaks: BREAKS,
  finals: FINALS,

  report: {
    required: [
      { item: 'cdn', flag: 'Video streamed from app servers' },
      { item: 'queue', flag: 'Transcoding not decoupled by a queue' },
      { item: 'idem', flag: 'No idempotency for transcode jobs' },
    ],
    proactive: [
      { item: 'idem', before: 'hazard:duplicate', signal: 'Idempotent jobs before the first double transcode' },
      { item: 'queue', before: 'outage', signal: 'Queued jobs before workers failed' },
      { item: 'counter', before: 'hot:db', signal: 'Batched view counts before the DB melted' },
      { item: 'presign', before: 'hazard:timeout', signal: 'Direct uploads before the first timeout' },
    ],
    combos: [{ items: ['idem', 'queue'], signal: 'At-least-once jobs + idempotent workers' }],
    counters: [
      { counter: 'lost', min: 3, flag: 'Lost {n} uploads in a transcoder outage' },
      { counter: 'duplicate', min: 3, flag: 'Transcoded the same upload twice {n}×' },
      { counter: 'timeout', min: 4, flag: '{n} uploads timed out in the API' },
    ],
    scaleFirst: { item: 'instance', fixes: [['type:watch', 'cdn'], ['type:upload', 'presign'], ['type:search', 'search']], flag: 'Added servers instead of moving bytes off them', signal: 'Moved bytes off the API before scaling' },
    noTraps: 'No homemade CDN, codec or microservices',
  },

  followups: [
    { q: 'Why shouldn\'t app servers stream video? Where do the bytes go?', when: { missing: 'cdn', wrong: ['stream', 'abr'] } },
    { q: 'How does a 4 GB upload reach storage without touching your API?', when: { missing: 'presign', wrong: ['bigupload', 'fields'], counter: ['timeout', 3] } },
    { q: 'Transcoders crash mid-job. What happens to the upload?', when: { missing: 'queue', wrong: ['transcode', 'sync'], counter: ['lost', 1] } },
    { q: 'A job is delivered twice. How do you avoid double work?', when: { missing: 'idem', wrong: ['dupjob'], counter: ['duplicate', 2] } },
    { q: 'One video gets 1M views a minute. How do you count them?', when: { missing: 'counter', wrong: ['viral', 'dbload', 'counting', 'eventual'] } },
    { q: 'Walk me through an upload, from click to playable.', when: { wrong: ['pipeline'] } },
    { q: 'What lives in the CDN, object storage, DB and cache?', when: { wrong: ['where'] } },
    { q: 'How would you serve the home feed to millions cheaply?', when: { missing: 'cache', wrong: ['feedcache'] } },
    { q: 'How do you search titles across millions of videos?', when: { missing: 'search', wrong: ['search'] } },
    { q: 'When would building your own CDN make sense?', when: { traps: true, wrong: ['start', 'final'] } },
    { q: 'Which decision would be the most expensive to reverse?', when: { always: true } },
  ],
};
