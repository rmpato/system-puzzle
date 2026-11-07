// Static checks for a scenario file. Usage: node tools/validate.mjs [scenario-file-or-id ...]
// With no args, validates every registered scenario.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { MODEL_KINDS } from '../src/engine/model-kinds.js';

const args = process.argv.slice(2);
let list;
if (args.length) {
  list = [];
  for (const a of args) {
    if (a.endsWith('.js')) list.push((await import(pathToFileURL(resolve(a)).href)).default);
    else list.push((await import('../src/scenarios/index.js')).byId(a));
  }
} else list = (await import('../src/scenarios/index.js')).SCENARIOS;

const HAZARDS = ['duplicate', 'timeout', 'race', 'outage', 'spike', 'overload'];
let failed = false;
for (const sc of list) {
  const errs = [], warns = [];
  const e = (m) => errs.push(m), w = (m) => warns.push(m);
  const req = ['id', 'title', 'icon', 'pitch', 'difficulty', 'brief', 'pools', 'nodes', 'shop', 'wires', 'types', 'phases', 'questions', 'cards', 'report', 'followups'];
  for (const k of req) if (sc[k] === undefined) e(`missing "${k}"`);
  const nodeIds = new Set((sc.nodes || []).map((n) => n.id));
  const itemIds = new Set((sc.shop || []).map((s) => s.id));
  const place = new Set([...nodeIds, ...itemIds]);
  const cards = sc.cards || {}, puzzles = sc.puzzles || {};
  if (!['Easy', 'Medium', 'Hard', 'Expert'].includes(sc.difficulty)) e(`difficulty must be Easy|Medium|Hard|Expert`);
  // pools
  for (const [p, P] of Object.entries(sc.pools || {})) {
    if (!nodeIds.has(P.node)) e(`pool ${p}: node "${P.node}" not in nodes`);
    for (const id of Object.keys(P.per || {})) if (!itemIds.has(id)) e(`pool ${p}: per item "${id}" not in shop`);
    if (P.fallback && !sc.pools[P.fallback]) e(`pool ${p}: fallback "${P.fallback}" unknown`);
  }
  const C = sc.connections;
  if (C) {
    if (!sc.pools[C.pool]) e(`connections.pool "${C.pool}" unknown`);
    if (!itemIds.has(C.fix)) e(`connections.fix "${C.fix}" not in shop`);
    if (!cards[C.card]) e(`connections.card "${C.card}" not in cards`);
    for (const id of Object.keys(C.per || {})) if (!itemIds.has(id)) e(`connections.per "${id}" not in shop`);
  }
  // nodes
  const users = (sc.nodes || []).filter((n) => n.model === 'users');
  if (users.length !== 1) e('exactly one node must have model "users"');
  for (const n of sc.nodes || []) {
    if (!['users', 'servers', ...MODEL_KINDS].includes(n.model)) e(`node ${n.id}: unknown model "${n.model}"`);
    if (n.model === 'servers' && !itemIds.has(n.item)) e(`node ${n.id}: servers node needs item that exists in shop`);
    if (!Array.isArray(n.pos) || n.pos.length !== 2) e(`node ${n.id}: pos must be [x, z]`);
  }
  // shop
  const servers = (sc.nodes || []).find((n) => n.model === 'servers');
  for (const s of sc.shop || []) {
    for (const k of ['id', 'icon', 'name', 'cost', 'desc']) if (s[k] === undefined) e(`shop ${s.id}: missing ${k}`);
    const isServer = servers && servers.item === s.id;
    if (!isServer && !s.pos && !s.slots) e(`shop ${s.id}: needs pos or slots`);
    if (!isServer && s.model && !MODEL_KINDS.includes(s.model)) e(`shop ${s.id}: unknown model "${s.model}"`);
    if (s.slots && (s.max || 1) > s.slots.length) e(`shop ${s.id}: max ${s.max} but only ${s.slots.length} slots`);
    if (s.scales && !sc.pools[s.scales]) e(`shop ${s.id}: scales unknown pool "${s.scales}"`);
    if (s.relieves && !sc.pools[s.relieves]) e(`shop ${s.id}: relieves unknown pool "${s.relieves}"`);
    for (const sym of [].concat(s.symptom || [])) if (!/^(type:|hazard:|hot:)/.test(sym) && !['outage', 'conn', 'lost', 'raceStart'].includes(sym)) e(`shop ${s.id}: bad symptom "${sym}"`);
    for (const sym of [].concat(s.symptom || [])) if (sym.startsWith('type:') && !sc.types?.[sym.slice(5)]) e(`shop ${s.id}: symptom type "${sym}" unknown`);
    if (!s.trap && !s.scales && !s.fixesConn && !s.symptom && !isServer) w(`shop ${s.id}: no bot role (scales/symptom/fixesConn/trap); bots will never buy it`);
    if (s.name.length > 13) w(`shop ${s.id}: name "${s.name}" may truncate (keep ≤ 13 chars)`);
  }
  // slots spacing
  const spots = [...(sc.nodes || []).map((n) => [n.id, n.pos]), ...(sc.shop || []).flatMap((s) => (s.slots || (s.pos ? [s.pos] : [])).map((p) => [s.id, p]))];
  for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
    const [a, pa] = spots[i], [b, pb] = spots[j];
    if (a === b) continue;
    const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    if (d < 3 && !(sc.shop.find((s) => s.id === a)?.trap || sc.shop.find((s) => s.id === b)?.trap)) w(`${a} and ${b} are only ${d.toFixed(1)} apart (labels may overlap)`);
  }
  for (const [, p] of spots) if (Math.abs(p[0]) > 19 || p[1] < -11 || p[1] > 13) w(`position ${JSON.stringify(p)} is near the edge of the board view`);
  // wires
  for (const [a, b, o = {}] of sc.wires || []) {
    if (!place.has(a)) e(`wire ${a}→${b}: "${a}" unknown`);
    if (!place.has(b)) e(`wire ${a}→${b}: "${b}" unknown`);
    if (o.if && !itemIds.has(o.if)) e(`wire ${a}→${b}: if "${o.if}" unknown`);
    if (o.unless && !itemIds.has(o.unless)) e(`wire ${a}→${b}: unless "${o.unless}" unknown`);
  }
  // types
  for (const [t, D] of Object.entries(sc.types || {})) {
    if (!D.color || !D.name) e(`type ${t}: needs name and color`);
    if (!D.steps?.length) e(`type ${t}: needs steps`);
    for (const st of D.steps || []) {
      if (!sc.pools[st.pool]) e(`type ${t}: step pool "${st.pool}" unknown`);
      for (const id of Object.keys(st.mods || {})) if (!itemIds.has(id)) e(`type ${t}: mod item "${id}" unknown`);
      for (const v of st.via || []) { if (!itemIds.has(v.item)) e(`type ${t}: via item "${v.item}" unknown`); if (v.node && !place.has(v.node)) e(`type ${t}: via node "${v.node}" unknown`); }
    }
    if (D.bypass && (!itemIds.has(D.bypass.item) || !place.has(D.bypass.node))) e(`type ${t}: bypass item/node unknown`);
    for (const h of D.hops || []) { if (!place.has(h.node)) e(`type ${t}: hop node "${h.node}" unknown`); if (h.if && !itemIds.has(h.if)) e(`type ${t}: hop if "${h.if}" unknown`); }
    for (const k of ['cardOnSeen', 'cardOnFail']) if (D[k] && !cards[D[k]]) e(`type ${t}: ${k} "${D[k]}" not in cards`);
    if (D.event) {
      if (!place.has(D.event.to)) e(`type ${t}: event.to "${D.event.to}" unknown`);
      if (D.event.via && !itemIds.has(D.event.via)) e(`type ${t}: event.via "${D.event.via}" unknown`);
      if (D.event.type && !sc.events?.[D.event.type]) e(`type ${t}: event.type "${D.event.type}" not in events`);
    }
    if (D.cashAt && !place.has(D.cashAt)) e(`type ${t}: cashAt unknown`);
  }
  // phases & hazards
  const HZ = sc.hazards || {};
  for (const k of Object.keys(HZ)) if (!HAZARDS.includes(k)) e(`hazards.${k}: unsupported (use ${HAZARDS.join(', ')})`);
  for (const [k, h] of Object.entries(HZ)) {
    if (h.card && !cards[h.card]) e(`hazards.${k}.card "${h.card}" not in cards`);
    if (h.fix && !itemIds.has(h.fix)) e(`hazards.${k}.fix "${h.fix}" not in shop`);
    if (h.type && !sc.types[h.type]) e(`hazards.${k}.type "${h.type}" unknown`);
    if (['duplicate', 'race', 'timeout'].includes(k) && h.type && !sc.types[h.type].value) e(`hazards.${k}: type "${h.type}" must have a value (only value requests carry hazards)`);
    if (h.at && !place.has(h.at)) e(`hazards.${k}.at "${h.at}" unknown`);
    if (h.node && !place.has(h.node)) e(`hazards.${k}.node "${h.node}" unknown`);
  }
  if (HZ.outage && HZ.outage.event?.via && !itemIds.has(HZ.outage.event.via)) e('hazards.outage.event.via unknown');
  let total = 0;
  (sc.phases || []).forEach((P, i) => {
    total += P.dur;
    for (const t of Object.keys(P.rates || {})) if (!sc.types[t]) e(`phase ${i}: rate for unknown type "${t}"`);
    for (const k of Object.keys(P.hazards || {})) { if (!HAZARDS.includes(k)) e(`phase ${i}: unknown hazard "${k}"`); else if (!HZ[k]) e(`phase ${i}: uses hazard "${k}" but hazards.${k} is not defined`); }
    for (const n of P.news || []) if (!sc.types[n] && n.length > 22) w(`phase ${i}: news "${n}" is long`);
  });
  if ((sc.phases || []).length < 3) w('fewer than 3 phases');
  if (total < 150 || total > 260) w(`total play time ${total}s (aim for 170-230s)`);
  // copy
  if ((sc.questions || []).filter((q) => q.good).length < 4) e('need at least 4 good clarifying questions');
  for (const [id, c] of Object.entries(cards)) {
    if (!c.icon || !c.title || !c.text || !c.opts) e(`card ${id}: needs icon, title, text, opts`);
    if ((c.opts || []).filter((o) => o.good).length !== 1) e(`card ${id}: exactly one good option`);
    for (const o of c.opts || []) { if (!o.why) e(`card ${id}: option "${o.t}" missing why`); if (o.t.length > 48) w(`card ${id}: option "${o.t}" is long (${o.t.length} chars)`); }
    if (c.fix && !itemIds.has(c.fix)) e(`card ${id}: fix "${c.fix}" not in shop`);
  }
  for (const [id, p] of Object.entries(puzzles)) {
    if (!['order', 'pick', 'sort'].includes(p.kind)) e(`puzzle ${id}: kind must be order|pick|sort`);
    if (!p.signal || !p.flag) e(`puzzle ${id}: needs signal and flag`);
    if (p.kind === 'pick' && p.items.filter((i) => i.good).length !== p.pick) e(`puzzle ${id}: pick=${p.pick} but ${p.items.filter((i) => i.good).length} good items`);
    if (p.kind === 'sort') for (const it of p.items) if (it.a === undefined || it.a >= p.buckets.length) e(`puzzle ${id}: item "${it.t}" bucket out of range`);
  }
  for (const [ph, ids] of Object.entries(sc.breaks || {})) {
    if (!(+ph > 0 && +ph < sc.phases.length)) e(`breaks key ${ph} must be a phase index 1..${sc.phases.length - 1}`);
    for (const id of ids) if (!cards[id] && !puzzles[id]) e(`breaks[${ph}]: "${id}" not a card or puzzle`);
  }
  for (const id of sc.finals || []) if (!cards[id] && !puzzles[id]) e(`finals: "${id}" unknown`);
  if (sc.startCard && !cards[sc.startCard]) e(`startCard "${sc.startCard}" not in cards`);
  if (HZ.overload && !nodeIds.has(HZ.overload.node)) e('hazards.overload.node unknown');
  // report
  const R = sc.report || {};
  for (const q of R.required || []) if (!itemIds.has(q.item)) e(`report.required item "${q.item}" unknown`);
  for (const q of R.proactive || []) if (!itemIds.has(q.item)) e(`report.proactive item "${q.item}" unknown`);
  for (const q of R.combos || []) for (const i of q.items) if (!itemIds.has(i)) e(`report.combos item "${i}" unknown`);
  if (R.scaleFirst) { if (!itemIds.has(R.scaleFirst.item)) e('report.scaleFirst.item unknown'); for (const [, f] of R.scaleFirst.fixes) if (!itemIds.has(f)) e(`report.scaleFirst fix "${f}" unknown`); }
  for (const q of R.counters || []) if (!['duplicate', 'race', 'timeout', 'lost', 'scaleFirst'].includes(q.counter)) e(`report.counters "${q.counter}" unknown`);
  for (const f of sc.followups || []) {
    const wn = f.when || {};
    if (wn.missing && !itemIds.has(wn.missing)) e(`followup "${f.q.slice(0, 30)}": missing "${wn.missing}" unknown`);
    for (const id of wn.wrong || []) if (!cards[id] && !puzzles[id]) e(`followup "${f.q.slice(0, 30)}": wrong "${id}" unknown`);
  }
  if (!(sc.followups || []).some((f) => f.when?.always)) w('no always-asked closing follow-up');

  console.log(`${errs.length ? '✗' : '✓'} ${sc.id}: ${errs.length} errors, ${warns.length} warnings`);
  errs.forEach((m) => console.log('   ERROR', m));
  warns.forEach((m) => console.log('   warn ', m));
  if (errs.length) failed = true;
}
process.exit(failed ? 1 : 0);
