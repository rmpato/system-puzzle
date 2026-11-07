// Learn: short, approachable primers on the concepts behind every exercise.
// Not answers to a specific exercise: the general idea, when to use it, what goes wrong, and how to say it.
// flows: before/after sketches. A node is [icon, label]; icon is a GCP product id (see gcp.js) or an emoji.
// items: shop item ids that teach this concept (used for "practice it in" and contextual links).

export const GROUPS = [
  ['approach', 'How to approach it'],
  ['scale', 'Scaling traffic'],
  ['data', 'Storing data'],
  ['async', 'Async & pipelines'],
  ['correct', 'Correctness under failure'],
  ['realtime', 'Real-time & location'],
];

export const CONCEPTS = [
  // ── approach
  {
    id: 'loop', group: 'approach', icon: '🧭', title: 'The interview loop',
    idea: 'Strong answers follow the same arc: clarify, estimate, sketch the simplest design that works, then find and fix the bottlenecks.',
    flows: [{ nodes: [['❓', 'Clarify'], ['🧮', 'Estimate'], ['✏️', 'Simple design'], ['🔥', 'Bottlenecks'], ['🔁', 'Iterate']] }],
    when: ['Every system design question', 'Say each step out loud so the interviewer can follow'],
    watch: ['Reaching for Kafka and Kubernetes before you know the scale', 'Spending half the time on requirements'],
    say: 'Before I draw anything: who uses it, how many of them, and what must never go wrong?',
    game: 'The game follows this arc: questions, an MVP, incidents as traffic grows, then whiteboard breaks.',
  },
  {
    id: 'estimate', group: 'approach', icon: '🧮', title: 'Back-of-envelope math',
    idea: 'Rough numbers decide the design. 10 requests per second and 100,000 per second are different systems.',
    numbers: ['1 day ≈ 100,000 seconds (86,400)', '1M requests/day ≈ 12/s on average', 'Peaks are often 2–10× the average', 'Read-heavy apps: 10:1 to 100:1 reads to writes'],
    when: ['Right after clarifying', 'Before choosing a database, cache or queue'],
    watch: ['False precision: round aggressively', 'Forgetting the peak (Black Friday, a viral post, an on-sale)'],
    say: '100M daily users × 10 reads ≈ 1B reads/day ≈ 12k/s, maybe 50k/s at peak. One database won\'t serve that alone.',
  },
  {
    id: 'latency', group: 'approach', icon: '⏱️', title: 'Latency numbers',
    idea: 'Memory is about 1,000× faster than disk, and a round trip across the world takes ~100 ms. Caches and CDNs exist because of these gaps.',
    numbers: ['Memory read: ~100 ns', 'SSD read: ~100 µs', 'Round trip in one datacenter: ~0.5 ms', 'Round trip across continents: ~100–150 ms'],
    when: ['Explaining why a cache or CDN helps', 'Deciding what can be synchronous'],
    watch: ['Chaining many network calls in one request: the latencies add up', 'Cross-region calls on the hot path'],
    say: 'A cache hit is under a millisecond; a cross-region call is 100 ms, so the hot path stays in one region.',
  },
  {
    id: 'simple', group: 'approach', icon: '🌱', title: 'Start simple',
    idea: 'Pick the boring design that meets today\'s numbers, and say what you would add when they grow. Every extra moving part costs money and attention forever.',
    flows: [
      { label: 'Day one', tone: 'good', nodes: [['👤', 'Users'], ['compute-engine', 'API'], ['cloud-sql', 'Postgres']] },
      { label: 'Too early', tone: 'bad', nodes: [['👤', 'Users'], ['gke', '12 microservices'], ['spanner', 'Sharded DB']] },
    ],
    when: ['Launch: one API and one database is usually enough', 'Add a part when a measured bottleneck appears'],
    watch: ['Microservices, Kubernetes or sharding on day one', 'Building what a managed service already does (your own CDN or push service)'],
    say: 'For launch one Postgres is enough. I would shard only when writes outgrow one primary, which is likely years away.',
    game: 'Traps cost upkeep every second and are flagged as over-engineering when bought early.',
    items: ['k8s', 'micro', 'region', 'multi', 'owncdn', 'codec', 'chain', 'ownpush', 'personal', 'ranker', 'graph', 'ml', 'mesh'],
  },
  {
    id: 'consistency', group: 'approach', icon: '⚖️', title: 'Consistency vs availability',
    idea: 'When parts of a system can\'t talk to each other, you choose: refuse to answer (stay correct) or answer with possibly stale data (stay up). Choose per feature, not per system.',
    when: ['Strong consistency: balances, inventory, seat holds', 'Eventual consistency: likes, feeds, view counts, search'],
    watch: ['Calling money "eventually consistent"', 'Making everything strongly consistent and slow'],
    say: 'Balances are strongly consistent on one primary; like counts can be a few seconds stale.',
  },

  // ── scale
  {
    id: 'horizontal', group: 'scale', icon: '🖥️', title: 'Stateless servers & load balancing',
    idea: 'Keep app servers stateless (sessions live in a cache or a token) so you can add more behind a load balancer when traffic grows.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['👤', 'Users'], ['compute-engine', 'One server']] },
      { label: 'After', tone: 'good', nodes: [['👤', 'Users'], ['load-balancing', 'Load balancer'], ['compute-engine', 'Servers ×N']] },
    ],
    when: ['A CPU-bound API that is otherwise healthy', 'Steady traffic growth'],
    watch: ['More servers don\'t fix a slow database, and often make it worse (more connections)', 'In-memory sessions break when a server dies'],
    say: 'The API is stateless, so it scales horizontally behind a load balancer.',
    items: ['instance', 'server', 'worker'],
  },
  {
    id: 'caching', group: 'scale', icon: '⚡', title: 'Caching',
    idea: 'Keep hot data in memory so most reads never reach the database.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['compute-engine', 'API'], ['cloud-sql', 'DB']], arrows: ['every read'] },
      { label: 'After', tone: 'good', nodes: [['compute-engine', 'API'], ['memorystore', 'Cache'], ['cloud-sql', 'DB']], arrows: ['~90% hits', 'misses only'] },
    ],
    numbers: ['A 90% hit rate cuts database reads by 10×'],
    when: ['Read-heavy data that changes rarely', 'Expensive computed results: feeds, ETAs, top suggestions'],
    watch: ['Stale data: set a TTL or invalidate on write', 'Stampede: a hot key expires and every request hits the DB at once'],
    say: 'Cache-aside: read Redis; on a miss, read Postgres and store it with a TTL.',
    items: ['cache', 'timeline', 'etacache', 'presence', 'quota'],
  },
  {
    id: 'cdn', group: 'scale', icon: '🌐', title: 'CDN & edge caching',
    idea: 'Serve static files and media from servers close to users, so those requests never touch your API.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['👤', 'Users'], ['compute-engine', 'API'], ['cloud-storage', 'Files']] },
      { label: 'After', tone: 'good', nodes: [['👤', 'Users'], ['cloud-cdn', 'CDN edge'], ['cloud-storage', 'Files']], arrows: ['', 'misses only'] },
    ],
    when: ['Images, video, JS/CSS, map tiles', 'Viral content: one object requested millions of times'],
    watch: ['Never cache private or personalized responses publicly', 'Purging is slow; put a version in file names instead'],
    say: 'Media lives in object storage behind a CDN; the API only returns URLs.',
    items: ['cdn'],
  },
  {
    id: 'ratelimit', group: 'scale', icon: '🛡️', title: 'Rate limiting & admission control',
    idea: 'Protect the system from bots and spikes: cap requests per user (token bucket), and when demand far exceeds supply, queue people fairly in a waiting room.',
    flows: [{ nodes: [['👤', 'Clients'], ['cloud-armor', 'Limiter'], ['compute-engine', 'API']], arrows: ['', 'within quota'] }],
    when: ['Login, signup, public APIs', 'Ticket on-sales and drops'],
    watch: ['Limit by user or API key, not only by IP (offices share IPs)', 'Return 429 with Retry-After so clients back off'],
    say: 'Token bucket per user at the edge; for the on-sale, a waiting room admits fans at the rate checkout can handle.',
    game: 'Debouncing on the client is the cheapest limit of all: the request never leaves the phone.',
    items: ['ratelimit', 'shield', 'waitroom', 'debounce'],
  },

  // ── data
  {
    id: 'replicas', group: 'data', icon: '📚', title: 'Read replicas',
    idea: 'Copies of the database that serve reads. The primary still takes every write and streams changes to the replicas.',
    flows: [{ nodes: [['compute-engine', 'API'], ['cloud-sql', 'Primary'], ['cloud-sql', 'Replicas']], arrows: ['writes', 'copies (ms–s later)'] }],
    when: ['Read-heavy workloads: browsing, search, timelines', 'Reports that shouldn\'t slow the primary'],
    watch: ['Replication lag: a user may not see their own write, so read it from the primary', 'Replicas don\'t help write-heavy load'],
    say: 'Reads go to replicas; right after a user writes, I read their data from the primary.',
    items: ['replica', 'dbup'],
  },
  {
    id: 'pooling', group: 'data', icon: '🔌', title: 'Connection pooling',
    idea: 'A database accepts a limited number of connections. A pooler lets many app servers share a few.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['compute-engine', '10 servers'], ['cloud-sql', 'DB (limit 40)']], arrows: ['10 × 10 = 100 conns'] },
      { label: 'After', tone: 'good', nodes: [['compute-engine', '10 servers'], ['🔌', 'Pooler'], ['cloud-sql', 'DB']], arrows: ['', '20 conns'] },
    ],
    when: ['Many app instances or serverless functions', 'Errors like "too many connections"'],
    watch: ['Adding servers can make it worse: each brings its own pool', 'Long transactions hold connections; keep them short'],
    say: 'Ten instances × 20 connections blows past the Postgres limit, so I would put PgBouncer in front.',
    items: ['pgbouncer'],
  },
  {
    id: 'indexes', group: 'data', icon: '🔍', title: 'Indexes & search',
    idea: 'An index trades some write speed and space for fast lookups. Pick the right kind: B-tree for exact and range queries, inverted index for text, trie for prefixes.',
    when: ['Filtering by a column: user_id, email, alias', 'Full-text search → a search index; autocomplete → a prefix trie with top results'],
    watch: ['LIKE \'%term%\' on the main database scans every row', 'A unique index is your last line of defense against duplicates'],
    say: 'A unique index on the alias guarantees no duplicates, even when two requests race.',
    items: ['search', 'unique', 'trie'],
  },
  {
    id: 'sharding', group: 'data', icon: '🗂️', title: 'Sharding',
    idea: 'Split data across several databases by a key (user, tenant, region) so each one handles a slice of the writes.',
    flows: [{ nodes: [['compute-engine', 'API'], ['🧭', 'Route by user_id'], ['cloud-sql', 'Shard A · B · C']] }],
    when: ['Writes or data size beyond one primary, after caching and replicas', 'A natural partition key exists'],
    watch: ['Hot keys: one celebrity or one hot seat can still melt one shard', 'Cross-shard queries and transactions get hard, and it is costly to undo'],
    say: 'I would shard by user_id only when one primary can\'t take the writes; until then it\'s complexity we don\'t need.',
    items: ['shard', 'nosql', 'dbnode'],
  },
  {
    id: 'ids', group: 'data', icon: '🔢', title: 'Unique IDs at scale',
    idea: 'Generate IDs without a single bottleneck: lease counter ranges per server, use time + machine IDs (Snowflake-style), or random UUIDs.',
    when: ['Short codes, order IDs, message IDs'],
    watch: ['Random short codes collide as the space fills up', 'Sequential IDs are guessable; sometimes that leaks data'],
    say: 'Each server leases a block of 1,000 IDs and base62-encodes them: no collisions, no hot row.',
    items: ['idgen'],
  },
  {
    id: 'objects', group: 'data', icon: '🪣', title: 'Object storage & direct uploads',
    idea: 'Big files belong in object storage, not in your database or API. Clients upload straight to it with a short-lived signed URL.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['👤', 'Client'], ['compute-engine', 'API streams 2 GB'], ['cloud-storage', 'Storage']] },
      { label: 'After', tone: 'good', nodes: [['👤', 'Client'], ['cloud-storage', 'Storage']], arrows: ['signed URL from the API'] },
    ],
    when: ['Video, photos, attachments', 'Uploads that would tie up API servers for minutes'],
    watch: ['Signed URLs should expire in minutes and limit size and type', 'Process files asynchronously after upload (transcode, scan)'],
    say: 'The API issues a pre-signed URL, the client uploads directly, and an event triggers processing.',
    items: ['presign'],
  },

  // ── async
  {
    id: 'queues', group: 'async', icon: '📬', title: 'Queues & async work',
    idea: 'Put slow or flaky work on a queue and answer the user right away. Workers process it at their own pace and retry on failure.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['compute-engine', 'API'], ['cloud-functions', 'Email service']], arrows: ['down = request fails'] },
      { label: 'After', tone: 'good', nodes: [['compute-engine', 'API'], ['pubsub', 'Queue'], ['cloud-run', 'Worker'], ['cloud-functions', 'Email service']], arrows: ['', '', 'retries'] },
    ],
    when: ['Notifications, emails, transcoding, analytics', 'Absorbing spikes: the queue buffers the burst'],
    watch: ['Queues deliver at least once: make consumers idempotent', 'Watch queue depth; add a dead-letter queue for messages that keep failing'],
    say: 'Checkout saves the order, publishes OrderPlaced and returns; the notifier consumes it and retries if the provider is down.',
    items: ['queue', 'risk'],
  },
  {
    id: 'outbox', group: 'async', icon: '📤', title: 'Transactional outbox',
    idea: 'Saving to the database and publishing an event are two systems, and one can fail. Write the event to an outbox table in the same transaction, then relay it.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['compute-engine', 'API'], ['cloud-sql', 'DB ✓'], ['pubsub', 'Queue ✗']], arrows: ['', 'crash = event lost'] },
      { label: 'After', tone: 'good', nodes: [['compute-engine', 'API'], ['cloud-sql', 'DB + outbox'], ['🔁', 'Relay'], ['pubsub', 'Queue']], arrows: ['one transaction'] },
    ],
    when: ['Any "save, then notify" flow where losing the event matters: payments, webhooks'],
    watch: ['The relay delivers at least once, so consumers dedupe', 'Clean up old outbox rows'],
    say: 'No dual writes: the event goes into an outbox row in the same transaction, and a relay publishes it.',
    items: ['outbox'],
  },
  {
    id: 'fanout', group: 'async', icon: '📰', title: 'Fan-out on write vs on read',
    idea: 'A feed can be built when a post is written (push it into every follower\'s timeline) or when a feed is read (pull and merge). Big systems mix both.',
    flows: [
      { label: 'On write', tone: 'good', nodes: [['👤', 'Author'], ['pubsub', 'Queue'], ['cloud-run', 'Workers'], ['memorystore', 'Follower timelines']] },
      { label: 'On read', nodes: [['👤', 'Reader'], ['compute-engine', 'API'], ['cloud-sql', 'Merge follows + posts']] },
    ],
    when: ['On write: regular users, so reads are instant', 'On read: celebrities with millions of followers'],
    watch: ['One celebrity post written to 50M timelines', 'Wasted work for followers who never log in'],
    say: 'Push for most users, pull celebrity posts at read time and merge: hybrid fan-out.',
    items: ['hybrid', 'worker', 'timeline'],
  },
  {
    id: 'batching', group: 'async', icon: '➕', title: 'Batching & counters',
    idea: 'Don\'t update one database row per event. Count in memory with an atomic increment and flush totals every few seconds.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['👤', '10k likes/s'], ['cloud-sql', 'UPDATE one row']], arrows: ['lock contention'] },
      { label: 'After', tone: 'good', nodes: [['👤', 'Likes'], ['memorystore', 'INCR'], ['cloud-sql', 'DB']], arrows: ['', 'flush every 5 s'] },
    ],
    when: ['Views, likes, clicks, metrics'],
    watch: ['Counts lag a few seconds (usually fine)', 'Unflushed counts can be lost unless the cache persists'],
    say: 'Likes go to Redis INCR; a job flushes the deltas to Postgres every few seconds.',
    items: ['counter'],
  },
  {
    id: 'analytics', group: 'async', icon: '📊', title: 'Serving vs analytics',
    idea: 'Your main database serves users with small, fast queries. Reports, trends and logs scan huge amounts of data, so stream them to a warehouse.',
    flows: [{ nodes: [['compute-engine', 'App'], ['pubsub', 'Events'], ['dataflow', 'Pipeline'], ['bigquery', 'Warehouse']] }],
    when: ['Dashboards, statements, trending terms, ML features'],
    watch: ['Big reports on the primary slow down checkout', 'Warehouse data is minutes behind, which is fine for reports'],
    say: 'Events stream into BigQuery; statements and trending run there, not on the ledger database.',
    items: ['trend', 'warehouse'],
  },

  // ── correctness
  {
    id: 'idempotency', group: 'correct', icon: '🔑', title: 'Idempotency',
    idea: 'Networks retry. An idempotent operation gives the same result when repeated, so a retried payment doesn\'t charge twice.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['👤', 'Client retries'], ['compute-engine', 'API'], ['💳', 'Charged twice']] },
      { label: 'After', tone: 'good', nodes: [['👤', 'Key: abc'], ['compute-engine', 'Seen abc? Replay result'], ['💳', 'Charged once']] },
    ],
    when: ['Payments, orders, any POST a client may retry', 'Consumers of at-least-once queues'],
    watch: ['Save the key and the result atomically with the operation', 'Keys need a scope (per user) and an expiry'],
    say: 'The client sends an Idempotency-Key; we store it with the result in the same transaction and replay it on retries.',
    items: ['idem'],
  },
  {
    id: 'races', group: 'correct', icon: '🔒', title: 'Race conditions & locking',
    idea: 'Two requests read the same value and both act on it: two buyers get the last item. Make the check and the update one atomic step.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['👤', 'A reads stock = 1'], ['👤', 'B reads stock = 1'], ['📦', 'Both buy: oversold']] },
      { label: 'After', tone: 'good', nodes: [['👤', 'A and B'], ['cloud-sql', 'UPDATE … WHERE stock > 0'], ['📦', 'One wins']] },
    ],
    numbers: ['Tools: conditional UPDATE · row lock (SELECT … FOR UPDATE) · version check (CAS) · Redis SET NX with a TTL'],
    when: ['Inventory, seats, balances, assigning a driver'],
    watch: ['Read-modify-write in application code is the classic bug', 'Lock the smallest thing for the shortest time'],
    say: 'A conditional update or SELECT … FOR UPDATE; for seats, an atomic hold with a TTL.',
    items: ['lock', 'hold', 'cas'],
  },
  {
    id: 'reconcile', group: 'correct', icon: '🔁', title: 'Timeouts & reconciliation',
    idea: 'A timeout doesn\'t mean it failed. The payment may have gone through. Mark it pending and check with the provider instead of guessing.',
    flows: [
      { label: 'Before', tone: 'bad', nodes: [['compute-engine', 'API'], ['💳', 'Provider'], ['❌', '"Failed" (money moved)']], arrows: ['timeout'] },
      { label: 'After', tone: 'good', nodes: [['compute-engine', 'API'], ['⏳', 'Pending'], ['cloud-scheduler', 'Reconciler asks provider'], ['✅', 'Settled']] },
    ],
    when: ['Any call to a third party that moves money or changes state'],
    watch: ['Never blindly retry a call that isn\'t idempotent', 'Show "processing" instead of a false error'],
    say: 'On timeout the order stays pending; a reconciler queries the provider by our reference and settles it.',
    items: ['recon'],
  },
  {
    id: 'delivery', group: 'correct', icon: '✅', title: 'Delivery guarantees & ordering',
    idea: 'At-most-once can lose messages; at-least-once can duplicate them. "Exactly once" in practice means at-least-once plus idempotent processing. Ordering needs a sequence number per conversation.',
    when: ['Chat, payments, webhooks, event pipelines'],
    watch: ['Global ordering is expensive; per-conversation order is usually enough', 'Only mark a message delivered after the receiver acknowledges it'],
    say: 'At-least-once with client message IDs to dedupe, and a per-conversation sequence number for ordering.',
    items: ['acks', 'seq'],
  },

  // ── real-time
  {
    id: 'realtime', group: 'realtime', icon: '📡', title: 'Polling vs WebSockets',
    idea: 'Polling asks "anything new?" over and over, and most answers are "no". A WebSocket keeps one connection open so the server pushes instantly.',
    flows: [
      { label: 'Polling', tone: 'bad', nodes: [['📱', 'App'], ['compute-engine', 'API']], arrows: ['every 2 s, mostly empty'] },
      { label: 'WebSocket', tone: 'good', nodes: [['📱', 'App'], ['api-gateway', 'WS gateway'], ['compute-engine', 'Chat service']], arrows: ['one open connection'] },
    ],
    when: ['Chat, live location, collaboration, live scores'],
    watch: ['Millions of open connections need dedicated gateway servers', 'Apps in the background need push notifications instead'],
    say: 'Clients hold a WebSocket to a gateway; offline users get a push notification.',
    items: ['ws', 'presence'],
  },
  {
    id: 'geo', group: 'realtime', icon: '📍', title: 'Geo indexing',
    idea: '"Drivers near me" can\'t scan every driver. Split the map into cells (geohash, S2, H3), index everything by cell, and search the nearby cells.',
    when: ['Ride hailing, delivery, maps, "near me" search'],
    watch: ['Location pings are write-heavy: keep them in memory, not the main database', 'Edges: also search the neighboring cells'],
    say: 'Drivers ping every few seconds into Redis GEO; dispatch searches the rider\'s cell and its neighbors.',
    items: ['geo'],
  },
];

