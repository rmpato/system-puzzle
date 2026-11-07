// Ticket Drop: concert ticketing during a superstar on-sale.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './tickets-copy.js';

export default {
  id: 'tickets',
  title: 'Ticket Drop',
  icon: '🎟️',
  pitch: 'A superstar on-sale: queues, seat holds and bots.',
  topics: ['Waiting room', 'Seat holds', 'Idempotency', 'Bot defense', 'Caching'],
  difficulty: 'Hard',
  brief: '"Design ticketing for a superstar tour. Millions of fans hit Buy at 10:00 sharp. No seat may sell twice."',
  money: 200,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { instance: 8, micro: 4 } },
    db: { node: 'db', base: 12, per: { shard: 16 } },
    read: { node: 'db', base: 0, per: { replica: 12 }, fallback: 'db' },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Fans' },
    { id: 'api', model: 'servers', pos: [0, 0], label: 'API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Postgres', color: '#ffd59a' },
    { id: 'psp', model: 'external', pos: [1.5, 10.5], label: 'Payments <span style="opacity:.55">(external)</span>', color: '#b7ebc6' },
    { id: 'email', model: 'bell', pos: [14.5, 9.5], label: 'Email', color: '#fbc3dc' },
  ],

  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'waitroom', icon: '⏳', name: 'Waiting room', cost: 200, desc: 'Admits fans at a set rate', model: 'hourglass', color: '#c9b8ff', pos: [-8.5, 0], label: 'Waiting room', symptom: 'type:rush', proactive: 2, relieves: 'api' },
    { id: 'shield', icon: '🛡️', name: 'Bot defense', cost: 180, desc: 'Rate limits, blocks bots', model: 'shield', color: '#ffcf8a', pos: [-11, -4.5], label: 'Bot defense', symptom: 'type:bot', relieves: 'api' },
    { id: 'cdn', icon: '🌐', name: 'CDN', cost: 150, desc: 'Seat map assets skip API', model: 'cloud', pos: [-6.5, -8], label: 'CDN', symptom: 'type:assets', relieves: 'api' },
    { id: 'cache', icon: '🧺', name: 'Redis cache', cost: 160, desc: 'Cheaper seat-map reads', model: 'box', color: '#ffb3b3', pos: [5.5, 6], label: 'Redis', symptom: 'hot:db', proactive: 2 },
    { id: 'replica', icon: '📚', name: 'Read replica', cost: 220, max: 2, desc: 'More DB capacity for reads', model: 'cyl', color: '#ffe6c2', slots: [[15.6, -3.2], [15.6, 3.2]], label: 'Replica', scales: 'read' },
    { id: 'hold', icon: '🔒', name: 'Seat holds', cost: 140, desc: 'Atomic hold with TTL', model: 'lock', color: '#cfd6e2', pos: [11.5, 4], label: 'Seat holds', symptom: 'hazard:race', proactive: 1 },
    { id: 'idem', icon: '🔑', name: 'Idem. keys', cost: 130, desc: 'No double charges', model: 'key', color: '#ffd76a', pos: [-2.1, 11.1], label: 'Idempotency', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'recon', icon: '⚙️', name: 'Reconciler', cost: 150, desc: 'Pending holds, checks provider', model: 'gear', color: '#b8e0d2', pos: [-5.5, 8], label: 'Reconciler', symptom: 'hazard:timeout', proactive: 2 },
    { id: 'queue', icon: '📬', name: 'Queue', cost: 170, desc: 'Emails survive outages', model: 'tube', color: '#dbe2ec', pos: [8, 11], label: 'Queue', symptom: 'outage', proactive: 2 },
    { id: 'shard', icon: '🗂️', name: 'Shard by seat', cost: 450, upkeep: 3, trap: true, desc: '+DB capacity · costs $3/s', model: 'shards', color: '#ffc98a', pos: [12, -4], label: 'Seat shards' },
    { id: 'micro', icon: '🧩', name: 'Venue svcs', cost: 300, upkeep: 2, trap: true, desc: 'Service per venue · $2/s', model: 'cluster', pos: [0, 5.6], ghost: 4.6, label: 'Per-venue services' },
    { id: 'chain', icon: '⛓️', name: 'NFT tickets', cost: 280, upkeep: 2, trap: true, desc: 'Tickets on-chain · $2/s', model: 'stack', color: '#d5c5ff', pos: [5.5, -6.5], label: 'Blockchain' },
  ],

  wires: [
    ['users', 'api', { unless: 'waitroom' }],
    ['users', 'waitroom', { if: 'waitroom' }],
    ['waitroom', 'api', { if: 'waitroom' }],
    ['users', 'shield', { if: 'shield' }],
    ['users', 'cdn', { if: 'cdn' }],
    ['api', 'cache', { if: 'cache' }],
    ['api', 'db'],
    ['db', 'hold', { if: 'hold' }],
    ['db', 'replica', { if: 'replica', dashed: true }],
    ['api', 'psp'],
    ['psp', 'recon', { if: 'recon', dashed: true }],
    ['psp', 'queue', { if: 'queue' }],
    ['queue', 'email', { if: 'queue' }],
    ['psp', 'email', { unless: 'queue' }],
  ],

  types: {
    browse: { name: 'Seat map', color: '#2f6fed', steps: [{ pool: 'api', cost: 1 }, { pool: 'read', cost: 1.2, mods: { cache: 0.4 }, via: [{ item: 'cache', p: 0.6 }, { item: 'replica', p: 0.5 }] }] },
    assets: { name: 'Map assets', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 2.5 }], cardOnSeen: 'assets', firstText: 'Seat map images started hitting the API' },
    bot: { name: 'Bot', color: '#6b7280', bypass: { item: 'shield', node: 'shield' }, steps: [{ pool: 'api', cost: 2 }, { pool: 'db', cost: 1.5 }], cardOnSeen: 'bots', firstText: 'Scalper bots started holding seats' },
    rush: { name: 'Refresh', color: '#8b5cf6', bypass: { item: 'waitroom', node: 'waitroom' }, steps: [{ pool: 'api', cost: 2.5 }, { pool: 'read', cost: 1 }], cardOnSeen: 'rush', firstText: 'Refresh storm hit the API' },
    buy: { name: 'Purchase', color: '#1f9d55', steps: [{ pool: 'api', cost: 2 }, { pool: 'db', cost: 3 }], value: 9, hops: [{ node: 'psp' }], cashAt: 'psp', event: { from: 'psp', to: 'email', via: 'queue', type: 'ticket' } },
  },
  events: { ticket: { name: 'Ticket email', color: '#e8559a' } },

  phases: [
    { name: 'Presale', dur: 30, rates: { browse: 2, buy: 0.4 }, news: ['browse', 'buy'] },
    { name: 'Tour announced', dur: 45, rates: { browse: 5, assets: 3, bot: 1.5, buy: 0.8 }, news: ['assets', 'bot'], hazards: { duplicate: 0.12 } },
    { name: 'On-sale 10:00', dur: 60, surge: { at: 4, dur: 8, mult: 1.45, label: '10:00: everyone clicks Buy', types: ['rush', 'bot', 'browse'] }, rates: { browse: 9, assets: 5, bot: 4, rush: 7, buy: 2.2 }, news: ['rush', 'Traffic ×10'], hazards: { duplicate: 0.15, race: 7, timeout: 0.1, spike: 2, outage: [24, 42] } },
    { name: 'Sold-out frenzy', dur: 55, rates: { browse: 15, assets: 8, bot: 7, rush: 11, buy: 3.6 }, news: ['Bots ×2', 'Last seats'], hazards: { duplicate: 0.18, race: 3.5, timeout: 0.15 } },
  ],

  hazards: {
    duplicate: { type: 'buy', fix: 'idem', card: 'double', rep: 4, money: 10, text: '💸 charged twice', blocked: '🔑 duplicate ignored', at: 'psp', firstText: 'First double charge', score: 10 },
    timeout: { type: 'buy', fix: 'recon', card: 'timeout', rep: 1.5, text: '⏳ seat released, fan paid', at: 'psp', firstText: 'Payment timeout lost a sale', score: 5 },
    race: { type: 'buy', fix: 'hold', card: 'race', rep: 5, money: 20, text: '🏁 seat sold twice', blocked: '🔒 seat taken', at: 'db', firstText: 'Sold the same seat twice', startText: 'Hot seats: fans racing for the same seat', score: 15 },
    outage: { node: 'email', label: 'Email service', card: 'email', rep: 1.5, startText: 'Email service went down', lostText: 'Ticket emails were lost', event: { to: 'email', via: 'queue', type: 'ticket' }, score: 2 },
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
      { item: 'hold', flag: 'No atomic seat holds' },
      { item: 'idem', flag: 'No strategy for duplicate payments' },
      { item: 'waitroom', flag: 'Let the whole burst hit the backend' },
    ],
    proactive: [
      { item: 'waitroom', before: 'type:rush', signal: 'Waiting room ready before the on-sale' },
      { item: 'hold', before: 'hazard:race', signal: 'Atomic holds before the first race' },
      { item: 'idem', before: 'hazard:duplicate', signal: 'Idempotency before the first double charge' },
      { item: 'queue', before: 'outage', signal: 'Queued emails before the outage' },
    ],
    combos: [
      { items: ['idem', 'recon'], signal: 'Idempotent checkout + reconciliation' },
      { items: ['waitroom', 'shield'], signal: 'Controlled admission, bots kept out' },
    ],
    counters: [
      { counter: 'race', min: 1, flag: 'Sold the same seat {n}×' },
      { counter: 'duplicate', min: 3, flag: 'Charged fans twice {n}×' },
      { counter: 'timeout', min: 4, flag: 'Lost {n} paid sales to timeouts' },
      { counter: 'lost', min: 4, flag: 'Lost {n} ticket emails in an outage' },
    ],
    scaleFirst: { item: 'instance', fixes: [['type:rush', 'waitroom'], ['type:bot', 'shield'], ['type:assets', 'cdn']], flag: 'Scaled servers instead of shaping traffic', signal: 'Shaped traffic before scaling out' },
    noTraps: 'No premature sharding, per-venue services or blockchain',
  },

  followups: [
    { q: 'Two fans click the same seat at once. Walk me through what happens.', when: { counter: ['race', 1], wrong: ['race', 'seats'], missing: 'hold' } },
    { q: '10M fans arrive at 10:00. How do you protect the backend?', when: { missing: 'waitroom', wrong: ['rush', 'surge', 'autoscale'] } },
    { q: 'A checkout request is retried. How do you avoid a double charge?', when: { missing: 'idem', wrong: ['double'], counter: ['duplicate', 3] } },
    { q: 'The provider times out. Who owns the seat now?', when: { missing: 'recon', wrong: ['timeout', 'expire'] } },
    { q: 'How do you tell a scalper bot from a real fan?', when: { missing: 'shield', wrong: ['bots', 'fair'] } },
    { q: 'How long should a hold last, and what happens when it expires?', when: { wrong: ['ttl', 'expire'] } },
    { q: 'Which reads can be stale, and which never?', when: { wrong: ['consistency', 'dbload'] } },
    { q: 'If the email service is down, is the ticket lost?', when: { missing: 'queue', counter: ['lost', 1], wrong: ['email'] } },
    { q: 'Define POST /holds: what does it receive and return?', when: { wrong: ['holdapi'] } },
    { q: 'Walk me through a purchase end to end.', when: { wrong: ['flow'] } },
    { q: 'Where is the real bottleneck, and when would you shard?', when: { traps: true, counter: ['scaleFirst', 2] } },
    { q: 'How would you make the queue fair to real fans?', when: { always: true } },
  ],
};
