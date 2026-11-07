// Money Moves: a payments platform / digital wallet built on a double-entry ledger.
import { QUESTIONS, CARDS, PUZZLES, BREAKS, FINALS } from './ledger-copy.js';

export default {
  id: 'ledger',
  title: 'Money Moves',
  icon: '💳',
  pitch: 'A wallet and payments ledger. Every cent counts.',
  topics: ['Idempotency', 'Double-entry ledger', 'Row locks', 'Reconciliation', 'Outbox'],
  difficulty: 'Expert',
  brief: '"Design a wallet and payments API. Users send money, merchants get paid and notified. Never lose or invent a cent."',
  money: 100,
  startCard: 'start',

  pools: {
    api: { node: 'api', base: 8, per: { instance: 8, micro: 4 } },
    db: { node: 'db', base: 14, per: { nosql: 16 } },
    read: { node: 'db', base: 0, per: { replica: 12 }, fallback: 'db' },
  },

  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Users' },
    { id: 'api', model: 'servers', pos: [0, 0], label: 'Payments API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Ledger DB', color: '#ffd59a' },
    { id: 'bank', model: 'external', pos: [1.5, 10.5], label: 'Bank / card network <span style="opacity:.55">(external)</span>', color: '#b7ebc6' },
    { id: 'hooks', model: 'bell', pos: [14.5, 9.5], label: 'Merchant webhooks', color: '#fbc3dc' },
  ],

  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'idem', icon: '🔑', name: 'Idem. keys', cost: 150, desc: 'Retries never move money twice', model: 'key', color: '#ffd76a', pos: [-7, 3.8], label: 'Idempotency', symptom: 'hazard:duplicate', proactive: 1 },
    { id: 'lock', icon: '🔒', name: 'Row lock', cost: 160, desc: 'FOR UPDATE: no overdrafts', model: 'lock', color: '#cfd6e2', pos: [12, 3.8], label: 'Row lock', symptom: 'hazard:race', proactive: 2 },
    { id: 'recon', icon: '⚙️', name: 'Reconciler', cost: 160, desc: 'Resolves pending bank calls', model: 'gear', color: '#c7d2fe', pos: [-5.5, 8.5], label: 'Reconciler', symptom: 'hazard:timeout', proactive: 1 },
    { id: 'outbox', icon: '📬', name: 'Outbox+queue', cost: 200, desc: 'Webhooks retried, never lost', model: 'tube', color: '#dbe2ec', pos: [8, 11], label: 'Outbox → queue', symptom: 'outage', proactive: 2 },
    { id: 'risk', icon: '🕵️', name: 'Async risk', cost: 200, desc: 'ML scoring off the hot path', model: 'shield', color: '#ffcf8a', pos: [-5.5, -5], label: 'Async ML risk', symptom: 'hot:api', proactive: 2, relieves: 'api' },
    { id: 'warehouse', icon: '🏬', name: 'Warehouse', cost: 220, desc: 'Statements off the primary', model: 'stack', color: '#c5e8ff', pos: [12, -6.5], label: 'Warehouse', symptom: 'type:statement', relieves: 'read' },
    { id: 'replica', icon: '📚', name: 'Read replica', cost: 220, max: 2, desc: 'More capacity for reads', model: 'cyl', color: '#ffe6c2', slots: [[15.6, -3.2], [15.6, 3.2]], label: 'Replica', scales: 'read' },
    { id: 'chain', icon: '⛓️', name: 'Blockchain', cost: 280, upkeep: 2, trap: true, desc: 'Ledger on-chain · $2/s', model: 'cluster', pos: [5.5, -6.5], ghost: 4.6, label: 'Blockchain ledger' },
    { id: 'micro', icon: '🧩', name: 'Currency svcs', cost: 300, upkeep: 2, trap: true, desc: 'Service per currency · $2/s', model: 'cluster', pos: [0, 5.6], ghost: 4.6, label: 'Per-currency services' },
    { id: 'nosql', icon: '🗂️', name: 'NoSQL ledger', cost: 420, upkeep: 3, trap: true, desc: '+DB capacity · $3/s', model: 'shards', color: '#ffc98a', pos: [7, 4.5], label: 'NoSQL ledger' },
  ],

  wires: [
    ['users', 'api', { unless: 'idem' }],
    ['users', 'idem', { if: 'idem' }],
    ['idem', 'api', { if: 'idem' }],
    ['api', 'db'],
    ['db', 'lock', { if: 'lock' }],
    ['db', 'replica', { if: 'replica', dashed: true }],
    ['db', 'warehouse', { if: 'warehouse', dashed: true }],
    ['api', 'risk', { if: 'risk', dashed: true }],
    ['api', 'bank'],
    ['recon', 'bank', { if: 'recon', dashed: true }],
    ['bank', 'outbox', { if: 'outbox' }],
    ['outbox', 'hooks', { if: 'outbox' }],
    ['bank', 'hooks', { unless: 'outbox' }],
  ],

  types: {
    balance: { name: 'Balance', color: '#2f6fed', steps: [{ pool: 'api', cost: 1 }, { pool: 'read', cost: 1, via: [{ item: 'replica', p: 0.6 }] }] },
    transfer: { name: 'Transfer', color: '#0ea5a4', value: 3, steps: [{ pool: 'api', cost: 1.5 }, { pool: 'db', cost: 1.5 }], cashAt: 'db', firstText: 'P2P transfers went live' },
    statement: { name: 'Statement', color: '#e8930c', steps: [{ pool: 'api', cost: 2, mods: { warehouse: 0.5 } }, { pool: 'read', cost: 4, mods: { warehouse: 0 } }], hops: [{ node: 'warehouse', if: 'warehouse' }], cardOnSeen: 'statements', firstText: 'Monthly statements hit the ledger DB' },
    payment: { name: 'Payment', color: '#1f9d55', value: 6, steps: [{ pool: 'api', cost: 3, mods: { risk: 0.4 } }, { pool: 'db', cost: 1.5 }], hops: [{ node: 'bank' }], cashAt: 'bank', cardOnFail: 'fraud', cardOnFailUnless: 'risk', event: { from: 'bank', to: 'hooks', via: 'outbox', type: 'hook' } },
  },
  events: { hook: { name: 'Webhook', color: '#e8559a' } },

  phases: [
    { name: 'Wallet beta', dur: 30, rates: { balance: 2, transfer: 0.5, payment: 0.3 }, news: ['balance', 'transfer', 'payment'] },
    { name: 'Merchants onboard', dur: 50, rates: { balance: 4, transfer: 1, payment: 1, statement: 1 }, news: ['statement', 'Bank timeouts'], hazards: { duplicate: 0.12, timeout: 0.08 } },
    { name: 'Growth', dur: 55, rates: { balance: 9, transfer: 2, payment: 2.4, statement: 2.5 }, news: ['Traffic ×2', 'Shared accounts'], hazards: { duplicate: 0.18, timeout: 0.14, race: 5, outage: [20, 36] } },
    { name: 'Black Friday', dur: 60, rates: { balance: 16, transfer: 3, payment: 4.5, statement: 3.5 }, news: ['Traffic ×5', 'Payday surge'], surge: { at: 18, dur: 12, mult: 2, label: 'Payday', types: ['transfer', 'payment'], card: 'payday' }, hazards: { duplicate: 0.2, timeout: 0.15, race: 4, spike: 6 } },
  ],

  hazards: {
    duplicate: { type: 'payment', fix: 'idem', card: 'double', rep: 4, money: 10, text: '💸 charged twice', blocked: '🔑 retry deduped', at: 'api', firstText: 'A client retry charged twice', score: 12 },
    timeout: { type: 'payment', fix: 'recon', card: 'timeout', rep: 1.5, text: '⏳ bank timed out, money limbo', at: 'bank', firstText: 'Bank timeout: payment in limbo', score: 6 },
    race: { type: 'transfer', fix: 'lock', card: 'race', rep: 5, money: 25, text: '🏁 account overdrawn', blocked: '🔒 insufficient funds', at: 'db', firstText: 'Two withdrawals overdrew an account', startText: 'Shared accounts: concurrent withdrawals', score: 15 },
    outage: { node: 'hooks', label: 'Merchant endpoint', card: 'hooks', rep: 1.5, startText: 'Merchant webhook endpoint went down', lostText: 'Payment webhooks were lost', event: { to: 'hooks', via: 'outbox', type: 'hook' }, score: 3 },
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
      { item: 'idem', flag: 'Money APIs not idempotent' },
      { item: 'lock', flag: 'No concurrency control on balances' },
      { item: 'recon', flag: 'No plan for unknown bank outcomes' },
    ],
    proactive: [
      { item: 'idem', before: 'hazard:duplicate', signal: 'Idempotency keys before the first retry' },
      { item: 'lock', before: 'hazard:race', signal: 'Locked balances before the first overdraft' },
      { item: 'recon', before: 'hazard:timeout', signal: 'Reconciliation before the first bank timeout' },
      { item: 'outbox', before: 'outage', signal: 'Outbox before the merchant outage' },
    ],
    combos: [
      { items: ['idem', 'recon'], signal: 'Idempotent calls + reconciliation' },
      { items: ['idem', 'outbox'], signal: 'At-least-once delivery, deduped' },
    ],
    counters: [
      { counter: 'duplicate', min: 2, flag: 'Moved money twice {n}×' },
      { counter: 'race', min: 1, flag: 'Overdrew accounts {n}×' },
      { counter: 'timeout', min: 3, flag: 'Left {n} payments in limbo' },
      { counter: 'lost', min: 3, flag: 'Lost {n} merchant webhooks' },
    ],
    scaleFirst: { item: 'instance', fixes: [['type:statement', 'warehouse'], ['hot:api', 'risk']], flag: 'Scaled servers instead of fixing hot paths', signal: 'Moved heavy work off the hot path first' },
    noTraps: 'No blockchain, NoSQL ledger or per-currency services',
  },

  followups: [
    { q: 'A client retries POST /transfers after a timeout. What happens?', when: { missing: 'idem', wrong: ['double', 'exactly'], counter: ['duplicate', 2] } },
    { q: 'Two withdrawals hit one account at once. Walk me through it.', when: { missing: 'lock', wrong: ['race'], counter: ['race', 1] } },
    { q: 'The bank times out. Did the money move? How do you find out?', when: { missing: 'recon', wrong: ['timeout', 'stuck'] } },
    { q: 'The merchant endpoint is down for an hour. What do they miss?', when: { missing: 'outbox', wrong: ['hooks', 'outbox', 'spike'], counter: ['lost', 1] } },
    { q: 'Why double-entry? What invariant does it give you?', when: { wrong: ['double-entry', 'entry'] } },
    { q: 'How do you store amounts, and why not floats?', when: { wrong: ['integers', 'entry'] } },
    { q: 'Which reads need strong consistency, and which can lag?', when: { wrong: ['consistency', 'dbload', 'routing'] } },
    { q: 'Where does fraud scoring sit in the payment path?', when: { missing: 'risk', wrong: ['fraud'] } },
    { q: 'Walk me through a card payment end to end.', when: { wrong: ['flow'] } },
    { q: 'Why not a blockchain or NoSQL for the ledger?', when: { traps: true, wrong: ['start'] } },
    { q: 'How would you add a second currency to the ledger?', when: { always: true } },
  ],
};
