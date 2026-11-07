// Marketplace Rush copy, taken from the "Backend Engineer · System Design Interview" guide.
// Keep copy short: the game should be playable without reading.

export const QUESTIONS = [
  { q: 'How many concurrent users?', a: 'Small now. Black Friday ≈ 10×.', good: true },
  { q: 'Sync or async payments?', a: 'Provider callbacks can be late or time out.', good: true },
  { q: 'Real-time notifications?', a: 'A few seconds of delay is fine. Losing them isn\'t.', good: true },
  { q: 'Persistent or session cart?', a: 'Persistent, across devices.', good: true },
  { q: 'Strong consistency for payments?', a: 'Yes for payments and stock.', good: true },
  { q: 'One shared schema or per-store tenants?', a: 'One schema, store_id on every row.', good: true },
  { q: 'Kafka + Kubernetes from day one?', a: '"We have zero users…"', good: false, flag: 'Over-engineering before requirements' },
  { q: 'Which frontend framework?', a: 'Not relevant to the backend.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

// Single-choice cards. Incidents fire during play; the rest appear in whiteboard breaks.
export const CARDS = {
  start: { icon: '🏗️', title: 'Monolith or microservices?', text: 'Launch in a month. Small team.', opts: [
    o('Modular monolith with clear domains', true, 'Simple now, splittable later.'),
    o('Microservices from day one', false, 'Distributed cost, no reason yet.'),
    o('Kubernetes first, decide later', false, 'Infra before requirements.')] },
  images: { icon: '🖼️', title: 'Images served by the API', text: 'What breaks as you scale?', fix: 'cdn', opts: [
    o('Bandwidth. Move them to a CDN.', true, 'Static files belong at the edge.'),
    o('Nothing. Add servers.', false, 'Paying compute to move bytes.'),
    o('Store them in the DB', false, 'Now the DB chokes too.')] },
  search: { icon: '🐢', title: '/search is slow', text: 'Full-text over the whole catalog.', fix: 'search', opts: [
    o('Dedicated search index', true, 'Offloads the DB, scales alone.'),
    o('More DB CPU', false, 'Buys time, not a fix.'),
    o('Cache every query', false, 'Unbounded queries, low hit rate.')] },
  double: { icon: '💸', title: 'Charged twice', text: 'A user double-clicked Pay.', fix: 'idem', opts: [
    o('Idempotency key per attempt', true, 'Repeats return the same result.'),
    o('Disable the button', false, 'Retries and redelivered events still duplicate.'),
    o('Refund later', false, 'Not a strategy.')] },
  connections: { icon: '🔌', title: 'Too many connections', text: 'Servers × 10 > 40 allowed.', fix: 'pgbouncer', opts: [
    o('Connection pooler (PgBouncer)', true, 'Servers share a small pool.'),
    o('The DB will queue them', false, 'Postgres rejects them.'),
    o('max_connections = 10,000', false, 'The DB melts first.')] },
  dbload: { icon: '🔥', title: 'Database at 100%', text: 'Mostly product reads.', fix: 'cache', opts: [
    o('Cache hot reads, add a read replica', true, 'Reads scale out, writes stay safe.'),
    o('Shard it now', false, 'Huge complexity for a read problem.'),
    o('Bigger primary, forever', false, 'Vertical scaling has a ceiling.')] },
  notify: { icon: '🔕', title: 'Notifications down', text: 'Orders keep coming. Are they lost?', fix: 'queue', opts: [
    o('Publish events to a durable queue', true, 'Delivered with retries when it recovers.'),
    o('Retry 3× inside checkout', false, 'Checkout now fails with it.'),
    o('Ignore it, just emails', false, 'Stores miss their orders.')] },
  spike: { icon: '📈', title: 'Notification spike', text: 'Black Friday: 10× order events.', fix: 'queue', opts: [
    o('Queue absorbs it; scale consumers', true, 'Buffer, then drain in parallel.'),
    o('Call the notifier synchronously', false, 'Checkout slows to its speed.'),
    o('Drop notifications under load', false, 'Stores miss orders on the busiest day.')] },
  timeout: { icon: '⏳', title: 'Payment timed out', text: 'Did it charge or not?', fix: 'queue', opts: [
    o('Mark pending, then reconcile', true, 'Ask the provider by idempotency key.'),
    o('Assume failed, charge again', false, 'Might charge twice.'),
    o('Assume success, ship it', false, 'Might ship for free.')] },
  race: { icon: '🏁', title: 'Last item, two buyers', text: 'Same millisecond.', fix: 'lock', opts: [
    o('Atomic decrement / row lock', true, 'The DB enforces stock ≥ 0.'),
    o('Check stock, then decrement', false, 'Both read 1. Both win.'),
    o('Check a cached stock count first', false, 'Stale count, still oversells.')] },
  // whiteboard cards
  mock: { icon: '🧪', title: 'Frontend needs /checkout', text: 'It isn\'t built yet.', opts: [
    o('Agree the contract, share a mock', true, 'Both teams build in parallel.'),
    o('Ask them to wait', false, 'Blocks the launch.'),
    o('Let them guess the shape', false, 'Integration surprises later.')] },
  response: { icon: '📨', title: 'What does checkout return?', text: 'Payment may take a while.', opts: [
    o('201 · order_id · status: pending', true, 'Client can poll or get notified.'),
    o('200 OK, empty body', false, 'Nothing to track the order with.'),
    o('Wait until the bank settles', false, 'Timeouts under load.')] },
  flutter: { icon: '📱', title: 'Rename a field', text: 'Typed Flutter apps in the stores read `total`.', opts: [
    o('Add `amount`, keep `total`, deprecate later', true, 'Old app versions keep working.'),
    o('Rename it today', false, 'Typed clients break on old versions.'),
    o('Force everyone to update', false, 'Users churn first.')] },
  split: { icon: '✂️', title: 'Ready to split the monolith?', text: 'Teams step on each other in one module.', opts: [
    o('Extract one domain behind its API', true, 'Boundaries follow teams, not tables.'),
    o('Split every table into a service', false, 'Chatty, distributed joins.'),
    o('Rewrite everything as services', false, 'Big-bang rewrites stall.')] },
  cart: { icon: '🛒', title: 'Where does the cart live?', text: 'Users switch devices.', opts: [
    o('Server-side: DB table, Redis in front', true, 'Survives devices and restarts.'),
    o('Only in the browser', false, 'Gone on another device.'),
    o('Inside the orders table', false, 'Mixes intent with commitment.')] },
  index: { icon: '🗂️', title: '"My orders" is slow', text: 'Newest first, per user.', opts: [
    o('Index on (user_id, created_at)', true, 'Matches the filter and the sort.'),
    o('Index every column', false, 'Slows every write.'),
    o('Cache all orders forever', false, 'Stale and huge.')] },
  final: { icon: '🎯', title: 'MVP next week, 3 people', text: 'What do you keep?', opts: [
    o('Monolith, safe payments, persistent cart', true, 'Protect money, defer scale.'),
    o('Everything. Launch later.', false, 'The business needed the launch.'),
    o('Skip idempotency and locks', false, 'Those bugs cost real money.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Data model and domain boundaries', true, 'Everything else depends on them.'),
    o('The cache library', false, 'Swappable behind an interface.'),
    o('The CDN vendor', false, 'Mostly configuration.')] },
};

// Interactive whiteboard puzzles
export const PUZZLES = {
  flow: {
    kind: 'order', icon: '🧭', title: 'Happy path', text: 'Tap the checkout steps in order.',
    items: ['Add to cart', 'Create order (pending)', 'Charge with idempotency key', 'Mark order paid', 'Publish OrderPaid event', 'Notify buyer and store'],
    signal: 'Walked the purchase end to end', flag: 'Shaky on the end-to-end purchase flow',
  },
  contract: {
    kind: 'pick', icon: '📝', title: 'POST /checkout', text: 'Pick the 3 fields the client sends.', pick: 3,
    items: [
      { t: 'cart_id', good: true },
      { t: 'idempotency_key', good: true },
      { t: 'payment_token', good: true },
      { t: 'total_price', good: false, why: 'Server computes it' },
      { t: 'card_number', good: false, why: 'Never touch raw cards' },
      { t: 'user_id', good: false, why: 'Comes from the auth token' },
    ],
    signal: 'Designed a safe checkout contract', flag: 'Checkout contract trusts the client',
  },
  domains: {
    kind: 'sort', icon: '🧱', title: 'Domain boundaries', text: 'Which module owns it?',
    buckets: ['👤 Users', '📦 Catalog', '🧾 Orders', '💳 Payments'],
    items: [
      { t: 'Login & sessions', a: 0 },
      { t: 'Store products', a: 1 },
      { t: 'Stock count', a: 1 },
      { t: 'Cart', a: 2 },
      { t: 'Order history', a: 2 },
      { t: 'Refunds', a: 3 },
    ],
    signal: 'Clear domain boundaries (easy to split later)', flag: 'Fuzzy domain boundaries',
  },
  routing: {
    kind: 'sort', icon: '🔀', title: 'Replica or primary?', text: 'Where does each read go?',
    buckets: ['📚 Replica', '🐘 Primary'],
    items: [
      { t: 'Browse the catalog', a: 0 },
      { t: '"My orders" list', a: 0 },
      { t: 'Store sales dashboard', a: 0 },
      { t: 'Payment status right after paying', a: 1, why: 'Replica lag: read your own writes' },
      { t: 'Stock check before charging', a: 1, why: 'Must be current' },
    ],
    signal: 'Knows which reads tolerate replica lag', flag: 'Would read stale data from a replica',
  },
};

// Whiteboard breaks happen before the phase with that index.
export const BREAKS = {
  1: ['flow', 'contract', 'mock'],
  2: ['domains', 'flutter', 'split'],
  3: ['cart', 'routing', 'index'],
};
export const FINALS = ['final', 'reverse'];

