// Tiny Links: a URL shortener (bit.ly / TinyURL). Read-heavy redirects, ID generation, async click analytics.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './url-shortener-copy.js';

export default {
  id: 'url-shortener',
  title: 'Tiny Links',
  icon: '🔗',
  pitch: 'Short codes, hot redirects and a viral link.',
  topics: ['Caching', 'ID generation', 'Async analytics', 'CDN', 'Rate limiting'],
  difficulty: 'Easy',
  brief: '"Design a URL shortener like bit.ly. Users create short links; visitors get redirected. Pro customers pay for click stats."',
  money: 100,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { instance: 8, micro: 4, region: 8 } },
    db: { node: 'db', base: 12, per: { shard: 16 } },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Users' },
    { id: 'api', model: 'servers', pos: [0, 0], label: 'API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Postgres', color: '#ffd59a' },
    { id: 'stats', model: 'screen', pos: [14.5, 9.5], label: 'Analytics', color: '#c9b8ff' },
  ],

  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'cache', icon: '🧺', name: 'Redis', cost: 150, desc: 'Cached code → URL', model: 'box', color: '#ffb3b3', pos: [6, -5.5], label: 'Redis', symptom: 'hot:db', proactive: 1 },
    { id: 'cdn', icon: '🌐', name: 'CDN edge', cost: 160, desc: 'Viral redirects skip the API', model: 'cloud', pos: [-8, -7.5], label: 'CDN', symptom: 'type:viral', relieves: 'api' },
    { id: 'ratelimit', icon: '🛡️', name: 'Rate limiter', cost: 120, desc: 'Blocks spam bots', model: 'shield', color: '#b7ebc6', pos: [-7.5, 0], label: 'Rate limit', symptom: 'type:spam', relieves: 'api' },
    { id: 'idgen', icon: '🔢', name: 'ID service', cost: 130, desc: 'Counter ranges, no collisions', model: 'counter', color: '#ffd76a', pos: [5.5, 6], label: 'ID ranges', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'unique', icon: '🔑', name: 'Unique index', cost: 90, desc: 'One owner per alias', model: 'key', color: '#cfd6e2', pos: [12, 4.2], label: 'Unique alias', symptom: 'hazard:race', proactive: 2 },
    { id: 'queue', icon: '📬', name: 'Click queue', cost: 180, desc: 'Async clicks, survives outages', model: 'tube', color: '#dbe2ec', pos: [7, 10.5], label: 'Click queue', symptom: ['outage', 'hazard:timeout'], proactive: 1 },
    { id: 'micro', icon: '🧩', name: 'Microservices', cost: 180, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'cluster', pos: [0, -5.6], ghost: 4.6, label: '6 services' },
    { id: 'shard', icon: '🗂️', name: 'Sharding', cost: 320, upkeep: 3, trap: true, desc: '+DB capacity · costs $3/s', model: 'shards', color: '#ffc98a', pos: [12, -4.5], label: 'Shards' },
    { id: 'region', icon: '🌍', name: 'Multi-region', cost: 280, upkeep: 3, trap: true, desc: '+capacity · costs $3/s', model: 'globe', pos: [-1.5, 6.5], label: 'Active-active' },
  ],

  wires: [
    ['users', 'api', { unless: 'ratelimit' }],
    ['users', 'ratelimit', { if: 'ratelimit' }],
    ['ratelimit', 'api', { if: 'ratelimit' }],
    ['users', 'cdn', { if: 'cdn' }],
    ['api', 'db'],
    ['api', 'cache', { if: 'cache' }],
    ['api', 'idgen', { if: 'idgen' }],
    ['db', 'unique', { if: 'unique', dashed: true }],
    ['db', 'shard', { if: 'shard', dashed: true }],
    ['api', 'queue', { if: 'queue' }],
    ['queue', 'stats', { if: 'queue' }],
    ['api', 'stats', { unless: 'queue' }],
  ],

  types: {
    redirect: { name: 'Redirect', color: '#2f6fed', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 1.5, mods: { cache: 0.2 }, via: [{ item: 'cache', p: 0.8 }] }] },
    click: { name: 'Pro click', color: '#1f9d55', value: 2, steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 1.5, mods: { cache: 0.2 }, via: [{ item: 'cache', p: 0.8 }] }],
      event: { from: 'api', to: 'stats', via: 'queue', type: 'clickev' } },
    create: { name: 'Create link', color: '#e8930c', value: 5, steps: [{ pool: 'api', cost: 2 }, { pool: 'db', cost: 2, mods: { idgen: 0.5 } }], hops: [{ node: 'idgen', if: 'idgen' }] },
    spam: { name: 'Spam bot', color: '#d64545', steps: [{ pool: 'api', cost: 2, mods: { ratelimit: 0.15 } }, { pool: 'db', cost: 3, mods: { ratelimit: 0 } }],
      cardOnSeen: 'spam', firstText: 'Bots started mass-creating links' },
    viral: { name: 'Viral link', color: '#8b5cf6', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 2 }, { pool: 'db', cost: 1.5, mods: { cache: 0.2 } }],
      cardOnSeen: 'viral', firstText: 'One link went viral' },
  },
  events: { clickev: { name: 'Click', color: '#e8559a' } },

  phases: [
    { name: 'Launch', dur: 30, rates: { redirect: 3, click: 0.5, create: 0.5 }, news: ['redirect', 'click', 'create'] },
    { name: 'Growth', dur: 50, rates: { redirect: 7, click: 1.2, create: 0.8, spam: 1.5 }, news: ['spam', 'Traffic ×2'], hazards: { duplicate: 0.12, outage: [24, 40] } },
    { name: 'Scale', dur: 55, rates: { redirect: 12, click: 2, create: 1.2, spam: 3, viral: 4 }, news: ['viral', 'Custom aliases'], hazards: { duplicate: 0.12, timeout: 0.08, race: 8 } },
    { name: 'Gone viral', dur: 60, surge: { at: 22, dur: 10, mult: 1.8, label: 'Link hits the front page', types: ['viral', 'redirect'] }, rates: { redirect: 18, click: 3, create: 1.6, spam: 4, viral: 12 }, news: ['Traffic ×5'], hazards: { duplicate: 0.15, timeout: 0.1, race: 6, spike: 8 } },
  ],

  hazards: {
    duplicate: { type: 'create', fix: 'idgen', card: 'collision', rep: 4, money: 6, text: '💥 code collision', blocked: '🔢 unique ID', at: 'db', firstText: 'Two links got the same code', score: 10 },
    timeout: { type: 'click', fix: 'queue', card: 'slowstats', rep: 1, text: '🐢 redirect timed out', at: 'stats', firstText: 'Sync click logging timed out a redirect', score: 4 },
    race: { type: 'create', fix: 'unique', card: 'race', rep: 5, money: 10, text: '🏁 alias stolen', blocked: '🔑 alias taken', at: 'db', firstText: 'Two users got the same alias', startText: 'Custom aliases launched (alias races)', score: 15 },
    outage: { node: 'stats', label: 'Analytics', card: 'statsdown', rep: 1.5, startText: 'Analytics service went down', lostText: 'Clicks were lost during the outage', event: { to: 'stats', via: 'queue', type: 'clickev' }, score: 2 },
    spike: { card: 'clickflood' },
    overload: { node: 'db', card: 'dbload', after: 3 },
  },

  questions: QUESTIONS,
  cards: CARDS,
  puzzles: PUZZLES,
  breaks: BREAKS,
  finals: FINALS,

  report: {
    required: [
      { item: 'cache', flag: 'Every redirect hits the database' },
      { item: 'queue', flag: 'Click analytics on the redirect path' },
    ],
    proactive: [
      { item: 'cache', before: 'hot:db', signal: 'Cached redirects before the DB melted' },
      { item: 'idgen', before: 'hazard:duplicate', signal: 'Collision-free IDs before the first collision' },
      { item: 'queue', before: 'outage', signal: 'Made analytics async before it failed' },
      { item: 'unique', before: 'hazard:race', signal: 'Enforced unique aliases before the first race' },
    ],
    combos: [{ items: ['cache', 'cdn'], signal: 'Layered caching: edge + Redis' }],
    counters: [
      { counter: 'lost', min: 4, flag: 'Lost {n} paid clicks in an outage' },
      { counter: 'race', min: 1, flag: 'Gave one alias to two users {n}×' },
      { counter: 'duplicate', min: 2, flag: '{n} code collisions' },
    ],
    scaleFirst: { item: 'instance', fixes: [['type:viral', 'cdn'], ['type:spam', 'ratelimit']], flag: 'Added servers instead of fixing hot paths', signal: 'Fixed hot paths before scaling out' },
    noTraps: 'No premature sharding / microservices / multi-region',
  },

  followups: [
    { q: 'Postgres is pinned by redirects. What do you cache, and how is it invalidated?', when: { missing: 'cache', wrong: ['dbload', 'edit'] } },
    { q: 'How do you generate unique 7-char codes across many servers?', when: { missing: 'idgen', wrong: ['start', 'collision', 'length'], counter: ['duplicate', 2] } },
    { q: 'Two users claim the same custom alias at once. Who wins, and how?', when: { counter: ['race', 1], wrong: ['race'] } },
    { q: 'Analytics is down for 10 minutes. Are those clicks lost?', when: { missing: 'queue', wrong: ['statsdown', 'slowstats', 'clickflood'], counter: ['lost', 1] } },
    { q: '301 or 302? What does each cost you?', when: { wrong: ['http', 'status', 'reverse'] } },
    { q: 'One link gets a million clicks a minute. What serves it?', when: { missing: 'cdn', wrong: ['viral'] } },
    { q: 'How do you stop bots creating millions of spam links?', when: { missing: 'ratelimit', wrong: ['spam'] } },
    { q: 'Sketch the links table. Which indexes?', when: { wrong: ['index', 'fields', 'routing'] } },
    { q: 'Walk me through a redirect, cache miss included.', when: { wrong: ['flow'] } },
    { q: 'When would you actually shard, and by what key?', when: { traps: true, counter: ['scaleFirst', 2] } },
    { q: 'Estimate storage for 10 years of links.', when: { always: true } },
  ],
};
