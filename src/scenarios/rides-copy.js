// Ride Hail copy. Keep it short: the game should be playable without reading.

export const QUESTIONS = [
  { q: 'How many drivers, how often do they ping?', a: 'Thousands soon. Every 4 seconds.', good: true },
  { q: 'Can a driver get two trips at once?', a: 'Never. One active trip per driver.', good: true },
  { q: 'Charge upfront or at trip end?', a: 'Authorize at request, capture at the end.', good: true },
  { q: 'How fresh must driver locations be?', a: 'A few seconds stale is fine.', good: true },
  { q: 'One city or global at launch?', a: 'One city now. More next year.', good: true },
  { q: 'Can "driver arriving" pushes be lost?', a: 'No. Late is OK, lost is not.', good: true },
  { q: 'Multi-region active-active from day one?', a: '"We launch in one city…"', good: false, flag: 'Over-engineering before requirements' },
  { q: 'Which map colors and style?', a: 'Not relevant to the backend.', good: false },
];

const o = (t, good, why) => ({ t, good, why });

export const CARDS = {
  start: { icon: '🏗️', title: 'Day-one architecture?', text: 'One city. Small team.', opts: [
    o('Monolith + Postgres + Redis', true, 'Simple now, splittable later.'),
    o('A microservice per domain', false, 'Distributed cost, no reason yet.'),
    o('Multi-region from day one', false, 'One city needs one region.')] },
  dbload: { icon: '🔥', title: 'Postgres at 100%', text: 'Mostly driver location writes.', fix: 'geo', opts: [
    o('Move live locations to a geo index', true, 'In-memory, overwrite, TTL.'),
    o('Add read replicas', false, 'These are writes.'),
    o('Shard Postgres now', false, 'Wrong store, more pain.')] },
  nearby: { icon: '🐢', title: 'Nearby search is slow', text: 'SQL lat/lng range scans.', fix: 'geo', opts: [
    o('Look up drivers by geohash/H3 cell', true, 'Read a few cells, not the table.'),
    o('Index lat and lng separately', false, 'Still scans a wide strip.'),
    o('Cache results per rider', false, 'Drivers move every second.')] },
  tiles: { icon: '🗺️', title: 'Map tiles via the API', text: 'Same tiles for every rider.', fix: 'cdn', opts: [
    o('Serve tiles from a CDN', true, 'Static files belong at the edge.'),
    o('Add API servers', false, 'Paying compute to move bytes.'),
    o('Store tiles in Postgres', false, 'Now the DB chokes too.')] },
  eta: { icon: '⏱️', title: 'Maps API rate-limited', text: 'Every screen asks for an ETA.', fix: 'etacache', opts: [
    o('Cache ETAs per cell pair, short TTL', true, 'Nearby trips share an ETA.'),
    o('Buy more quota forever', false, 'Cost grows with every request.'),
    o('Compute routes in Postgres', false, 'Wrong tool, hot DB.')] },
  double: { icon: '💸', title: 'Rider charged twice', text: 'The app retried "end trip".', fix: 'idem', opts: [
    o('Idempotency key per trip charge', true, 'Retries return the same result.'),
    o('Disable the button', false, 'Network retries still duplicate.'),
    o('Refund later', false, 'Not a strategy.')] },
  timeout: { icon: '⏳', title: 'Payment timed out', text: 'Did the fare charge or not?', opts: [
    o('Mark pending, then reconcile', true, 'Query status or retry with same key.'),
    o('Assume failed, charge again', false, 'Might charge twice.'),
    o('Assume success, move on', false, 'Might ride for free.')] },
  race: { icon: '🏁', title: 'Driver got two trips', text: 'Two riders, same millisecond.', fix: 'cas', opts: [
    o('Atomic compare-and-set on driver', true, 'Only one assignment wins.'),
    o('Check status, then assign', false, 'Both read "free". Both win.'),
    o('Let the driver sort it out', false, 'Riders wait, then cancel.')] },
  notify: { icon: '🔕', title: 'Push service down', text: '"Driver arriving" pushes failing.', fix: 'queue', opts: [
    o('Publish events to a durable queue', true, 'Retried when it recovers.'),
    o('Retry 3× inside the trip call', false, 'Trips now fail with it.'),
    o('Drop them, riders will look', false, 'Riders miss their car.')] },
  surge: { icon: '📈', title: 'Concert just ended', text: '20× requests in one cell.', opts: [
    o('Surge price the cell, pre-scale dispatch', true, 'Balances demand, protects the core.'),
    o('Accept all, match whoever is free', false, 'Hour-long waits, no drivers.'),
    o('Reject riders in that area', false, 'Lost revenue on the best night.')] },
  // whiteboard cards
  sqlgeo: { icon: '🧮', title: 'Why not SQL lat/lng?', text: 'WHERE lat BETWEEN … AND lng …', opts: [
    o('Writes too hot, 2D range scans wide', true, 'B-trees index one axis well.'),
    o('SQL cannot store decimals', false, 'It can.'),
    o('It is fine at any scale', false, 'Not at this ping rate.')] },
  cellsize: { icon: '🔲', title: 'Pick a cell size', text: 'Search drivers by geohash cell.', opts: [
    o('Radius-sized cells + 8 neighbors', true, 'Small scan, no edge misses.'),
    o('One cell per city', false, 'Scans every driver.'),
    o('Tiny cells, center cell only', false, 'Misses drivers across edges.')] },
  offline: { icon: '📵', title: 'Driver offline mid-trip', text: 'Pings stop for 60s.', opts: [
    o('Location TTL; trip state in Postgres', true, 'Trip survives, location goes stale.'),
    o('Cancel the trip instantly', false, 'Every tunnel cancels trips.'),
    o('Keep last location forever', false, 'Ghost drivers get matched.')] },
  surgeprice: { icon: '💹', title: 'How to compute surge?', text: 'Riders ≫ drivers in a cell.', opts: [
    o('Demand/supply per cell, from a stream', true, 'Local and near real time.'),
    o('One global multiplier', false, 'Wrong for most cells.'),
    o('Query Postgres on each request', false, 'Hot path hits the DB.')] },
  final: { icon: '🎯', title: 'New city next month', text: 'Three engineers. What do you keep?', opts: [
    o('Geo index, atomic dispatch, safe payments', true, 'Protect riders and money.'),
    o('Multi-region before launch', false, 'Scale you do not need yet.'),
    o('Skip idempotency for now', false, 'Double charges cost trust.')] },
  reverse: { icon: '↩️', title: 'Hardest to reverse?', text: 'Of everything you chose today.', opts: [
    o('Trip state machine and data model', true, 'Everything depends on it.'),
    o('The geo index library', false, 'Rebuildable from live pings.'),
    o('The CDN vendor', false, 'Mostly configuration.')] },
};

