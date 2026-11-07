// Social Feed: a Twitter/Instagram-style home timeline.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './feed-copy.js';

export default {
  id: 'feed',
  title: 'Social Feed',
  icon: '📰',
  pitch: 'Timelines, celebrities, likes and a viral night.',
  topics: ['Fan-out on write', 'Celebrity hot keys', 'Timeline cache', 'Batched counters', 'Cursor pagination'],
  difficulty: 'Hard',
  brief: '"Design a social feed like Twitter or Instagram. Users post, follow people, and scroll a home timeline of the people they follow."',
  money: 200,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 10, per: { server: 8, micro: 4 } },
    db: { node: 'db', base: 14 },
    read: { node: 'db', base: 0, per: { replica: 12 }, fallback: 'db' },
    fan: { node: 'fanout', base: 8, per: { worker: 6 } },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Users' },
    { id: 'api', model: 'servers', pos: [-4, 0], label: 'Feed API', item: 'server', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [8, 0], label: 'Postgres', color: '#ffd59a' },
    { id: 'fanout', model: 'gear', pos: [3, 6.5], label: 'Fan-out workers', color: '#c7d2fe' },
    { id: 'notify', model: 'bell', pos: [15, 10], label: 'Notifications', color: '#fbc3dc' },
  ],

  shop: [
    { id: 'server', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'timeline', icon: '⚡', name: 'Timelines', cost: 200, desc: 'Precomputed feeds in Redis', model: 'box', color: '#ffb3b3', pos: [3, -6], label: 'Redis timelines', symptom: 'hot:db', proactive: 1, relieves: 'read' },
    { id: 'idem', icon: '🔑', name: 'Idem. keys', cost: 120, desc: 'Retried posts never duplicate', model: 'key', color: '#ffd76a', pos: [-9.5, 4], label: 'Idempotency', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'replica', icon: '📚', name: 'Read replica', cost: 220, max: 2, desc: 'More DB capacity for reads', model: 'cyl', color: '#ffe6c2', slots: [[12.5, -3.8], [12.5, 3.8]], label: 'Replica', scales: 'read' },
    { id: 'cdn', icon: '🌐', name: 'S3 + CDN', cost: 160, desc: 'Photos skip the API', model: 'cloud', pos: [-9, -7], label: 'S3 + CDN', symptom: 'type:media', relieves: 'api' },
    { id: 'hybrid', icon: '⭐', name: 'Hybrid fanout', cost: 170, desc: 'Celeb posts pulled at read', model: 'funnel', color: '#ffe08a', pos: [-1, 4.8], label: 'Hybrid fan-out', symptom: 'type:celeb', relieves: 'fan' },
    { id: 'worker', icon: '⚙️', name: 'Fanout worker', cost: 150, costStep: 0.2, max: 2, desc: '+6 fan-out jobs/s', model: 'gear', color: '#dfe5ff', slots: [[0, 9.5], [6, 9.5]], label: 'Worker', scales: 'fan' },
    { id: 'counter', icon: '🔢', name: 'Like counter', cost: 140, desc: 'Atomic INCR, batched flush', model: 'counter', color: '#cfd6e2', pos: [8, 4.6], label: 'Like counters', symptom: 'hazard:race', proactive: 2 },
    { id: 'queue', icon: '📬', name: 'Queue', cost: 180, desc: 'Notifications survive outages', model: 'tube', color: '#dbe2ec', pos: [10.5, 10.5], label: 'Queue', symptom: 'outage', proactive: 2 },
    { id: 'ranker', icon: '🧠', name: 'ML ranking', cost: 250, upkeep: 3, trap: true, desc: 'Ranked feed · costs $3/s', model: 'sphere', color: '#e9d5ff', pos: [-1.5, -7.5], label: 'ML ranker' },
    { id: 'graph', icon: '🕸️', name: 'Graph DB', cost: 240, upkeep: 2, trap: true, desc: 'Follows in a graph DB · $2/s', model: 'octa', color: '#d5c5ff', pos: [14, -7.5], label: 'Graph DB' },
    { id: 'micro', icon: '🧩', name: 'Microservices', cost: 260, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'cluster', pos: [-5.5, 5.5], ghost: 4.6, label: '9 services' },
  ],

  wires: [
    ['users', 'api'],
    ['users', 'cdn', { if: 'cdn' }],
    ['api', 'db'],
    ['api', 'timeline', { if: 'timeline' }],
    ['db', 'replica', { if: 'replica', dashed: true }],
    ['db', 'counter', { if: 'counter', dashed: true }],
    ['db', 'fanout'],
    ['fanout', 'timeline', { if: 'timeline' }],
    ['fanout', 'worker', { if: 'worker', dashed: true }],
    ['hybrid', 'fanout', { if: 'hybrid', dashed: true }],
    ['db', 'queue', { if: 'queue' }],
    ['queue', 'notify', { if: 'queue' }],
    ['db', 'notify', { unless: 'queue' }],
    ['graph', 'db', { if: 'graph', dashed: true }],
    ['ranker', 'api', { if: 'ranker', dashed: true }],
  ],

  types: {
    // Home timeline: without precomputed timelines it is a follows ⨝ posts query on every refresh.
    home: { name: 'Home feed', color: '#2f6fed', steps: [{ pool: 'api', cost: 0.8 }, { pool: 'read', cost: 2, mods: { timeline: 0.2 }, via: [{ item: 'timeline', p: 0.85 }, { item: 'replica', p: 0.5 }] }] },
    // Normal post: stored once, then fanned out to ~200 follower timelines (only once timelines exist).
    post: { name: 'Post', color: '#1f9d55', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 1 }, { pool: 'fan', cost: 0.25, mods: { timeline: 4 }, via: [{ item: 'worker', p: 0.5 }] }], value: 1, cashAt: 'db', event: { from: 'db', to: 'notify', via: 'queue', type: 'notif' } },
    like: { name: 'Like', color: '#e11d48', steps: [{ pool: 'api', cost: 0.5 }, { pool: 'db', cost: 1.5, mods: { counter: 0.15 }, via: [{ item: 'counter', p: 1 }] }], value: 0.5, cashAt: 'db' },
    media: { name: 'Photo', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 3 }], cardOnSeen: 'media', firstText: 'Photos started flowing through the API' },
    // Sponsored post in the feed: the money maker. Served like a timeline entry.
    ad: { name: 'Sponsored', color: '#0ea5a4', steps: [{ pool: 'api', cost: 0.5 }, { pool: 'read', cost: 1, mods: { timeline: 0.3 }, via: [{ item: 'timeline', p: 0.8 }] }], value: 3, cashAt: 'api' },
    // Celebrity post: millions of timeline writes (hot key). Hybrid fan-out pulls it at read time instead.
    celeb: { name: 'Celeb post', color: '#d97706', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 1 }, { pool: 'fan', cost: 2.5, mods: { timeline: 4, hybrid: 0.0125 }, via: [{ item: 'worker', p: 0.5 }] }], value: 1, hops: [{ node: 'hybrid', if: 'hybrid' }], cashAt: 'db', cardOnSeen: 'celeb', firstText: 'A celebrity post: millions of timeline writes', event: { from: 'db', to: 'notify', via: 'queue', type: 'notif' } },
  },
  events: { notif: { name: 'Notify', color: '#e8559a' } },

  phases: [
    { name: 'Launch', dur: 30, rates: { home: 3, post: 0.8, like: 1.5 }, news: ['home', 'post', 'like'] },
    { name: 'Growth', dur: 50, rates: { home: 6, post: 1.5, like: 4, media: 2, ad: 0.8 }, news: ['media', 'ad', 'Traffic ×2'], hazards: { duplicate: 0.12 } },
    { name: 'Celebrities join', dur: 55, rates: { home: 10, post: 2.5, like: 7, media: 4, ad: 1.5, celeb: 0.5 }, news: ['celeb', 'Traffic ×2'], hazards: { duplicate: 0.12, race: 8, outage: [18, 34] } },
    { name: 'Viral night', dur: 60, rates: { home: 15, post: 4, like: 11, media: 7, ad: 2.5, celeb: 0.9 }, news: ['Traffic ×1.5', 'Viral post'], surge: { at: 14, dur: 16, mult: 2, label: 'A post goes viral', types: ['home', 'like', 'celeb'], card: 'viral' }, hazards: { duplicate: 0.18, race: 5 } },
  ],

  hazards: {
    duplicate: { type: 'post', fix: 'idem', card: 'double', rep: 3, money: 5, text: '👯 posted twice', blocked: '🔑 duplicate ignored', at: 'db', firstText: 'A retried post showed up twice', score: 10 },
    race: { type: 'like', fix: 'counter', card: 'race', rep: 4, money: 8, text: '🏁 like lost', blocked: '🔢 atomic INCR', at: 'db', firstText: 'Two likes raced; one was lost', startText: 'Hot posts: concurrent likes on one row', score: 12 },
    outage: { node: 'notify', label: 'Notification service', card: 'notify', rep: 1, startText: 'Notification service went down', lostText: 'Followers missed new-post notifications', event: { to: 'notify', via: 'queue', type: 'notif' }, score: 2 },
    overload: { node: 'db', card: 'dbload', after: 3 },
  },

  questions: QUESTIONS,
  cards: CARDS,
  puzzles: PUZZLES,
  breaks: BREAKS,
  finals: FINALS,

  report: {
    required: [
      { item: 'timeline', flag: 'Home feed computed on every read' },
      { item: 'idem', flag: 'No dedupe for retried posts' },
      { item: 'hybrid', flag: 'Celebrity posts fanned out to millions' },
    ],
    proactive: [
      { item: 'timeline', before: 'hot:db', signal: 'Precomputed timelines before the DB melted' },
      { item: 'idem', before: 'hazard:duplicate', signal: 'Idempotent posts before the first duplicate' },
      { item: 'queue', before: 'outage', signal: 'Queued notifications before the outage' },
      { item: 'counter', before: 'hazard:race', signal: 'Atomic counters before a like was lost' },
    ],
    combos: [
      { items: ['timeline', 'hybrid'], signal: 'Hybrid fan-out: push for most, pull for celebs' },
      { items: ['timeline', 'cdn'], signal: 'Hot reads in Redis, bytes at the edge' },
    ],
    counters: [
      { counter: 'lost', min: 6, flag: 'Lost {n} notifications in an outage' },
      { counter: 'race', min: 2, flag: 'Lost {n} likes to read-modify-write' },
      { counter: 'duplicate', min: 4, flag: 'Showed {n} duplicate posts' },
    ],
    scaleFirst: { item: 'server', fixes: [['type:media', 'cdn']], flag: 'Added servers instead of moving photos to a CDN', signal: 'Fixed expensive paths before scaling out' },
    noTraps: 'No premature ML ranking, graph DB or microservices',
  },

  followups: [
    { q: 'Fan-out on write or on read? What does each cost?', when: { missing: 'timeline', wrong: ['start', 'dbload'] } },
    { q: 'A user with 50M followers posts. Walk me through what happens.', when: { missing: 'hybrid', wrong: ['celeb', 'inactive'] } },
    { q: 'The app retries POST /posts. How do you avoid duplicate posts?', when: { missing: 'idem', wrong: ['double', 'contract'], counter: ['duplicate', 2] } },
    { q: '10K likes per second on one post. How do you count them?', when: { missing: 'counter', wrong: ['race', 'counts', 'viral'], counter: ['race', 1] } },
    { q: 'The notification service is down. Are notifications lost?', when: { missing: 'queue', wrong: ['notify'], counter: ['lost', 1] } },
    { q: 'How does infinite scroll stay stable while new posts arrive?', when: { wrong: ['pagination'] } },
    { q: 'Where do posts, timelines, counters and photos each live?', when: { wrong: ['storage', 'graph'] } },
    { q: 'Photos go through the API. What breaks first?', when: { missing: 'cdn', wrong: ['media'], counter: ['scaleFirst', 2] } },
    { q: 'When would you introduce ranking, and with what signals?', when: { wrong: ['ranking', 'final'], traps: true } },
    { q: 'Which decision would be the most expensive to reverse?', when: { always: true } },
  ],
};
