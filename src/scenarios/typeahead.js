// Type Ahead: search autocomplete (Google's search box). Every keystroke is a request,
// suggestions come from a precomputed top-k trie, built offline from query logs.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './typeahead-copy.js';

export default {
  id: 'typeahead',
  title: 'Type Ahead',
  icon: '⌨️',
  pitch: 'Suggestions on every keystroke, under 100 ms.',
  topics: ['Trie / top-k', 'Debouncing', 'Edge caching', 'Offline pipelines', 'Trending'],
  difficulty: 'Medium',
  brief: '"Design search autocomplete. As users type, show the top 5 suggestions in under 100 ms. Searches show ads."',
  money: 200,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { instance: 8, shard: 10, region: 8 } },
    db: { node: 'db', base: 12 },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Users' },
    { id: 'api', model: 'servers', pos: [0, 0], label: 'Suggest API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Postgres', color: '#ffd59a' },
    { id: 'logs', model: 'funnel', pos: [14.5, 9.5], label: 'Log pipeline', color: '#c9b8ff' },
  ],

  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'trie', icon: '🌳', name: 'Prefix trie', cost: 200, desc: 'Top-k per prefix, in memory', model: 'octa', color: '#b7ebc6', pos: [6, -6], label: 'Top-k trie',
      symptom: 'hot:db', proactive: 0 },
    { id: 'debounce', icon: '⏱️', name: 'Debounce', cost: 110, desc: 'Client waits 150 ms, min 2 chars', model: 'hourglass', color: '#ffd76a', pos: [-11, 4.5], label: 'Debounce',
      symptom: 'hot:api', proactive: 1, relieves: 'api' },
    { id: 'cdn', icon: '🌐', name: 'Edge cache', cost: 160, desc: 'Hot prefixes served at edge', model: 'cloud', pos: [-8, -7.5], label: 'CDN',
      symptom: 'type:hot', relieves: 'api' },
    { id: 'queue', icon: '📬', name: 'Log queue', cost: 170, desc: 'Query logs survive outages', model: 'tube', color: '#dbe2ec', pos: [7, 10.5], label: 'Kafka',
      symptom: ['outage', 'hazard:timeout'], proactive: 1 },
    { id: 'trend', icon: '📈', name: 'Trending job', cost: 180, desc: 'New hot terms in minutes', model: 'gear', color: '#fbc3dc', pos: [14.5, 4.5], label: 'Trending',
      symptom: 'type:news', proactive: 2 },
    { id: 'personal', icon: '👤', name: 'Personalize', cost: 160, upkeep: 3, trap: true, desc: 'Per-user ranking · costs $3/s', model: 'sphere', color: '#ffb3b3', pos: [-3, 6], label: 'Personalized' },
    { id: 'shard', icon: '🗂️', name: 'Shard trie', cost: 300, upkeep: 4, trap: true, desc: '+capacity · costs $4/s', model: 'shards', color: '#ffc98a', pos: [0, -6.5], label: 'Trie shards' },
    { id: 'region', icon: '🌍', name: 'Multi-region', cost: 280, upkeep: 4, trap: true, desc: '+capacity · costs $4/s', model: 'globe', pos: [2.5, 6], label: 'Active-active' },
  ],

  wires: [
    ['users', 'api'],
    ['users', 'debounce', { if: 'debounce', dashed: true }],
    ['users', 'cdn', { if: 'cdn' }],
    ['cdn', 'api', { if: 'cdn', dashed: true }],
    ['api', 'db', { unless: 'trie' }],
    ['api', 'trie', { if: 'trie' }],
    ['api', 'shard', { if: 'shard' }],
    ['api', 'queue', { if: 'queue' }],
    ['queue', 'logs', { if: 'queue' }],
    ['api', 'logs', { unless: 'queue' }],
    ['logs', 'trend', { if: 'trend', dashed: true }],
    ['trend', 'trie', { if: 'trend', dashed: true }],
    ['logs', 'db', { dashed: true }],
  ],

  types: {
    key: { name: 'Keystroke', color: '#2f6fed', steps: [
      { pool: 'api', cost: 1, mods: { debounce: 0.35 } },
      { pool: 'db', cost: 1.2, mods: { trie: 0, debounce: 0.35 } },
    ], hops: [{ node: 'trie', if: 'trie' }] },
    search: { name: 'Search', color: '#1f9d55', value: 2, steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 1, mods: { trie: 0.3 } }],
      event: { from: 'api', to: 'logs', via: 'queue', type: 'qlog' } },
    hot: { name: 'Hot prefix', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 1.5 }, { pool: 'db', cost: 1.2, mods: { trie: 0 } }],
      cardOnSeen: 'hot', firstText: 'Everyone types "weath…" at once' },
    news: { name: 'Trending', color: '#d64545', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 2.5, mods: { trend: 0 } }],
      hops: [{ node: 'trend', if: 'trend' }], cardOnSeen: 'stale', firstText: 'New trending term missed the trie' },
  },
  events: { qlog: { name: 'Query log', color: '#8b5cf6' } },

  phases: [
    { name: 'Launch', dur: 30, rates: { key: 4, search: 0.6 }, news: ['key', 'search'] },
    { name: 'Growth', dur: 50, rates: { key: 10, search: 1.2, hot: 2 }, news: ['hot', 'Traffic ×3'], hazards: { timeout: 0.08, outage: [22, 38] } },
    { name: 'Scale', dur: 55, rates: { key: 18, search: 2, hot: 5, news: 1 }, news: ['news', 'Traffic ×5'], hazards: { timeout: 0.1 } },
    { name: 'Breaking news', dur: 60, rates: { key: 32, search: 3, hot: 10, news: 2.5 }, news: ['Traffic ×7'], hazards: { timeout: 0.1, spike: 40 },
      surge: { at: 12, dur: 14, mult: 3, label: 'Breaking news', types: ['news', 'hot', 'search'], card: 'surge' } },
  ],

  hazards: {
    timeout: { type: 'search', fix: 'queue', card: 'slowlog', rep: 1, text: '🐢 search timed out', at: 'logs', firstText: 'Sync log write timed out a search', score: 4 },
    outage: { node: 'logs', label: 'Log pipeline', card: 'logsdown', rep: 1.5, startText: 'Log pipeline went down', lostText: 'Query logs were lost', event: { to: 'logs', via: 'queue', type: 'qlog' }, score: 2 },
    spike: { card: 'offensive' },
    overload: { node: 'db', card: 'dbload', after: 3 },
  },

  questions: QUESTIONS,
  cards: CARDS,
  puzzles: PUZZLES,
  breaks: BREAKS,
  finals: FINALS,

  report: {
    required: [
      { item: 'trie', flag: 'Suggestions from LIKE scans on the DB' },
      { item: 'debounce', flag: 'A request on every single keystroke' },
      { item: 'queue', flag: 'Query logging on the search path' },
    ],
    proactive: [
      { item: 'trie', before: 'hot:db', signal: 'Precomputed top-k before the DB melted' },
      { item: 'debounce', before: 'hot:api', signal: 'Debounced the client before the API melted' },
      { item: 'queue', before: 'outage', signal: 'Queued query logs before the pipeline failed' },
      { item: 'trend', before: 'type:news', signal: 'Planned for trending terms early' },
    ],
    combos: [{ items: ['trie', 'cdn'], signal: 'Layered: edge cache + in-memory trie' }],
    counters: [
      { counter: 'lost', min: 4, flag: 'Lost {n} query logs in an outage' },
      { counter: 'timeout', min: 3, flag: '{n} searches timed out on logging' },
    ],
    scaleFirst: { item: 'instance', fixes: [['hot:api', 'debounce'], ['type:hot', 'cdn']], flag: 'Added servers instead of cutting requests', signal: 'Cut requests before scaling out' },
    noTraps: 'No premature personalization / sharding / multi-region',
  },

  followups: [
    { q: 'Why not SELECT … WHERE term LIKE \'ab%\'? What do you serve from instead?', when: { missing: 'trie', wrong: ['start', 'dbload', 'like'] } },
    { q: 'How many requests does typing "weather" cost? How do you cut that?', when: { missing: 'debounce', wrong: ['debounce'] } },
    { q: 'The log pipeline is down an hour. What happens to tomorrow\'s suggestions?', when: { missing: 'queue', wrong: ['logsdown', 'slowlog'], counter: ['lost', 1] } },
    { q: 'News breaks. How fast should the new term appear, and how?', when: { missing: 'trend', wrong: ['stale', 'surge', 'fresh'] } },
    { q: 'What do you store at each trie node, and why?', when: { wrong: ['topk', 'fields', 'tiers'] } },
    { q: 'Half the traffic is the same 1,000 prefixes. Where do you cache them?', when: { missing: 'cdn', wrong: ['hot'] } },
    { q: 'How do you keep offensive suggestions out?', when: { wrong: ['offensive'] } },
    { q: 'Walk me through rebuilding the trie from logs.', when: { wrong: ['pipeline'] } },
    { q: 'When does the trie stop fitting on one box? How do you split it?', when: { traps: true, counter: ['scaleFirst', 2] } },
    { q: 'Estimate QPS: 1B users, 10 searches a day, 8 keystrokes each.', when: { always: true } },
  ],
};