export const PUZZLES = {
  lifecycle: {
    kind: 'order', icon: '🧭', title: 'Trip lifecycle', text: 'Tap the steps in order.',
    items: ['Rider requests a ride', 'Find nearby drivers by cell', 'Driver accepts (atomic assign)', 'Driver picks up rider', 'Drop off at destination', 'Charge with idempotency key', 'Send receipt'],
    signal: 'Walked the trip lifecycle end to end', flag: 'Shaky on the trip lifecycle',
  },
  ping: {
    kind: 'pick', icon: '📍', title: 'Location ping', text: 'Pick the 3 fields each ping stores.', pick: 3,
    items: [
      { t: 'driver_id', good: true },
      { t: 'lat, lng', good: true },
      { t: 'timestamp', good: true },
      { t: 'driver_name', good: false, why: 'Static: fetch once' },
      { t: 'city_name', good: false, why: 'Derive from the cell' },
      { t: 'rider_rating', good: false, why: 'Not location data' },
    ],
    signal: 'Kept location pings tiny', flag: 'Bloated location pings',
  },
  request: {
    kind: 'pick', icon: '📝', title: 'POST /trips', text: 'Pick the 3 fields the rider sends.', pick: 3,
    items: [
      { t: 'pickup', good: true },
      { t: 'dropoff', good: true },
      { t: 'idempotency_key', good: true },
      { t: 'fare', good: false, why: 'Server computes it' },
      { t: 'driver_id', good: false, why: 'Dispatch picks the driver' },
      { t: 'user_id', good: false, why: 'Comes from the auth token' },
    ],
    signal: 'Designed a safe trip request', flag: 'Trip request trusts the client',
  },
  storage: {
    kind: 'sort', icon: '🗄️', title: 'Where does it live?', text: 'Pick a store for each.',
    buckets: ['📍 Geo index', '🐘 Postgres', '🌊 Stream'],
    items: [
      { t: 'Live driver location', a: 0 },
      { t: 'Drivers in a cell', a: 0 },
      { t: 'Trip record', a: 1 },
      { t: 'Payment status', a: 1, why: 'Durable, transactional' },
      { t: 'Location history', a: 2, why: 'Analytics, not the hot path' },
      { t: 'Demand signals for surge', a: 2 },
    ],
    signal: 'Right store for each kind of data', flag: 'Mixed hot location data with durable records',
  },
  consistency: {
    kind: 'sort', icon: '⚖️', title: 'Strong or eventual?', text: 'How consistent must it be?',
    buckets: ['🔒 Strong', '🌫️ Eventual'],
    items: [
      { t: 'Driver assignment', a: 0 },
      { t: 'Fare charge', a: 0 },
      { t: 'Trip completed status', a: 0 },
      { t: 'Car dot on rider map', a: 1 },
      { t: 'Surge multiplier', a: 1 },
      { t: 'ETA shown', a: 1 },
    ],
    signal: 'Knows where consistency matters', flag: 'Unclear where strong consistency is needed',
  },
};

export const BREAKS = {
  1: ['lifecycle', 'ping', 'sqlgeo'],
  2: ['storage', 'request', 'cellsize'],
  3: ['consistency', 'offline', 'surgeprice'],
};
export const FINALS = ['final', 'reverse'];
