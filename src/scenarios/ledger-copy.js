// Money Moves copy. Keep it short: the game should be playable without reading.

export const QUESTIONS = [
  { q: 'Can a balance go negative?', a: 'Never. No overdrafts.', good: true },
  { q: 'How reliable is the bank API?', a: 'Slow. Sometimes times out.', good: true },
  { q: 'Peak traffic?', a: 'Payday and Black Friday ≈ 5×.', good: true },
  { q: 'Must merchants get every event?', a: 'Yes, within seconds. Signed.', good: true },
  { q: 'Audit requirements?', a: 'Every cent traceable for 7 years.', good: true },
  { q: 'Which currencies?', a: 'USD now. EUR next year.', good: true },
  { q: 'Put the ledger on a blockchain?', a: '"…to solve what, exactly?"', good: false, flag: 'Hype-driven ledger choice' },
  { q: 'Dark mode in the app?', a: 'Not relevant to the backend.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

// Single-choice cards. Incidents fire during play; the rest appear in whiteboard breaks.
export const CARDS = {
  start: { icon: '🏗️', title: 'Where does the ledger live?', text: 'Small team. Money must add up.', opts: [
    o('Postgres, ACID, one modular service', true, 'Transactions and constraints for free.'),
    o('A blockchain, for trust', false, 'Slow, costly, you are the only party.'),
    o('NoSQL per currency, scale later', false, 'Weak cross-row transactions, no constraints.')] },
  statements: { icon: '📄', title: 'Statements hit the primary', text: 'Big scans next to live payments.', fix: 'warehouse', opts: [
    o('Run reports on a warehouse/replica', true, 'Keep the primary for writes.'),
    o('Run them at night on the primary', false, 'Users want them now; still contends.'),
    o('Cache every statement', false, 'Unbounded, still built on primary.')] },
  double: { icon: '💸', title: 'Charged twice', text: 'Mobile client retried on timeout.', fix: 'idem', opts: [
    o('Idempotency key, stored with result', true, 'Retries replay the first response.'),
    o('Tell clients never to retry', false, 'Networks retry for you.'),
    o('Dedupe by amount + user + minute', false, 'Blocks real repeat payments.')] },
  race: { icon: '🏁', title: 'Account overdrawn', text: 'Two $80 withdrawals, $100 balance.', fix: 'lock', opts: [
    o('Row lock or UPDATE … WHERE balance ≥ 80', true, 'Second debit sees $20 and is rejected.'),
    o('Read balance, check, then write', false, 'Both read $100. Both pass.'),
    o('Check a cached balance first', false, 'Stale and still racy.')] },
  timeout: { icon: '⏳', title: 'Bank call timed out', text: 'Did the money move?', fix: 'recon', opts: [
    o('Mark pending; reconcile with the bank', true, 'Query by idempotency key, then settle.'),
    o('Assume failed, retry new charge', false, 'May pay twice.'),
    o('Assume success, mark settled', false, 'Ledger lies if it failed.')] },
  hooks: { icon: '🔕', title: 'Merchant endpoint down', text: 'Payments keep settling. Events?', fix: 'outbox', opts: [
    o('Outbox table + queue, retry w/ backoff', true, 'Written in the same transaction.'),
    o('Call the webhook inside the txn', false, 'Merchant outage blocks payments.'),
    o('Fire and forget', false, 'Merchants never ship orders.')] },
  spike: { icon: '📈', title: 'Webhook backlog', text: 'Black Friday: 5× events.', fix: 'outbox', opts: [
    o('Queue absorbs it; scale workers', true, 'Payments never wait on merchants.'),
    o('Send webhooks synchronously', false, 'Checkout as slow as merchants.'),
    o('Drop events under load', false, 'Merchants miss paid orders.')] },
  fraud: { icon: '🕵️', title: 'Payments timing out', text: 'ML fraud model runs inline.', fix: 'risk', opts: [
    o('Fast model inline with a timeout; heavy ML async', true, 'Decide before auth; deep review later.'),
    o('Skip fraud checks at peak', false, 'Fraudsters love peak.'),
    o('Bigger servers for the model', false, 'Slow model still gates every payment.')] },
  dbload: { icon: '🔥', title: 'Ledger DB at 100%', text: 'Mostly reads and statements.', fix: 'warehouse', opts: [
    o('Reports to warehouse, reads to replica', true, 'Primary keeps money writes.'),
    o('Shard by currency now', false, 'Cross-currency txns get hard.'),
    o('Relax balances to eventual', false, 'Overdrafts and angry auditors.')] },
  payday: { icon: '💰', title: 'Payday surge', text: 'Transfers ×2 for a few seconds.', opts: [
    o('Queue non-urgent work, protect writes', true, 'Money writes get priority.'),
    o('Skip ledger writes, batch later', false, 'Balances drift from reality.'),
    o('Turn off idempotency for speed', false, 'Retries spike exactly now.')] },
  // whiteboard cards
  'double-entry': { icon: '📒', title: 'Why double-entry?', text: 'Every txn: debit and credit.', opts: [
    o('Entries sum to zero: money is conserved', true, 'Bugs show up as imbalance.'),
    o('It doubles the backups', false, 'Not about redundancy.'),
    o('Only accountants need it', false, 'It is your invariant check.')] },
  integers: { icon: '🔢', title: 'Storing $10.10', text: 'Which type?', opts: [
    o('Integer minor units: 1010 cents', true, 'Exact math, no rounding drift.'),
    o('FLOAT 10.1', false, '0.1 + 0.2 ≠ 0.3.'),
    o('String "10.10"', false, 'No math, no constraints.')] },
  exactly: { icon: '🎯', title: '"Exactly-once" payments?', text: 'How do you get it?', opts: [
    o('At-least-once retries + idempotency', true, 'Effectively once, end to end.'),
    o('A queue with exactly-once mode', false, 'Breaks at your DB and the bank.'),
    o('Never retry anything', false, 'At-most-once loses payments.')] },
  outbox: { icon: '📤', title: 'Write ledger, then publish?', text: 'Crash between the two steps.', opts: [
    o('Outbox row in the same txn, relay later', true, 'Event exists iff money moved.'),
    o('Publish first, then write', false, 'Event for money that never moved.'),
    o('Two-phase commit with the broker', false, 'Fragile and slow.')] },
  stuck: { icon: '🧊', title: 'Payment pending 2 days', text: 'Bank never answered.', opts: [
    o('Reconcile with bank file, then settle/reverse', true, 'Bank statement is the arbiter.'),
    o('Delete the ledger rows', false, 'Ledger is append-only.'),
    o('Leave it pending forever', false, 'User money stuck in limbo.')] },
  final: { icon: '🎯', title: 'Launch next week, 4 people', text: 'What is non-negotiable?', opts: [
    o('Idempotency, locks, ledger, reconcile', true, 'Protect money, defer scale.'),
    o('Kubernetes and multi-region first', false, 'Scale before correctness.'),
    o('Ship now, fix money bugs later', false, 'Money bugs are lawsuits.')] },
  reverse: { icon: '🔄', title: 'Hardest to reverse?', text: 'Of today\'s choices.', opts: [
    o('Ledger schema and money model', true, 'Years of entries depend on it.'),
    o('The queue vendor', false, 'Swappable behind the outbox.'),
    o('The warehouse tool', false, 'Rebuildable from the ledger.')] },
};

// Interactive whiteboard puzzles
export const PUZZLES = {
  flow: {
    kind: 'order', icon: '🧭', title: 'Card payment flow', text: 'Tap the steps in order.',
    items: ['Receive request + idempotency key', 'Validate + sync risk rules', 'Record payment as pending', 'Call the bank with the same key', 'Post entries + outbox row in one txn', 'Relay webhook to the merchant'],
    signal: 'Walked a payment end to end', flag: 'Shaky on the payment flow',
  },
  entry: {
    kind: 'pick', icon: '📒', title: 'ledger_entries table', text: 'Pick the 5 columns.', pick: 5,
    items: [
      { t: 'txn_id', good: true },
      { t: 'account_id', good: true },
      { t: 'amount_minor (bigint)', good: true },
      { t: 'direction (debit/credit)', good: true },
      { t: 'created_at', good: true },
      { t: 'balance_float', good: false, why: 'Floats drift; derive balances' },
      { t: 'updated_at', good: false, why: 'Append-only: never updated' },
      { t: 'is_deleted', good: false, why: 'Reverse, never delete' },
    ],
    signal: 'Designed an append-only ledger', flag: 'Ledger schema loses money or history',
  },
  consistency: {
    kind: 'sort', icon: '⚖️', title: 'Strong or eventual?', text: 'What can lag?',
    buckets: ['🔒 Strong', '🕒 Eventual'],
    items: [
      { t: 'Available balance before debit', a: 0 },
      { t: 'Ledger entries of a transfer', a: 0 },
      { t: 'Idempotency key lookup', a: 0, why: 'Stale read = double charge' },
      { t: 'Monthly statement', a: 1 },
      { t: 'Merchant webhook', a: 1 },
      { t: 'Fraud ML score', a: 1 },
    ],
    signal: 'Knows where money needs strong consistency', flag: 'Would let balances go eventual',
  },
  routing: {
    kind: 'sort', icon: '🔀', title: 'Where does it run?', text: 'Pick the store.',
    buckets: ['🐘 Primary', '📚 Replica', '🏬 Warehouse'],
    items: [
      { t: 'Debit for a payment', a: 0 },
      { t: 'Balance check before transfer', a: 0, why: 'Replica lag = overdraft' },
      { t: 'Transaction history screen', a: 1 },
      { t: 'Yearly tax report', a: 2 },
      { t: 'Finance revenue dashboard', a: 2 },
    ],
    signal: 'Kept the primary for money writes', flag: 'Would run money checks on stale data',
  },
};

// Whiteboard breaks happen before the phase with that index.
export const BREAKS = {
  1: ['flow', 'entry', 'double-entry'],
  2: ['consistency', 'integers', 'outbox'],
  3: ['routing', 'exactly', 'stuck'],
};
export const FINALS = ['final', 'reverse'];
