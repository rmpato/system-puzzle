# System Puzzle

System-design interview practice as a 3D whiteboard game (Three.js). Pick an exercise, ask clarifying questions, build the architecture piece by piece while live traffic flows through it, fix incidents as they happen, solve whiteboard puzzles between phases, and get an interview debrief at the end.

## Run

```bash
python3 -m http.server 5199
# open http://localhost:5199
```

No build step. It needs internet access for Three.js (unpkg) and the fonts. Desktop browser.

## Exercises

| Exercise | Difficulty | Core lessons |
| --- | --- | --- |
| 🔗 Tiny Links (URL shortener) | Easy | Read-heavy caching, ID generation, unique aliases, async click analytics, CDN for viral links |
| ⌨️ Type Ahead (search autocomplete) | Medium | Debouncing, in-memory top-k trie, edge caching, offline log pipeline, trending terms |
| 🛒 Marketplace Rush | Medium | Idempotent payments, connection pooling, read replicas, queues, reconciliation, stock races (from the Backend Engineer interview guide) |
| 🎬 Video Night (YouTube-lite) | Medium | CDN playback, pre-signed uploads, async transcoding, batched view counters |
| 💬 Chat at Scale (WhatsApp-like) | Hard | WebSockets vs polling, idempotent sends, ordering, presence in memory, offline push |
| 📰 Social Feed (Twitter/Instagram) | Hard | Fan-out on write vs read, celebrity hot keys, timeline cache, batched like counters |
| 🎟️ Ticket Drop (Ticketmaster) | Hard | Waiting room, seat holds with TTL, bot defense, payment reconciliation |
| 🚕 Ride Hail (Uber-like) | Expert | Geo index for location pings, atomic dispatch, ETA caching, surge |
| 💳 Money Moves (payments ledger) | Expert | Idempotency keys, double-entry ledger, row locks, reconciliation, transactional outbox |

Every exercise ends with a real traffic surge (a viral link, a doorbuster, midnight on New Year's Eve, a concert letting out in the rain…).

## Modes

- **🎓 Practice:** each answer is explained right away, and the shop glows toward the fix for the current incident.

**Budget:** you start with $200; good clarifying questions add $25, correct cards $40. A fix you named correctly on a card is half price and can be bought on credit (budget goes negative and refills from revenue), so knowing the answer is never blocked by money. Unaffordable parts show ⏱ seconds until affordable.
- **🧑‍⚖️ Interview:** for running it with a candidate. No hints, and answers are recorded but not revealed. The debrief has the full answer review.

## A session (~8–10 min)

1. **Brief + 3 clarifying questions.** Good ones add budget; skipping questions or over-engineering questions are red flags.
2. **3–4 phases of traffic.** Colored requests flow through the board. Buy parts from the bottom bar (or keys `1`–`9`, or click the dashed slots). Overloaded parts turn red. Traps (Kubernetes, microservices, sharding too early…) cost upkeep.
3. **Incidents** fire when the problem actually happens: duplicates, races, outages, timeouts, hot databases, connection limits.
4. **Whiteboard breaks** between phases: order, pick and sort puzzles plus single-choice cards.
5. **Debrief:** grade, uptime, judgement, revenue, reputation, a timelapse of how the architecture evolved, signals and red flags (proactive vs reactive), **Ask next** follow-ups for the interviewer, the answer review, a timeline, and **Copy summary**.

Controls: drag to look around · click any part to inspect it · `Space` pause · `M` mute · `1`–`9` buy · `1×/2×` speed.

## Learn

**📚 Learn the basics** (on the picker, or the 📚 button in-game, which pauses) is a library of 26 short primers on the concepts behind the exercises: the interview loop, estimation, latency numbers, caching, CDNs, replicas, pooling, sharding, queues, the outbox, fan-out, idempotency, races, reconciliation, delivery guarantees, WebSockets, geo indexing and more. Each one has a before/after flow sketch, when to use it, what goes wrong, rules of thumb, a line to say in the interview, and the exercises where you practice it.

It is also linked in context: after you answer a card (Practice mode), from the part inspector, and in the debrief under **Concepts to review** (from wrong answers, missing parts and traps). Content lives in `src/learn.js`; a card can point to a concept with `learn: '<id>'`.

## Google Cloud icons

Every part is shown with the Google Cloud product you would use for it (Compute Engine, Cloud SQL, Memorystore, Pub/Sub, Cloud CDN, Cloud Armor, Spanner, GKE…). Design patterns that aren't products (idempotency keys, locks, sequence numbers) keep an emoji. The shop is grouped Compute · Data · Cache · Async · Edge · AI · Patterns, clicking a part opens an inspector (product, load, capacity, failures), and the debrief draws your **final architecture** as a GCP-style diagram you can download as a standalone SVG.

Icons are the official set from [cloud.google.com/icons](https://cloud.google.com/icons), stored in `assets/gcp/`. Mapping lives in `src/gcp.js`; a scenario item or node can override it with `gcp: '<icon>'` (or `gcp: null`) and `cat: '<section>'`.

## Project layout

```
index.html              styles + shell
src/main.js             renderer and UI (data-driven, no scenario specifics)
src/engine/sim.js       pure simulation: pools, requests, hazards, scoring, interviewer report
src/engine/models.js    whiteboard-style 3D model library
src/gcp.js              part → Google Cloud product icon + shop section
src/learn.js            concept primers for the Learn library
assets/gcp/             official Google Cloud product icons (SVG)
src/scenarios/*.js      one file per exercise (+ *-copy.js for its questions and puzzles)
src/scenarios/index.js  registry (picker order)
tools/validate.mjs      schema and layout checks
tools/balance.mjs       headless bot: 6 strategies × N runs per scenario
SCENARIOS.md            how to write a new exercise
```

```bash
node tools/validate.mjs                 # all scenarios
node tools/balance.mjs all 150          # balance report for every scenario
node tools/balance.mjs rides 150        # one scenario
# QA: open http://localhost:5199/?debug#<id> to get window.__sim in the console
FLAGS=1 node tools/balance.mjs src/scenarios/my-new.js 150
```

## Adding an exercise

See [SCENARIOS.md](SCENARIOS.md). In short: write `src/scenarios/<id>.js`, get `validate` to 0 errors and `balance` to its targets (expert ≈ always S, scale-only and idle fail), then register it in `src/scenarios/index.js`.
