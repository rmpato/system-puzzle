// Marketplace Rush: the original exercise from the Backend Engineer system design guide.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './marketplace-copy.js';

export default {
  id: 'marketplace',
  title: 'Marketplace Rush',
  icon: '🛒',
  pitch: 'Stores, carts, payments and a Black Friday spike.',
  topics: ['Idempotency', 'Connection pooling', 'Queues', 'Read replicas', 'CDN'],
  difficulty: 'Medium',
  brief: '"Build a marketplace. Users browse stores and products, add to cart, pay, and get notified. Stores see their orders."',
  money: 100,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { instance: 8, k8s: 8, micro: 4 } },
    db: { node: 'db', base: 12, per: { shard: 16 }, conn: true },
    read: { node: 'db', base: 0, per: { replica: 12 }, fallback: 'db', conn: true },
  },
  connections: { pool: 'db', base: 10, per: { instance: 10, k8s: 10 }, limit: 40, fix: 'pgbouncer', fixed: 20, card: 'connections', firstText: 'DB refused connections (limit reached)', label: 'conns' },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Users' },
    { id: 'api', model: 'servers', pos: [0, 0], label: 'API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Postgres', color: '#ffd59a' },
    { id: 'psp', model: 'external', pos: [1.5, 10.5], label: 'Payments <span style="opacity:.55">(external)</span>', color: '#b7ebc6' },
    { id: 'notify', model: 'bell', pos: [14.5, 9.5], label: 'Notifications', color: '#fbc3dc' },
  ],

  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s · +10 DB connections', scales: 'api' },
    { id: 'cache', icon: '🧺', name: 'Redis', cost: 160, desc: 'Persistent cart · cheaper browsing', model: 'box', color: '#ffb3b3', pos: [5.5, 6], label: 'Redis', symptom: 'hot:db', proactive: 2 },
    { id: 'replica', icon: '📚', name: 'Read replica', cost: 220, max: 2, desc: 'More DB capacity for reads', model: 'cyl', color: '#ffe6c2', slots: [[15.6, -3.2], [15.6, 3.2]], label: 'Replica', scales: 'read' },
    { id: 'pgbouncer', icon: '🔌', name: 'PgBouncer', cost: 140, desc: 'Pools DB connections', model: 'ring', color: '#9fdcff', pos: [7.2, 0], label: 'PgBouncer', fixesConn: true },
    { id: 'cdn', icon: '🌐', name: 'CDN', cost: 160, desc: 'Images skip the API', model: 'cloud', pos: [-8, -7.5], label: 'CDN', symptom: 'type:image', relieves: 'api' },
    { id: 'search', icon: '🔍', name: 'Search index', cost: 220, desc: 'Cheap search', model: 'octa', color: '#d5c5ff', pos: [5.5, -7], label: 'Search index', symptom: 'type:search', relieves: 'api' },
    { id: 'idem', icon: '🔑', name: 'Idem. keys', cost: 130, desc: 'No double charges', model: 'key', color: '#ffd76a', pos: [-2.1, 11.1], label: 'Idempotency', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'queue', icon: '📬', name: 'Queue', cost: 200, desc: 'Survives outages & timeouts', model: 'tube', color: '#dbe2ec', pos: [8, 11], label: 'Queue', symptom: ['outage', 'hazard:timeout'], proactive: 2 },
    { id: 'lock', icon: '🔒', name: 'Stock lock', cost: 120, desc: 'No overselling', model: 'lock', color: '#cfd6e2', pos: [12, 3.8], label: 'Stock lock', symptom: 'hazard:race', proactive: 3 },
    { id: 'k8s', icon: '☸️', name: 'Kubernetes', cost: 350, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'wheel', pos: [0, 0], ghost: 9.6, label: 'Kubernetes' },
    { id: 'micro', icon: '🧩', name: 'Microservices', cost: 300, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'cluster', pos: [0, 5.6], ghost: 4.6, label: '8 services' },
    { id: 'shard', icon: '🗂️', name: 'Sharding', cost: 450, upkeep: 3, trap: true, desc: '+DB capacity · costs $3/s', model: 'shards', color: '#ffc98a', pos: [12, -4], label: 'Shards' },
  ],

  wires: [
    ['users', 'api'],
    ['users', 'cdn', { if: 'cdn' }],
    ['api', 'db', { unless: 'pgbouncer' }],
    ['api', 'pgbouncer', { if: 'pgbouncer' }],
    ['pgbouncer', 'db', { if: 'pgbouncer' }],
    ['api', 'cache', { if: 'cache' }],
    ['api', 'search', { if: 'search' }],
    ['db', 'replica', { if: 'replica', dashed: true }],
    ['api', 'psp'],
    ['psp', 'queue', { if: 'queue' }],
    ['queue', 'notify', { if: 'queue' }],
    ['psp', 'notify', { unless: 'queue' }],
  ],

  types: {
    browse: { name: 'Browse', color: '#2f6fed', steps: [{ pool: 'api', cost: 1 }, { pool: 'read', cost: 1, mods: { cache: 0.5 }, via: [{ item: 'cache', p: 0.5 }, { item: 'replica', p: 0.5 }] }] },
    image: { name: 'Image', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 3 }], cardOnSeen: 'images', firstText: 'Product images started hitting the API' },
    search: { name: 'Search', color: '#8b5cf6', steps: [{ pool: 'api', cost: 4, mods: { search: 0.25 } }, { pool: 'read', cost: 2, mods: { search: 0 } }], hops: [{ node: 'search', if: 'search' }], cardOnFail: 'search', cardOnFailUnless: 'search', firstText: 'Full-text search started hitting the DB' },
    checkout: { name: 'Checkout', color: '#1f9d55', steps: [{ pool: 'api', cost: 2 }, { pool: 'db', cost: 2 }], value: 10, hops: [{ node: 'psp' }], cashAt: 'psp', event: { from: 'psp', to: 'notify', via: 'queue', type: 'notif' } },
  },
  events: { notif: { name: 'Notify', color: '#e8559a' } },

  phases: [
    { name: 'MVP launch', dur: 30, rates: { browse: 2, checkout: 0.4 }, news: ['browse', 'checkout'] },
    { name: 'Growth', dur: 50, rates: { browse: 4, image: 2, search: 1.5, checkout: 0.8 }, news: ['image', 'search'], hazards: { duplicate: 0.1 } },
    { name: 'Scale', dur: 55, rates: { browse: 9, image: 5, search: 4, checkout: 2 }, news: ['Traffic ×3'], hazards: { duplicate: 0.12, outage: [18, 34] } },
    { name: 'Black Friday', dur: 60, rates: { browse: 18, image: 9, search: 7, checkout: 4.5 }, news: ['Traffic ×10'], hazards: { duplicate: 0.18, timeout: 0.12, race: 7, spike: 8 } },
  ],

  hazards: {
    duplicate: { type: 'checkout', fix: 'idem', card: 'double', rep: 4, money: 10, text: '💸 charged twice', blocked: '🔑 duplicate ignored', at: 'psp', firstText: 'First double charge', score: 10 },
    timeout: { type: 'checkout', fix: 'queue', card: 'timeout', rep: 1, text: '⏳ sale lost', at: 'psp', firstText: 'Payment timeout lost a sale', score: 5 },
    race: { type: 'checkout', fix: 'lock', card: 'race', rep: 5, money: 25, text: '🏁 oversold', blocked: '🔒 sold out', at: 'db', firstText: 'Oversold the last item', startText: 'Limited drops started (last-item races)', score: 15 },
    outage: { node: 'notify', label: 'Notification service', card: 'notify', rep: 1.5, startText: 'Notification service went down', lostText: 'Notifications were lost during the outage', event: { to: 'notify', via: 'queue', type: 'notif' }, score: 2 },
    spike: { card: 'spike' },
    overload: { node: 'db', card: 'dbload', after: 3 },
  },

  questions: QUESTIONS,
  cards: CARDS,
  puzzles: PUZZLES,
  breaks: BREAKS,
  finals: FINALS,

  report: {
    required: [
      { item: 'idem', flag: 'No strategy for duplicate payments' },
      { item: 'cache', unlessAnswer: 'cart', flag: 'Cart lives only in the session' },
    ],
    proactive: [
      { item: 'idem', before: 'hazard:duplicate', signal: 'Added idempotency before the first double charge' },
      { item: 'queue', before: 'outage', signal: 'Planned for a service failure before it happened' },
      { item: 'pgbouncer', before: 'conn', signal: 'Pooled connections before hitting the limit' },
      { item: 'lock', before: 'hazard:race', signal: 'Protected stock before the first race' },
    ],
    combos: [{ items: ['idem', 'queue'], signal: 'Idempotency + at-least-once delivery' }],
    counters: [
      { counter: 'lost', min: 4, flag: 'Lost {n} notifications in an outage' },
      { counter: 'race', min: 1, flag: 'Oversold the last item {n}×' },
    ],
    scaleFirst: { item: 'instance', fixes: [['type:image', 'cdn'], ['type:search', 'search']], flag: 'Added servers instead of fixing expensive paths', signal: 'Fixed expensive paths before scaling out' },
    noTraps: 'No premature Kafka / Kubernetes / sharding',
  },

  followups: [
    { q: 'If the payment event is delivered twice, how do you guarantee a single charge?', when: { missing: 'idem', wrong: ['double'], counter: ['duplicate', 3] } },
    { q: 'If the notification service is down, is the notification lost? How do you mitigate it?', when: { missing: 'queue', wrong: ['notify', 'spike'], counter: ['lost', 1] } },
    { q: '60 instances with a pool of 10 each and a DB that accepts 500: what happens?', when: { wrong: ['connections'], first: 'conn', unless: 'pgbouncer' } },
    { q: 'Two users buy the last item at the same time. How do you prevent it?', when: { counter: ['race', 1], wrong: ['race'] } },
    { q: 'The payment provider times out. How do you know if the payment went through?', when: { wrong: ['timeout'] } },
    { q: 'Which queries would you send to a read replica, and which never?', when: { wrong: ['routing'] } },
    { q: 'Define the checkout endpoint contract: what does it receive and return?', when: { wrong: ['contract', 'response', 'mock'] } },
    { q: 'How do you handle a contract change when the client is a typed mobile app?', when: { wrong: ['flutter'] } },
    { q: 'Which domain boundaries do you see, and how would you split the monolith later?', when: { wrong: ['domains', 'split', 'start'] } },
    { q: 'How would you model the cart? A table? Redis? Why?', when: { wrong: ['cart'] } },
    { q: 'Walk me through a purchase end to end: the happy path.', when: { wrong: ['flow'] } },
    { q: 'If the backend serves product images, what problem appears when scaling?', when: { missing: 'cdn', wrong: ['images'] } },
    { q: '/products/search runs full-text over the whole catalog. What would you do?', when: { missing: 'search', wrong: ['search'] } },
    { q: 'Black Friday traffic spikes 10×. What breaks first, and what do you do?', when: { counter: ['scaleFirst', 2], traps: true } },
    { q: 'Which architecture decision would be the most expensive to reverse?', when: { always: true } },
  ],
};
