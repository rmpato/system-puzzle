# Writing a scenario

A scenario is one system-design interview exercise, playable in about 10 minutes. It is a single JS module that default-exports a plain object (optionally with its copy in a sibling `*-copy.js` file). The engine (`src/engine/sim.js`), renderer (`src/main.js`) and balance bot (`tools/balance.mjs`) are fully data-driven: **you never edit them to add a scenario.**

Reference implementation: `src/scenarios/marketplace.js` + `src/scenarios/marketplace-copy.js`. Read both before starting.

## Workflow

```bash
node tools/validate.mjs src/scenarios/<id>.js      # schema + layout checks; must show 0 errors
node tools/balance.mjs src/scenarios/<id>.js 150   # balance across 6 bot strategies
FLAGS=1 node tools/balance.mjs src/scenarios/<id>.js 150   # + most common red flags
```

Registering in `src/scenarios/index.js` makes it appear in the picker (the lead integrator does this).

## Design principles

- **Interview-grade.** Every incident, puzzle and follow-up must be something a real interviewer asks for this system. Mechanics must teach the real lesson (e.g. a cache really reduces DB load; skipping idempotency really double-charges).
- **Minimal text.** Card titles ≤ 6 words, text ≤ 8 words, options ≤ ~45 chars, `why` ≤ 8 words. Shop names ≤ 13 chars, `desc` ≤ 6 words. The game must be playable without reading paragraphs.
- **Fix the expensive path before scaling.** Each scenario should have at least one expensive request type that a specific part fixes (cheaper than adding servers), plus traps (over-engineering) that cost upkeep.
- **Start simple.** The first phase should be calm; problems arrive phase by phase.

## Board layout

Ground coordinates `pos: [x, z]`. The camera looks from +z toward the origin. Keep everything within x ∈ [-17, 17], z ∈ [-9, 12]. Users usually sit at x ≈ -15 (left), the request flow goes left to right, the async/payment lane sits lower (z ≈ 9–11). Keep any two spots ≥ 3.5 apart (labels overlap otherwise); the validator warns.

## Schema

