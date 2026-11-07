# Marketplace Rush

A 3D system-design interview game (Three.js), based on the "Backend Engineer · System Design Interview" guide. The candidate keeps a marketplace backend alive from MVP to Black Friday. Along the way they answer the guide's questions at the moment each problem actually happens, and solve quick whiteboard puzzles between phases.

## Run

```bash
python3 -m http.server 5199
# open http://localhost:5199
```

It needs internet access for Three.js (unpkg) and the fonts. There is no build step.

## How a session goes (~10 min)

1. **Brief + clarifying questions.** The guide's prompt, then pick 3 questions. Good ones add budget; skipping questions or asking about Kafka/K8s is a red flag.
2. **Four phases:** MVP → Growth → Scale → Black Friday. Colored requests flow from users through the API to the DB, payments and notifications. Buy parts from the bottom bar or by clicking the dashed slots on the board.
3. **Incidents** fire when the problem shows up: images through the API, slow `/search`, double charge, too many DB connections, DB at 100%, notifications down, notification spike, payment timeout, last item in stock.
4. **Whiteboard breaks** between phases: the happy path (ordering), the `POST /checkout` contract, a mock endpoint for the frontend, domain boundaries, a Flutter contract change, splitting the monolith, the cart model, replica vs. primary reads, and the order-history index.
5. **Closing questions:** an MVP with 3 people, and the hardest decision to reverse.
6. **Debrief for the interviewer:** grade, uptime/judgement/revenue/reputation, a snapshot of the final architecture, signals and red flags (including proactive vs. reactive), **Ask next** (follow-up questions from the guide chosen by the candidate's weak spots), a full timeline, and **Copy summary** for the scorecard.

Controls: drag to look around, `Space` to pause, `M` to mute.

## Coverage of the guide

| Guide section | In the game |
| --- | --- |
| Clarifying questions | Opening question picker (users, payments, notifications, cart, consistency, multi-tenancy) |
| 1. Start / happy path | Happy-path ordering puzzle |
| 1.1 API design | Checkout contract, response shape, mock for the frontend, Flutter field rename |
| 2. Initial architecture | Monolith vs. microservices, domain boundaries, splitting later; microservices/K8s/sharding traps |
| 3. Database | Cart model, order-history index, 40-connection limit + PgBouncer, replica routing, DB overload |
| 4. Payments & idempotency | Double click, redelivery, provider timeout and reconciliation |
| 5. Notifications | Outage (queue vs. direct calls), Black Friday spike |
| 6. Scalability | Search index, CDN for images, last-item race |
| 7. Trade-offs | MVP with 3 people, hardest decision to reverse |
| Signals / red flags | Scored and listed in the debrief |

## Code

- `src/content.js`: all copy and data (questions, incidents, puzzles, follow-ups, shop, phases)
- `src/sim.js`: pure simulation (no DOM). Economy, traffic, incidents, scoring and the interviewer report.
- `src/main.js`: Three.js scene and UI
- `tools/balance.mjs`: headless bot that plays the real sim with several strategies

```bash
node tools/balance.mjs 200          # all strategies
FLAGS=1 node tools/balance.mjs 200  # include most common red flags
```

Current balance (200 runs each):

| Strategy | Result |
| --- | --- |
| expert | S |
| strong human (reacts late, 85% right) | S/A |
| average (70% right, follows hints) | A/B |
| over-engineer | C/D, sometimes runs out of money |
| scale-only / idle | F (site goes down) |
