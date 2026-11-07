// Chat at Scale: a WhatsApp/Messenger-style messaging system.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './chat-copy.js';

export default {
  id: 'chat',
  title: 'Chat at Scale',
  icon: '💬',
  pitch: 'Real-time messages, groups, offline push, New Year\'s Eve.',
  topics: ['WebSockets', 'Idempotent sends', 'Ordering', 'Presence TTL', 'Fan-out'],
  difficulty: 'Hard',
  brief: '"Design a chat app like WhatsApp. 1:1 and group messages, delivered instantly, with history and offline notifications."',
  money: 100,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { server: 8, micro: 4 } },
    db: { node: 'db', base: 14, per: { dbnode: 12, multi: 10 } },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Users' },
    { id: 'api', model: 'servers', pos: [-3, 0], label: 'Chat servers', item: 'server', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [8.5, 0], label: 'Message DB', color: '#ffd59a' },
    { id: 'devices', model: 'phone', pos: [16.5, 0], label: 'Recipients', color: '#c9f0d6' },
    { id: 'push', model: 'external', pos: [14, 10], label: 'APNs / FCM <span style="opacity:.55">(external)</span>', color: '#fbc3dc' },
  ],

  shop: [
    { id: 'server', icon: '🖥️', name: 'Chat server', cost: 110, costStep: 0.15, max: 8, desc: '+8 msg/s', scales: 'api' },
    { id: 'ws', icon: '📡', name: 'WS gateway', cost: 150, desc: 'Push over open sockets', model: 'ring', color: '#9fdcff', pos: [-9.5, 0], label: 'WS gateway', symptom: 'type:sync', relieves: 'api' },
    { id: 'dbnode', icon: '🗄️', name: 'DB node', cost: 200, costStep: 0.2, max: 2, desc: '+12 writes/s', model: 'cyl', color: '#ffe6c2', slots: [[12.8, -3.8], [12.8, 3.8]], label: 'Node', scales: 'db' },
    { id: 'cdn', icon: '🌐', name: 'S3 + CDN', cost: 160, desc: 'Media skips chat servers', model: 'cloud', pos: [-10, -7], label: 'S3 + CDN', symptom: 'type:media', relieves: 'api' },
    { id: 'presence', icon: '🟢', name: 'Presence TTL', cost: 130, desc: 'Typing & online in memory', model: 'sphere', color: '#b6f2c8', pos: [-2, -7], label: 'Presence (TTL)', symptom: 'type:presence', relieves: 'db' },
    { id: 'cache', icon: '🧺', name: 'Msg cache', cost: 160, desc: 'Recent messages in Redis', model: 'box', color: '#ffb3b3', pos: [4, -6], label: 'Recent cache', symptom: 'hot:db', proactive: 2 },
    { id: 'idem', icon: '🔑', name: 'Client msg ID', cost: 120, desc: 'Retries never duplicate', model: 'key', color: '#ffd76a', pos: [-7.5, 5], label: 'Message IDs', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'queue', icon: '📬', name: 'Queue', cost: 200, desc: 'Async fan-out · survives outages', model: 'tube', color: '#dbe2ec', pos: [6, 10], label: 'Queue', symptom: ['outage', 'type:group'], proactive: 2 },
    { id: 'seq', icon: '🔢', name: 'Seq numbers', cost: 120, desc: 'Ordered per conversation', model: 'counter', color: '#cfd6e2', pos: [8.5, 4.6], label: 'Seq per chat', symptom: 'hazard:race', proactive: 2 },
    { id: 'acks', icon: '✅', name: 'Acks + retry', cost: 130, desc: 'At-least-once delivery', model: 'shield', color: '#c7e8ff', pos: [16, -6.5], label: 'Acks', symptom: 'hazard:timeout', proactive: 2 },
    { id: 'ownpush', icon: '📶', name: 'Own push', cost: 240, upkeep: 3, trap: true, desc: 'Homemade push · costs $3/s', model: 'tower', pos: [0, 10.5], label: 'Own push' },
    { id: 'micro', icon: '🧩', name: 'Microservices', cost: 300, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'cluster', pos: [-3, 5.6], ghost: 4.6, label: '9 services' },
    { id: 'multi', icon: '🌍', name: 'Multi-region', cost: 400, upkeep: 4, trap: true, desc: 'Active-active · costs $4/s', model: 'globe', color: '#bfe3ff', pos: [9.5, -7.5], label: '3 regions' },
  ],

  wires: [
    ['users', 'api', { unless: 'ws' }],
    ['users', 'ws', { if: 'ws' }],
    ['ws', 'api', { if: 'ws' }],
    ['users', 'cdn', { if: 'cdn' }],
    ['api', 'presence', { if: 'presence' }],
    ['api', 'cache', { if: 'cache' }],
    ['api', 'db'],
    ['db', 'dbnode', { if: 'dbnode', dashed: true }],
    ['db', 'devices'],
    ['db', 'queue', { if: 'queue' }],
    ['queue', 'push', { if: 'queue' }],
    ['db', 'push', { unless: 'queue' }],
  ],

  types: {
    sync: { name: 'Sync', color: '#2f6fed', bypass: { item: 'ws', node: 'ws' }, steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 0.5 }], firstText: 'Clients polling for new messages' },
    history: { name: 'History', color: '#0ea5a4', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 2, mods: { cache: 0.25 }, via: [{ item: 'cache', p: 0.75 }, { item: 'dbnode', p: 0.5 }] }] },
    presence: { name: 'Typing', color: '#8b5cf6', steps: [{ pool: 'api', cost: 0.3 }, { pool: 'db', cost: 1.5, mods: { presence: 0 } }], hops: [{ node: 'presence', if: 'presence' }], cardOnSeen: 'presence', firstText: 'Typing indicators started hitting the DB' },
    media: { name: 'Photo', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, steps: [{ pool: 'api', cost: 4 }], cardOnSeen: 'media', firstText: 'Photos started flowing through chat servers' },
    send: { name: 'Message', color: '#1f9d55', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 1 }], value: 3, hops: [{ node: 'devices' }], cashAt: 'devices', event: { from: 'db', to: 'push', via: 'queue', type: 'push' } },
    group: { name: 'Group msg', color: '#d9467a', steps: [{ pool: 'api', cost: 1 }, { pool: 'db', cost: 3, mods: { queue: 0.4 } }], value: 5, hops: [{ node: 'queue', if: 'queue' }, { node: 'devices' }], cashAt: 'devices', cardOnSeen: 'groups', firstText: 'Group chats: one send, many inbox writes', event: { from: 'db', to: 'push', via: 'queue', type: 'push' } },
  },
  events: { push: { name: 'Push', color: '#e8559a' } },

  phases: [
    { name: 'Beta', dur: 30, rates: { sync: 3, send: 1, history: 0.6 }, news: ['sync', 'send', 'history'] },
    { name: 'Growth', dur: 55, rates: { sync: 5, send: 2.5, history: 2, presence: 4, media: 1.5 }, news: ['presence', 'media', 'Traffic ×3'], hazards: { duplicate: 0.15 } },
    { name: 'Group chats', dur: 60, rates: { sync: 9, send: 5, group: 2, history: 5, presence: 10, media: 4 }, news: ['group', 'Traffic ×2'], hazards: { duplicate: 0.12, race: 8, timeout: 0.06, outage: [20, 36] } },
    { name: 'New Year\'s Eve', dur: 60, surge: { at: 30, dur: 8, mult: 1.8, label: 'Midnight: Happy New Year!', types: ['send', 'group', 'sync', 'presence'] }, rates: { sync: 14, send: 10, group: 4, history: 9, presence: 18, media: 8 }, news: ['Midnight peak ×2'], hazards: { duplicate: 0.18, race: 6, timeout: 0.12, spike: 8 } },
  ],

  hazards: {
    duplicate: { type: 'send', fix: 'idem', card: 'double', rep: 3, money: 5, text: '👯 shown twice', blocked: '🔑 duplicate dropped', at: 'devices', firstText: 'A retried send showed up twice', score: 10 },
    race: { type: 'send', fix: 'seq', card: 'race', rep: 4, money: 10, text: '🔀 out of order', blocked: '🔢 ordered by seq', at: 'db', firstText: 'Messages arrived out of order', startText: 'Rapid back-and-forth chats started', score: 15 },
    timeout: { type: 'send', fix: 'acks', card: 'timeout', rep: 1.5, text: '📭 message lost', at: 'devices', firstText: 'A message was silently lost', score: 6 },
    outage: { node: 'push', label: 'APNs / FCM', card: 'push', rep: 1.5, startText: 'Push provider went down', lostText: 'Offline users missed notifications', event: { to: 'push', via: 'queue', type: 'push' }, score: 2 },
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
      { item: 'ws', flag: 'Real-time delivery by polling' },
      { item: 'idem', flag: 'No dedupe for retried sends' },
      { item: 'seq', flag: 'No per-conversation ordering' },
    ],
    proactive: [
      { item: 'idem', before: 'hazard:duplicate', signal: 'Client message IDs before the first duplicate' },
      { item: 'seq', before: 'hazard:race', signal: 'Sequenced messages before they reordered' },
      { item: 'queue', before: 'outage', signal: 'Queued pushes before the provider failed' },
      { item: 'acks', before: 'hazard:timeout', signal: 'Designed acks before losing a message' },
    ],
    combos: [
      { items: ['idem', 'acks'], signal: 'At-least-once + dedupe = effectively once' },
      { items: ['presence', 'cache'], signal: 'Kept hot, ephemeral data off the message DB' },
    ],
    counters: [
      { counter: 'lost', min: 8, flag: 'Lost {n} push notifications in an outage' },
      { counter: 'race', min: 2, flag: 'Reordered messages {n}×' },
      { counter: 'duplicate', min: 4, flag: 'Showed {n} duplicate messages' },
    ],
    scaleFirst: { item: 'server', fixes: [['type:sync', 'ws'], ['type:media', 'cdn']], flag: 'Added servers instead of fixing polling and media', signal: 'Fixed expensive paths before scaling out' },
    noTraps: 'No premature multi-region, own push or microservices',
  },

  followups: [
    { q: 'Why WebSockets over long polling? How many sockets per gateway?', when: { missing: 'ws', wrong: ['start'], counter: ['scaleFirst', 2] } },
    { q: 'The client retries a send on a flaky network. How do you avoid duplicates?', when: { missing: 'idem', wrong: ['double', 'schema'], counter: ['duplicate', 2] } },
    { q: 'Two messages race in the same chat. How do all devices agree on order?', when: { missing: 'seq', wrong: ['race'], counter: ['race', 1] } },
    { q: 'APNs is down for 15 minutes. What happens to offline users?', when: { missing: 'queue', wrong: ['push', 'spike'], counter: ['lost', 1] } },
    { q: 'What delivery guarantee do you offer, and how do acks work?', when: { missing: 'acks', wrong: ['timeout', 'flow'], counter: ['timeout', 2] } },
    { q: 'Where do typing indicators and online status live?', when: { missing: 'presence', wrong: ['presence', 'routing'] } },
    { q: 'How do you partition messages, and how does scroll-back work?', when: { wrong: ['storage', 'pagination', 'dbload'], missing: 'cache' } },
    { q: 'How does a message find the gateway holding the recipient?', when: { wrong: ['sticky'] } },
    { q: 'Fan-out on write or on read for a 100K-member channel?', when: { wrong: ['groups', 'bigroup'] } },
    { q: 'With E2E encryption, what can the server still do?', when: { wrong: ['e2e'] } },
    { q: 'Would you go multi-region now? What would push you there?', when: { traps: true } },
    { q: 'Which decision would be the most expensive to reverse?', when: { always: true } },
  ],
};