export const conceptById = (id) => CONCEPTS.find((c) => c.id === id);
export const conceptForItem = (itemId) => CONCEPTS.find((c) => (c.items || []).includes(itemId));

// Cards without a `fix` item link to a concept by id ('scenario:card' wins over 'card').
export const CARD_LEARN = {
  final: 'simple', reverse: 'simple', start: 'simple', 'ledger:start': 'consistency',
  'url-shortener:http': 'caching', 'url-shortener:length': 'estimate', 'url-shortener:index': 'indexes', 'url-shortener:edit': 'caching',
  'typeahead:topk': 'indexes', 'typeahead:like': 'indexes', 'typeahead:fresh': 'analytics', 'typeahead:personal': 'simple',
  'marketplace:response': 'reconcile', 'marketplace:split': 'simple', 'marketplace:cart': 'caching', 'marketplace:index': 'indexes',
  'video:sync': 'queues', 'video:abr': 'cdn', 'video:counting': 'batching', 'video:eventual': 'consistency',
  'chat:groups': 'fanout', 'chat:storage': 'sharding', 'chat:pagination': 'indexes', 'chat:bigroup': 'fanout', 'chat:sticky': 'realtime',
  'feed:viral': 'caching', 'feed:ranking': 'simple', 'feed:graph': 'simple', 'feed:pagination': 'indexes', 'feed:counts': 'batching', 'feed:inactive': 'fanout',
  'tickets:fair': 'ratelimit', 'tickets:autoscale': 'ratelimit', 'tickets:ttl': 'races', 'tickets:expire': 'reconcile',
  'rides:timeout': 'reconcile', 'rides:surge': 'estimate', 'rides:sqlgeo': 'geo', 'rides:cellsize': 'geo', 'rides:offline': 'realtime', 'rides:surgeprice': 'analytics',
  'ledger:payday': 'queues', 'ledger:double-entry': 'consistency', 'ledger:exactly': 'delivery', 'ledger:outbox': 'outbox', 'ledger:stuck': 'reconcile',
};
export const conceptForCard = (scId, cardId, card = {}) => card.learn || (card.fix && conceptForItem(card.fix)?.id) || CARD_LEARN[`${scId}:${cardId}`] || CARD_LEARN[cardId] || null;
