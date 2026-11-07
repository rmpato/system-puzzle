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
| 🛒 Marketplace Rush | Medium | Idempotent payments, connection pooling, read replicas, queues, stock races (from the Backend Engineer interview guide) |
| 🎬 Video Night (YouTube-lite) | Medium | CDN playback, pre-signed uploads, async transcoding, batched view counters |
| 💬 Chat at Scale (WhatsApp-like) | Hard | WebSockets vs polling, idempotent sends, ordering, presence in memory, offline push |
| 🎟️ Ticket Drop (Ticketmaster) | Hard | Waiting room, seat holds with TTL, bot defense, payment reconciliation |
| 🚕 Ride Hail (Uber-like) | Expert | Geo index for location pings, atomic dispatch, ETA caching, surge |

## Modes

- **🎓 Practice:** each answer is explained right away, and the shop glows toward the fix for the current incident.
- **🧑‍⚖️ Interview:** for running it with a candidate. No hints, and answers are recorded but not revealed. The debrief has the full answer review.

## A session (~8–10 min)

1. **Brief + 3 clarifying questions.** Good ones add budget; skipping questions or over-engineering questions are red flags.
2. **3–4 phases of traffic.** Colored requests flow through the board. Buy parts from the bottom bar (or keys `1`–`9`, or click the dashed slots). Overloaded parts turn red. Traps (Kubernetes, microservices, sharding too early…) cost upkeep.
3. **Incidents** fire when the problem actually happens: duplicates, races, outages, timeouts, hot databases, connection limits.
4. **Whiteboard breaks** between phases: order, pick and sort puzzles plus single-choice cards.
5. **Debrief:** grade, uptime, judgement, revenue, reputation, a timelapse of how the architecture evolved, signals and red flags (proactive vs reactive), **Ask next** follow-ups for the interviewer, the answer review, a timeline, and **Copy summary**.

Controls: drag to look around · `Space` pause · `M` mute · `1×/2×` speed.

## Project layout

```
index.html              styles + shell
src/main.js             renderer and UI (data-driven, no scenario specifics)
src/engine/sim.js       pure simulation: pools, requests, hazards, scoring, interviewer report
src/engine/models.js    whiteboard-style 3D model library
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
FLAGS=1 node tools/balance.mjs src/scenarios/my-new.js 150
```

## Adding an exercise

See [SCENARIOS.md](SCENARIOS.md). In short: write `src/scenarios/<id>.js`, get `validate` to 0 errors and `balance` to its targets (expert ≈ always S, scale-only and idle fail), then register it in `src/scenarios/index.js`.
