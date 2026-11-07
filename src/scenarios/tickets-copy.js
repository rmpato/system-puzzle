// Ticket Drop copy. Keep it short: playable without reading.

export const QUESTIONS = [
  { q: 'How many fans at on-sale?', a: 'Millions in the first minute.', good: true },
  { q: 'Can two fans get one seat?', a: 'Never. Each seat sells once.', good: true },
  { q: 'How long can a seat be held?', a: 'A few minutes to pay.', good: true },
  { q: 'Do bots buy tickets?', a: 'Scalpers run thousands of bots.', good: true },
  { q: 'Is the on-sale time known?', a: 'Yes, announced weeks ahead.', good: true },
  { q: 'Must "seats left" be exact?', a: 'It can lag a few seconds.', good: true },
  { q: 'Tickets as NFTs on a blockchain?', a: '"What problem does that solve?"', good: false, flag: 'Hype-driven design before requirements' },
  { q: 'Which font on the tickets?', a: 'Not relevant to the backend.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

export const CARDS = {
  start: { icon: '🏗️', title: 'Where do you start?', text: 'One big tour. Small team.', opts: [
    o('Monolith + Postgres, clear domains', true, 'Simple, consistent, splittable later.'),
    o('A microservice per venue', false, 'Same logic copied, no reason yet.'),
    o('Ticket ledger on a blockchain', false, 'Slow writes, solves nothing here.')] },
  assets: { icon: '🗺️', title: 'Seat map images hit API', text: 'Same SVG for every fan.', fix: 'cdn', opts: [
    o('Serve static assets from a CDN', true, 'Bytes belong at the edge.'),
    o('Add API servers', false, 'Paying compute to move bytes.'),
    o('Store the SVG in Postgres', false, 'Now the DB chokes too.')] },
  rush: { icon: '🔄', title: 'Refresh storm at 10:00', text: 'Everyone hits F5 at once.', fix: 'waitroom', opts: [
    o('Waiting room, admit at a fixed rate', true, 'Backend sees a steady flow.'),
    o('Autoscale the API', false, 'Minutes late; DB still melts.'),
    o('Return 503, they will retry', false, 'Retry storms make it worse.')] },
  surge: { icon: '📈', title: 'Millions at 10:00 sharp', text: 'Known time, 60-second burst.', fix: 'waitroom', opts: [
    o('Pre-scale + waiting room', true, 'Plan for a known peak.'),
    o('Let autoscaling react', false, 'Scales after the spike ends.'),
    o('Fastest request wins', false, 'Unfair: bots are fastest.')] },
  bots: { icon: '🤖', title: 'Bots grabbing seats', text: 'Scalpers hold half the venue.', fix: 'shield', opts: [
    o('Rate limit + bot detection at edge', true, 'Bots never reach the backend.'),
    o('CAPTCHA after payment', false, 'Seats already held by then.'),
    o('Add servers for the bots', false, 'Paying to serve scalpers.')] },
  double: { icon: '💸', title: 'Charged twice', text: 'Fan retried a slow checkout.', fix: 'idem', opts: [
    o('Idempotency key per checkout', true, 'Retries return the same order.'),
    o('Disable the Pay button', false, 'Network retries still duplicate.'),
    o('Refund duplicates later', false, 'Angry fans, not a strategy.')] },
  timeout: { icon: '⏳', title: 'Payment provider timed out', text: 'Did it charge or not?', fix: 'recon', opts: [
    o('Keep seat pending, then reconcile', true, 'Ask provider by idempotency key.'),
    o('Release the seat now', false, 'A paying fan loses the seat.'),
    o('Charge again to be sure', false, 'Might charge twice.')] },
  race: { icon: '🏁', title: 'Two fans, one seat', text: 'Same seat, same millisecond.', fix: 'hold', opts: [
    o('Atomic hold: UPDATE … WHERE free', true, 'Only one write wins.'),
    o('Check it is free, then write', false, 'Both read free. Both win.'),
    o('Lock the whole event', false, 'Serializes every buyer.')] },
  email: { icon: '📭', title: 'Email service down', text: 'Sales continue. Tickets lost?', fix: 'queue', opts: [
    o('Publish to a durable queue', true, 'Sent with retries on recovery.'),
    o('Send email inside checkout', false, 'Checkout fails with it.'),
    o('Skip it, fans will check app', false, 'Fans panic and call support.')] },
  dbload: { icon: '🔥', title: 'Database at 100%', text: 'Mostly seat-map reads.', fix: 'cache', opts: [
    o('Cache availability, short TTL', true, 'Counts may lag; holds stay exact.'),
    o('Shard by seat now', false, 'Huge complexity for reads.'),
    o('Bigger primary, forever', false, 'Vertical scaling has a ceiling.')] },
  // whiteboard cards
  fair: { icon: '⚖️', title: 'Who gets in first?', text: '2M fans waiting before 10:00.', opts: [
    o('Random order for early birds, then FIFO', true, 'Fast connections do not win.'),
    o('First request by millisecond', false, 'Bots win every time.'),
    o('Let everyone in at once', false, 'The backend melts.')] },
  autoscale: { icon: '🧮', title: 'Waiting room or autoscaling?', text: 'The spike lasts one minute.', opts: [
    o('Waiting room sized to DB capacity', true, 'The DB is the real limit.'),
    o('Autoscaling alone', false, 'New servers arrive too late.'),
    o('Both off, buy a bigger DB', false, 'Still one hot table.')] },
  ttl: { icon: '⏱️', title: 'How long is a hold?', text: 'Fan picked seats, now paying.', opts: [
    o('About 5-10 min, then auto-release', true, 'Enough to pay, not to hoard.'),
    o('One hour', false, 'Bots hoard, fans see sold out.'),
    o('No expiry', false, 'Abandoned seats never return.')] },
  expire: { icon: '⌛', title: 'Hold expired mid-payment', text: 'Payment lands after release.', opts: [
    o('Seat freed; late payment auto-refunded', true, 'Never sell one seat twice.'),
    o('Give both fans the seat', false, 'Two people, one chair.'),
    o('Never expire holds', false, 'Abandoned carts block sales.')] },
  final: { icon: '🎯', title: 'Launch next week, 4 people', text: 'What do you keep?', opts: [
    o('Waiting room, atomic holds, idem keys', true, 'Protect seats and money first.'),
    o('Everything. Delay the tour.', false, 'The on-sale date is fixed.'),
    o('Skip holds, refund oversells', false, 'Oversold seats cost trust.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Data model: seats, holds, orders', true, 'Everything else depends on it.'),
    o('The CDN vendor', false, 'Mostly configuration.'),
    o('The bot-defense provider', false, 'Swappable at the edge.')] },
};

export const PUZZLES = {
  flow: {
    kind: 'order', icon: '🧭', title: 'Happy path', text: 'Tap the purchase steps in order.',
    items: ['Join waiting room', 'Admitted with token', 'Hold seat (TTL)', 'Pay with idempotency key', 'Confirm order', 'Email ticket (queued)'],
    signal: 'Walked the purchase end to end', flag: 'Shaky on the end-to-end purchase flow',
  },
  holdapi: {
    kind: 'pick', icon: '📝', title: 'POST /holds', text: 'Pick the 3 fields the client sends.', pick: 3,
    items: [
      { t: 'event_id', good: true },
      { t: 'seat_ids', good: true },
      { t: 'queue_token', good: true },
      { t: 'price', good: false, why: 'Server computes it' },
      { t: 'user_id', good: false, why: 'From the auth token' },
      { t: 'expires_at', good: false, why: 'Server sets the TTL' },
    ],
    signal: 'Designed a safe hold API', flag: 'Hold API trusts the client',
  },
  seats: {
    kind: 'pick', icon: '💺', title: 'seats table', text: 'Pick the 3 columns a hold needs.', pick: 3,
    items: [
      { t: 'status (free/held/sold)', good: true },
      { t: 'held_by', good: true },
      { t: 'hold_expires_at', good: true },
      { t: 'buyer_email', good: false, why: 'Belongs to orders' },
      { t: 'card_token', good: false, why: 'Never on seats' },
      { t: 'seat_map_svg', good: false, why: 'Static asset, CDN' },
    ],
    signal: 'Modeled seat holds with expiry', flag: 'Seat model cannot express holds',
  },
  consistency: {
    kind: 'sort', icon: '🔀', title: 'Stale ok or strong?', text: 'Where does each read come from?',
    buckets: ['🧺 Cache ok', '🔒 Strong'],
    items: [
      { t: 'Event page & lineup', a: 0 },
      { t: 'Seat map image', a: 0 },
      { t: '"Seats left" counter', a: 0 },
      { t: 'Placing a seat hold', a: 1, why: 'Two fans, one seat' },
      { t: 'Payment status', a: 1, why: 'Money must be exact' },
      { t: 'My confirmed tickets', a: 1, why: 'Read your own writes' },
    ],
    signal: 'Knows what may be stale', flag: 'Would sell seats from stale data',
  },
};

export const BREAKS = {
  1: ['flow', 'holdapi', 'fair'],
  2: ['consistency', 'autoscale', 'ttl'],
  3: ['seats', 'expire'],
};
export const FINALS = ['final', 'reverse'];
