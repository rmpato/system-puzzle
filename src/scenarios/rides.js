// Ride Hail: an Uber/Lyft-style dispatch system. Driver pings, geo search, atomic dispatch, safe payments.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './rides-copy.js';

export default {
  id: 'rides',
  title: 'Ride Hail',
  icon: '🚕',
  pitch: 'Driver pings, geo search, dispatch races and surge.',
  topics: ['Geo index', 'Atomic dispatch', 'Idempotency', 'Queues', 'Caching'],
  difficulty: 'Expert',
  brief: '"Design a ride-hailing app. Drivers share their location, riders request a ride, we match them, and charge at the end."',
  money: 200,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { instance: 8, mesh: 8 } },
    db: { node: 'db', base: 16, per: { dbup: 10, shard: 16 } },
    maps: { node: 'maps', base: 10, per: { quota: 5 } },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Riders & drivers' },
    { id: 'api', model: 'servers', pos: [-2, 0], label: 'Dispatch API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Postgres', color: '#ffd59a' },
    { id: 'maps', model: 'external', pos: [4, -8], label: 'Maps API <span style="opacity:.55">(external)</span>', color: '#c9e7ff' },
    { id: 'psp', model: 'external', pos: [1.5, 10.5], label: 'Payments <span style="opacity:.55">(external)</span>', color: '#b7ebc6' },
    { id: 'push', model: 'bell', pos: [14.5, 9.5], label: 'Push', color: '#fbc3dc' },
  ],

  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 120, costStep: 0.2, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'geo', icon: '📍', name: 'Geo index', cost: 230, desc: 'Redis GEO: pings + nearby search', model: 'pin', color: '#ff9d9d', pos: [6, -3.2], label: 'Geo index', symptom: 'hot:db', proactive: 1, relieves: 'db' },
    { id: 'dbup', icon: '📚', name: 'Bigger DB', cost: 220, costStep: 0.3, max: 2, desc: '+10 DB capacity', model: 'cyl', color: '#ffe6c2', slots: [[15.6, -3.2], [15.6, 3.2]], label: 'DB upsize', scales: 'db' },
    { id: 'cdn', icon: '🌐', name: 'Tile CDN', cost: 180, desc: 'Map tiles skip the API', model: 'cloud', pos: [-9, -7.5], label: 'CDN', symptom: 'type:tile', relieves: 'api' },
    { id: 'etacache', icon: '⏱️', name: 'ETA cache', cost: 190, desc: 'Cached ETAs per cell pair', model: 'box', color: '#ffd1a8', pos: [9.5, -7.5], label: 'ETA cache', symptom: 'type:eta', relieves: 'maps' },
    { id: 'quota', icon: '🎟️', name: 'Maps quota', cost: 150, costStep: 0.4, max: 2, desc: '+5 ETA/s · pricey', model: 'stack', color: '#c9e7ff', slots: [[0, -9], [-3.8, -9]], label: 'Quota', scales: 'maps' },
    { id: 'idem', icon: '🔑', name: 'Idem. keys', cost: 150, desc: 'No double charges', model: 'key', color: '#ffd76a', pos: [-2.1, 11.1], label: 'Idempotency', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'recon', icon: '🔁', name: 'Reconciler', cost: 160, desc: 'Pending + reconcile timeouts', model: 'hourglass', color: '#d7f0c2', pos: [4.8, 6.8], label: 'Reconciler', symptom: 'hazard:timeout', proactive: 3 },
    { id: 'cas', icon: '🔒', name: 'Atomic assign', cost: 140, desc: 'One driver, one trip', model: 'lock', color: '#cfd6e2', pos: [12, 3.8], label: 'Driver CAS', symptom: 'hazard:race', proactive: 2 },
    { id: 'queue', icon: '📬', name: 'Push queue', cost: 220, desc: 'Survives push outages', model: 'tube', color: '#dbe2ec', pos: [8.5, 11], label: 'Queue', symptom: 'outage', proactive: 3 },
    { id: 'mesh', icon: '☸️', name: 'Service mesh', cost: 350, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'wheel', pos: [-2, 0], ghost: 9.6, label: 'Mesh + K8s' },
    { id: 'ml', icon: '🤖', name: 'ML dispatch', cost: 300, upkeep: 2, trap: true, desc: 'Smarter matching · $2/s', model: 'gear', color: '#e3d0ff', pos: [-8, 6], label: 'ML dispatch' },
    { id: 'shard', icon: '🌍', name: 'Geo-shards', cost: 450, upkeep: 3, trap: true, trapUntil: 3, desc: 'Multi-region DB · $3/s', model: 'shards', color: '#ffc98a', pos: [12, -4.2], label: 'Geo-shards' },
  ],

  wires: [
    ['users', 'api'],
    ['users', 'cdn', { if: 'cdn' }],
    ['api', 'db'],
    ['api', 'geo', { if: 'geo' }],
    ['api', 'maps', { unless: 'etacache' }],
    ['api', 'etacache', { if: 'etacache' }],
    ['etacache', 'maps', { if: 'etacache', dashed: true }],
    ['db', 'dbup', { if: 'dbup', dashed: true }],
    ['db', 'shard', { if: 'shard', dashed: true }],
    ['api', 'psp'],
    ['psp', 'recon', { if: 'recon', dashed: true }],
    ['psp', 'queue', { if: 'queue' }],
    ['queue', 'push', { if: 'queue' }],
    ['psp', 'push', { unless: 'queue' }],
  ],

  types: {
    ping: { name: 'Location ping', color: '#2f6fed', steps: [{ pool: 'api', cost: 0.1 }, { pool: 'db', cost: 1, mods: { geo: 0 } }], hops: [{ node: 'geo', if: 'geo' }], firstText: 'Drivers pinging their location' },
    match: { name: 'Nearby drivers', color: '#8b5cf6', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 3, mods: { geo: 0 } }], hops: [{ node: 'geo', if: 'geo' }], cardOnFail: 'nearby', cardOnFailUnless: 'geo' },
    tile: { name: 'Map tile', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 3 }], cardOnSeen: 'tiles', firstText: 'Map tiles started hitting the API' },
    eta: { name: 'ETA', color: '#0fb5b5', steps: [{ pool: 'api', cost: 1 }, { pool: 'maps', cost: 4, mods: { etacache: 0.25 }, via: [{ item: 'etacache', p: 0.75 }] }], cardOnFail: 'eta', cardOnFailUnless: 'etacache', firstText: 'Every screen now asks for an ETA' },
    trip: { name: 'Trip', color: '#1f9d55', steps: [{ pool: 'api', cost: 2 }, { pool: 'db', cost: 2 }], value: 10, hops: [{ node: 'psp' }], cashAt: 'psp', event: { from: 'psp', to: 'push', via: 'queue', type: 'push' } },
  },
  events: { push: { name: 'Push', color: '#e8559a' } },

  phases: [
    { name: 'One city', dur: 30, rates: { ping: 4, match: 0.8, trip: 0.4 }, news: ['ping', 'trip'] },
    { name: 'More drivers', dur: 50, rates: { ping: 18, match: 2, tile: 2, eta: 1.5, trip: 0.9 }, news: ['tile', 'eta', 'Drivers ×3'], hazards: { duplicate: 0.1 } },
    { name: 'Friday night', dur: 55, rates: { ping: 28, match: 4.5, tile: 5, eta: 4, trip: 2 }, news: ['Riders ×3', 'Dispatch races'], hazards: { duplicate: 0.12, race: 9 } },
    { name: 'Concert + rain', dur: 60, surge: { at: 14, dur: 10, mult: 1.6, label: 'Concert lets out in the rain', types: ['match', 'eta', 'trip', 'ping'] }, rates: { ping: 55, match: 11, tile: 9, eta: 10, trip: 4.5 }, news: ['Surge ×10'], hazards: { duplicate: 0.18, timeout: 0.12, race: 6, spike: 8, outage: [24, 40] } },
  ],

  hazards: {
    duplicate: { type: 'trip', fix: 'idem', card: 'double', rep: 4, money: 12, text: '💸 charged twice', blocked: '🔑 duplicate ignored', at: 'psp', firstText: 'First double-charged rider', score: 10 },
    timeout: { type: 'trip', fix: 'recon', card: 'timeout', rep: 1, text: '⏳ fare lost', at: 'psp', firstText: 'Payment timeout lost a fare', score: 5 },
    race: { type: 'trip', fix: 'cas', card: 'race', rep: 5, money: 20, text: '🏁 driver double-booked', blocked: '🔒 driver taken', at: 'db', firstText: 'A driver got two trips', startText: 'Riders now compete for drivers', score: 15 },
    outage: { node: 'push', label: 'Push service', card: 'notify', rep: 1, startText: 'Push service went down', lostText: '"Driver arriving" pushes were lost', event: { to: 'push', via: 'queue', type: 'push' }, score: 2 },
    spike: { card: 'surge' },
    overload: { node: 'db', card: 'dbload', after: 3 },
  },

  questions: QUESTIONS,
  cards: CARDS,
  puzzles: PUZZLES,
  breaks: BREAKS,
  finals: FINALS,

  report: {
    required: [
      { item: 'geo', flag: 'Driver pings written to the relational DB' },
      { item: 'idem', flag: 'No strategy for duplicate charges' },
      { item: 'cas', flag: 'Dispatch is not atomic' },
    ],
    proactive: [
      { item: 'geo', before: 'hot:db', signal: 'Put live locations in memory before the DB melted' },
      { item: 'idem', before: 'hazard:duplicate', signal: 'Added idempotency before the first double charge' },
      { item: 'cas', before: 'hazard:race', signal: 'Made dispatch atomic before the first race' },
      { item: 'queue', before: 'outage', signal: 'Queued pushes before the push outage' },
    ],
    combos: [
      { items: ['idem', 'recon'], signal: 'Idempotent charges + reconciliation' },
      { items: ['geo', 'cas'], signal: 'Geo index for search, DB for assignment' },
    ],
    counters: [
      { counter: 'race', min: 1, flag: 'Double-booked a driver {n}×' },
      { counter: 'duplicate', min: 2, flag: 'Double-charged riders {n}×' },
      { counter: 'lost', min: 2, flag: 'Lost {n} pushes in an outage' },
      { counter: 'timeout', min: 2, flag: 'Lost {n} fares to payment timeouts' },
    ],
    scaleFirst: { item: 'instance', fixes: [['type:tile', 'cdn'], ['hot:db', 'geo']], flag: 'Added servers instead of fixing hot paths', signal: 'Fixed hot paths before scaling out' },
    noTraps: 'No premature multi-region / mesh / ML',
  },

  followups: [
    { q: 'Drivers ping every 4 seconds. Where do those writes go, and why not Postgres?', when: { missing: 'geo', wrong: ['dbload', 'sqlgeo', 'ping'] } },
    { q: 'Two riders get matched to the same driver. How do you prevent it?', when: { missing: 'cas', counter: ['race', 1], wrong: ['race', 'consistency'] } },
    { q: 'The charge at trip end is retried. How do you guarantee one charge?', when: { missing: 'idem', wrong: ['double', 'request'], counter: ['duplicate', 3] } },
    { q: 'How do you find drivers within 2 km of a rider, fast?', when: { wrong: ['nearby', 'cellsize', 'storage'] } },
    { q: 'The payment provider times out. Did the rider pay?', when: { missing: 'recon', wrong: ['timeout'], counter: ['timeout', 2] } },
    { q: 'The push service is down. Is "driver arriving" lost?', when: { missing: 'queue', wrong: ['notify'], counter: ['lost', 1] } },
    { q: 'Every screen calls the Maps API for an ETA. What breaks, and how do you fix it?', when: { missing: 'etacache', wrong: ['eta'] } },
    { q: 'A driver loses signal mid-trip. What happens to the trip?', when: { wrong: ['offline', 'lifecycle'] } },
    { q: 'A concert ends and demand jumps 20× in one area. Walk me through it.', when: { wrong: ['surge', 'surgeprice'], traps: true } },
    { q: 'When would you actually shard by region?', when: { always: true } },
  ],
};
