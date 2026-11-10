# Under Load

System-design interview practice as a 3D whiteboard game (Three.js). Pick an exercise, ask clarifying questions, build the architecture piece by piece while live traffic flows through it, fix incidents as they happen, solve whiteboard puzzles between phases, and get an interview debrief at the end.

## Run

A [Bun](https://bun.sh) app.

```bash
bun install
bun run dev        # http://localhost:5199, hot reload (PORT=… to change)
bun start          # same server in production mode
bun run build      # static site in dist/ (any static host)
```

Three.js comes from npm and is bundled by Bun; only the fonts load from the internet. Desktop browser.

### URLs

Every screen has its own address, so you can bookmark it, share it, reload it, open it in a new tab and use back/forward:

| URL | Screen |
| --- | --- |
| `/` | the exercise picker |
| `/play/<id>` | an exercise, e.g. `/play/url-shortener` (reloading restarts it) |
| `/guide` | field guide contents |
| `/guide/<concept>` | one primer, e.g. `/guide/caching` |

`server.ts` serves the app at each route and imports the same scenario and primer registries as the client, so an unknown exercise or primer gets a real 404. Opening the guide from inside a game pauses it and moves to `/guide/…`; going back returns to the game where you left it. Old `/#<id>` links redirect to `/play/<id>`. The static build writes `dist/404.html` as a fallback so deep links also work on static hosts.

## Design

The visual identity is the **whiteboard**, because that is where a system design interview happens. A near-white board, black marker for structure, and only the marker colors that carry meaning in the game: **blue** is your design and the live requests, **green** is healthy, **red** is failing, and amber marks traps. Type is one family, IBM Plex Sans (with Plex Mono for numbers and labels), plus Architects Daughter used only for the interviewer's voice: the prompt, their replies and notes on the board.

The home page is the exercise picker: the nine prompts on the left (↑/↓ and Enter work) and, on the right, the selected prompt on a live **stage** (`src/stage.js`). The stage draws the exercise's *starting* system from its board layout and runs the exercise's real traffic through it in a ~16 s loop: requests are dots in their type's color, each part shows its load (rate × step cost ÷ capacity, the same arithmetic as the sim), parts past 100% turn red and drop requests, and a playhead moves along a timeline of the phases with the surge marked. A one-line verdict says when the starting system falls over ("phase 2, Growth: API at 160%"). Motion respects `prefers-reduced-motion` (a still frame at the worst moment).

The 3D board is a lit tabletop diorama of the same whiteboard: soft ceramic pieces with ink outlines, all tints harmonized from the scenario colors (`soften()` in `src/engine/models.js`), studio environment light with neutral tone mapping, contact shadows, a load ring drawn on the floor around every working part (fills green → amber → red, pulses past capacity), flat ink wires with dashes flowing toward the target, requests with a halo in their own color, and pieces that assemble one by one when the board loads.

The field guide opens on your progress map (every primer is a square, one row per chapter) and each chapter as cards with a tiny board of the primer's "after" flow. A primer is one reading column with a sticky "On this page" rail: the before/after board, trade-offs, rules of thumb, the sentence to say (as a speech bubble), a check, and the exercises that practice it.

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

- **🎓 Practice:** each answer is explained right away, and the shop glows toward the fix for the current incident. When a part is overloaded, it suggests the cheapest real fix: something that removes load (cache, CDN, rate limiter) before more servers.

**Budget:** you start with $200; good clarifying questions add $25, correct cards $40. A fix you named correctly on a card is half price and can be bought on credit (budget goes negative and refills from revenue), so knowing the answer is never blocked by money. Unaffordable parts show ⏱ seconds until affordable.
- **🧑‍⚖️ Interview:** for running it with a candidate. No hints, and answers are recorded but not revealed. The debrief has the full answer review.

## A session (~8–10 min)

1. **Brief, 3 clarifying questions, then one design question.** Good questions add budget; skipping or over-engineering ones are red flags. The opening design question ("How do you make codes?") is asked *before* launch, so play never starts with an interruption, and a right answer makes that part half price from the first second.
2. **Design the first version, on an empty board.** Only your users and what's outside your system (payment providers, push gateways, maps) are on the board. You place the parts yourself from the **Your system** group of the parts bar: the API, the database, and whatever else the prompt needs (analytics, notifications, object storage, workers…). Core parts are free while designing; extras such as a cache cost budget as usual. A panel shows every request type and whether your design can carry it ("Create link: Users → API → ?"), so before any traffic you can see what your system handles. In interview mode the statuses are hidden and the candidate talks it through. Launching with gaps is allowed: those requests fail on the board, a forgotten part can be added later for $60, and the debrief notices ("Launched without Postgres", "Never built Analytics", or "Designed a complete first version"). Your first design is the first frame of the debrief's timelapse.
3. **3–4 phases of traffic.** Colored requests flow through the board. Buy parts from the bottom bar (or keys `1`–`9`, or click the dashed slots). Overloaded parts turn red. Traps (Kubernetes, microservices, sharding too early…) cost upkeep. Every purchase shows an **impact card** with what it changed.
4. **Live incidents never pause the game.** When something actually goes wrong (duplicates, races, outages, timeouts, a hot database, a connection limit) the board keeps running in slow motion while a panel docks beside it, on whichever side keeps the affected part in view. The part is ringed on the board, the panel shows what is happening to it right now ("Postgres at 140% · 6 requests/s failing", updated live), and once you answer it offers **Deploy the fix** in one click, so the answer becomes a change you can watch work. The next incident waits a couple of seconds so you can see the effect.
5. **Whiteboard breaks between phases** are the only time traffic stops: order, pick and sort puzzles plus single-choice cards, framed as "Launch done · next: Growth · question 1 of 3".
6. **Debrief:** grade, uptime, judgement, revenue, reputation, your final architecture next to a **strong design**, a timelapse of how it evolved, signals and red flags (proactive vs reactive), **Ask next** follow-ups for the interviewer, the answer review, a timeline, and **Copy summary**.

Reading the board: every part is labeled with its Google Cloud product and live load (%), every dashed square names the part you can buy there and its price, the legend names each request color, and red means failing. Controls: drag to look around · click any part to inspect it · `Space` pause · `M` mute · `1`–`9` buy · `1×/2×` speed.

## Learn

The **Field guide** (from the home page, or the book button in-game, which pauses) is a library of 29 short primers on the concepts behind the exercises: the interview loop, estimation, API and data model design, latency numbers, choosing a database, caching, CDNs, replicas, pooling, sharding, queues, the outbox, fan-out, idempotency, races, reconciliation, timeouts/retries/circuit breakers, delivery guarantees, WebSockets, geo indexing and more. Each one is a single reading column: the idea, a before/after flow sketch, when to use it and what to watch out for, rules of thumb, a line to say in the interview, a **Check yourself** question, and the exercises where you practice it. The contents page lists every primer by chapter with its first sentence and your progress, and offers the next unread one. Reading progress (read / checked) is kept per browser and shown in the contents and on the home page.

It is also linked in context: after you answer a card (Practice mode), from the part inspector, and in the debrief under **Concepts to review** (from wrong answers, missing parts and traps). Content lives in `src/learn.js`; a card can point to a concept with `learn: '<id>'`.

## Google Cloud icons

Every part is shown with the Google Cloud product you would use for it (Compute Engine, Cloud SQL, Memorystore, Pub/Sub, Cloud CDN, Cloud Armor, Spanner, GKE…). Design patterns that aren't products (idempotency keys, locks, sequence numbers) keep an emoji. The shop is grouped Compute · Data · Cache · Async · Edge · AI · Patterns, clicking a part opens an inspector (product, load, capacity, failures), and the debrief draws your **final architecture** as a GCP-style diagram you can download as a standalone SVG.

Icons are the official set from [cloud.google.com/icons](https://cloud.google.com/icons), stored in `assets/gcp/`. Mapping lives in `src/gcp.js`; a scenario item or node can override it with `gcp: '<icon>'` (or `gcp: null`) and `cat: '<section>'`.

## Project layout

```
server.ts               Bun server: routes, 404s, bundles index.html, serves assets/
tools/build.ts          static build to dist/
public/                 favicon
index.html              styles + shell
src/home.js             home: the exercise picker
src/main.js             renderer and UI (data-driven, no scenario specifics)
src/engine/sim.js       pure simulation: pools, requests, hazards, scoring, interviewer report
src/engine/models.js    whiteboard-style 3D model library
src/gcp.js              part → Google Cloud product icon + shop section
src/learn.js            concept primers for the field guide
assets/gcp/             official Google Cloud product icons (SVG)
src/scenarios/*.js      one file per exercise (+ *-copy.js for its questions and puzzles)
src/scenarios/index.js  registry (picker order)
tools/validate.mjs      schema and layout checks
tools/balance.mjs       headless bot: 6 strategies × N runs per scenario
SCENARIOS.md            how to write a new exercise
```

```bash
bun tools/validate.mjs                 # all scenarios
bun tools/balance.mjs all 150          # balance report for every scenario
bun tools/balance.mjs rides 150        # one scenario
# QA: open http://localhost:5199/?debug#<id> to get window.__sim in the console
FLAGS=1 bun tools/balance.mjs src/scenarios/my-new.js 150
```

## Adding an exercise

See [SCENARIOS.md](SCENARIOS.md). In short: write `src/scenarios/<id>.js`, get `validate` to 0 errors and `balance` to its targets (expert ≈ always S, scale-only and idle fail), then register it in `src/scenarios/index.js`.