```js
export default {
  id: 'kebab-id', title: 'Short Name', icon: '🛒',
  pitch: 'One line for the picker.', topics: ['3-5 short concept tags'],
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert',
  brief: '"The interviewer\'s prompt, in quotes, 1-2 sentences."',
  money: 100,              // starting budget
  startCard: 'start',      // card shown ~2.5s in (usually an architecture-choice question)

  // Capacity pools: requests spend "cost" from pools; tokens refill at cap per second.
  // cap = base + Σ count(item) * per[item]. Pools on the same node share its gauge.
  pools: {
    api:  { node: 'api', base: 8, per: { instance: 8 } },
    db:   { node: 'db', base: 12, conn: true },                     // conn: subject to the connection limit
    read: { node: 'db', base: 0, per: { replica: 12 }, fallback: 'db', conn: true },
  },
  // Optional connection-limit mechanic (servers × pool size > DB limit). Remove if not relevant.
  connections: { pool: 'db', base: 10, per: { instance: 10 }, limit: 40, fix: 'pgbouncer', fixed: 20, card: 'connections', firstText: '…', label: 'conns' },

  // Fixed parts on the board. Exactly one `users` node. At most one `servers` node (grows with its item).
  nodes: [
    { id: 'users', model: 'users', pos: [-15, 0], label: 'Users' },
    { id: 'api', model: 'servers', pos: [0, 0], label: 'API', item: 'instance', color: '#a9c8ff' },
    { id: 'db', model: 'db', pos: [12, 0], label: 'Postgres', color: '#ffd59a' },
  ],

  // Buyable parts. The `servers` node's item needs no pos/model.
  shop: [
    { id: 'instance', icon: '🖥️', name: 'API server', cost: 110, costStep: 0.15, max: 8, desc: '+8 req/s', scales: 'api' },
    { id: 'cache', icon: '🧺', name: 'Redis', cost: 160, desc: 'Cheaper reads', model: 'box', color: '#ffb3b3', pos: [5.5, 6], label: 'Redis',
      symptom: 'hot:db', proactive: 2 },
    { id: 'replica', icon: '📚', name: 'Read replica', cost: 220, max: 2, slots: [[15.6, -3.2], [15.6, 3.2]], model: 'cyl', label: 'Replica', scales: 'read' },
    { id: 'k8s', icon: '☸️', name: 'Kubernetes', cost: 350, upkeep: 2, trap: true, desc: '+capacity · costs $2/s', model: 'wheel', pos: [0, 0], ghost: 9.6, label: 'Kubernetes' },
  ],
  // Bot roles (required so the balance bot can play; also documents intent):
  //   scales: 'pool'      capacity item (bot buys when that node is hot)
  //   symptom: key|[keys] fix item, bought after the symptom appears. Keys:
  //                       'type:<typeId>' first request of that type · 'hazard:<id>' first damage from a hazard
  //                       'hot:<nodeId>' node first overloaded · 'outage' outage started · 'conn' connection limit hit
  //   proactive: phase    expert buys it from this phase on, before the symptom
  //   relieves: 'pool'    fixing this makes scaling that pool unnecessary (used for the "scaled first" red flag)
  //   fixesConn: true     the connections.fix item
  //   trap: true          over-engineering; flagged if bought before `trapUntil` (default: last phase)
  // Visual: model (see list below), color, label, pos | slots, ghost (slot size, default 2.6), r (wire padding).

  // Diagram arrows. Items only appear once built; `if`/`unless` toggle arrows.
  wires: [['users', 'api'], ['api', 'cache', { if: 'cache' }], ['db', 'replica', { if: 'replica', dashed: true }]],

  // Request types. Each request flies from `users` to its first step's node (or bypass node),
  // then spends `cost` from each step's pool, in order. Fails if a pool lacks tokens.
  types: {
    browse: { name: 'Browse', color: '#2f6fed', steps: [
      { pool: 'api', cost: 1 },
      { pool: 'read', cost: 1, mods: { cache: 0.5 },             // cost × 0.5 once cache is built (0 = skip the step)
        via: [{ item: 'cache', p: 0.5 }, { item: 'replica', p: 0.5 }] }, // where the decorative hop goes
    ] },
    image: { name: 'Image', color: '#e8930c', bypass: { item: 'cdn', node: 'cdn' }, // once cdn is built, served at the cdn
      steps: [{ pool: 'api', cost: 3 }], cardOnSeen: 'images', firstText: 'Images started hitting the API' },
    search: { …, cardOnFail: 'search', cardOnFailUnless: 'search', hops: [{ node: 'search', if: 'search' }] },
    checkout: { …, value: 10,                                     // value requests earn money and carry hazards
      hops: [{ node: 'psp' }], cashAt: 'psp',
      event: { from: 'psp', to: 'notify', via: 'queue', type: 'notif' } }, // async follow-up event (lost during an outage of `to` unless `via` is built)
  },
  events: { notif: { name: 'Notify', color: '#e8559a' } },

  phases: [ // 3-4 phases, ~170-230s total. hazards per phase:
    { name: 'MVP launch', dur: 30, rates: { browse: 2, checkout: 0.4 }, news: ['browse', 'checkout'] },
    { name: 'Growth', dur: 50, rates: { … }, news: ['image', 'Traffic ×3'], hazards: { duplicate: 0.1 } },
    { name: 'Peak', dur: 60, rates: { … }, hazards: { duplicate: 0.18, timeout: 0.12, race: 7, spike: 8, outage: [18, 34] } },
  ],
  // Supported hazards (engine-defined; only these):
  //   duplicate: p    fraction of hazards.duplicate.type requests that arrive twice; without `fix` → damage
  //   timeout: p      fraction that time out; without `fix` → lost sale
  //   race: seconds   every N s two requests race for the same resource; without `fix` → damage
  //   outage: [a,b]   node down from a to b seconds into the phase; events to it are lost unless via `event.via`
  //   spike: seconds  shows hazards.spike.card at that time
  //   overload        (global) hazards.overload.card when its node stays >105% for `after` seconds
  hazards: {
    duplicate: { type: 'checkout', fix: 'idem', card: 'double', rep: 4, money: 10, text: '💸 charged twice', blocked: '🔑 duplicate ignored', at: 'psp', firstText: '…', score: 10 },
    timeout:   { type: 'checkout', fix: 'queue', card: 'timeout', rep: 1, text: '⏳ sale lost', at: 'psp', firstText: '…', score: 5 },
    race:      { type: 'checkout', fix: 'lock', card: 'race', rep: 5, money: 25, text: '🏁 oversold', blocked: '🔒 sold out', at: 'db', firstText: '…', startText: '…', score: 15 },
    outage:    { node: 'notify', label: 'Notification service', card: 'notify', rep: 1.5, startText: '…', lostText: '…', event: { to: 'notify', via: 'queue', type: 'notif' }, score: 2 },
    spike:     { card: 'spike' },
    overload:  { node: 'db', card: 'dbload', after: 3 },
  },

  questions: [ { q: 'Short question?', a: 'Short answer.', good: true }, … 7-8 total, ≥5 good, 1 over-engineering trap with flag, 1 irrelevant ],
  cards: { id: { icon, title, text, fix?, opts: [{ t, good, why } ×3] } },   // exactly one good option; `fix` hints the shop item
  puzzles: {
    flow:   { kind: 'order', icon, title, text, items: ['step 1', 'step 2', …], signal, flag },     // items in correct order
    fields: { kind: 'pick', icon, title, text, pick: 3, items: [{ t, good, why? }], signal, flag },
    routing:{ kind: 'sort', icon, title, text, buckets: ['📚 A', '🐘 B'], items: [{ t, a: 0, why? }], signal, flag },
  },
  breaks: { 1: ['flow', 'fields', 'card'], 2: [ … ], 3: [ … ] }, // shown BEFORE phase index N; 2-3 items each
  finals: ['final', 'reverse'],                                   // closing cards

  report: { // interviewer debrief rules
    required:  [{ item, flag, unlessAnswer? }],                // red flag if never built
    proactive: [{ item, before: '<symptom key>', signal }],     // signal if built before the problem
    combos:    [{ items: [...], signal }],
    counters:  [{ counter: 'duplicate'|'race'|'timeout'|'lost'|'scaleFirst', min, flag: '… {n}× …' }],
    scaleFirst: { item: 'instance', fixes: [['type:image', 'cdn']], flag, signal },
    noTraps: 'signal text when no trap was bought',
  },
  followups: [ // interviewer "ask next" questions, highest priority first. 3 are picked by weak spot + 1 always.
    { q: '…?', when: { missing: 'item', wrong: ['cardOrPuzzleId'], counter: ['race', 1], first: 'conn', unless: 'item', traps: true } },
    { q: 'Closing question?', when: { always: true } },
  ],
};
```

### Models

`db, cyl, external (dashed third-party box), bell, box, cloud, octa, ring, key, tube (queue), lock, wheel (big spinning, for k8s-like traps), cluster (8 small boxes), shards, gear (spins), shield, hourglass, phone, pin, screen, globe (spins), stack, sphere, cone, tower, funnel, film, counter`. Nodes may also use `users` and `servers`.

### Balance targets (`node tools/balance.mjs <file> 150`)

| bot | meaning | target |
| --- | --- | --- |
| expert | perfect answers, buys fixes on time | ≥ 90% S |
| human | 85% right, reacts ~3s late, never proactive | mostly S/A (≥ 80% S+A), few B |
| average | 70% right, follows glowing hints | mostly A/B |
| overeng | buys traps when affordable | mostly C/D/F |
| scaler | only buys capacity | F or D |
| idle | buys nothing | F |

Money should feel tight in the middle phase (you can't buy every fix at once) but a good player should end with surplus. If expert isn't S, the scenario is too hard or the bot can't find the fix (check the `symptom` keys). If average gets S, the pressure is too low.
