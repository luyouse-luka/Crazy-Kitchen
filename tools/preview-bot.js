// In-preview autoplay judge: paste into the preview page (offscreen BrowserWindow, see ROADMAP 第十五轮), then
// window.__bot.run(withDeliveries). Drives StationView through real tap pulses and capture zones, teleporting between stations.
// Poll window.__bot.{done,err,log}; a thrown error names the step and sv.lastBlock.
(() => {
const ING = ['bun','patty','cheese','lettuce','tomato','onion','pickle','bacon'];
const B = window.__bot = { log: [], done: false, err: null, taps: 0 };
const sv = cc.find('Canvas').getComponent('StationView');
const K = () => sv.kitchen;
const S = kind => K().cfg.stations.find(s => s.kind === kind);
let pending = null;
cc.director.on(cc.Director.EVENT_BEFORE_UPDATE, () => { if (pending) { const f = pending; pending = null; f(); } });
const frame = () => new Promise(r => cc.director.once(cc.Director.EVENT_AFTER_UPDATE, r));
const frames = async n => { for (let i = 0; i < n; i++) await frame(); };
const guard = () => { if (sv.shift.t > 900) throw new Error('day never closed'); };
const at = async s => { sv.movement.pos.x = s.pos.x; sv.movement.pos.z = s.pos.z; await frames(6); guard(); };
const pulse = async fn => { pending = fn; await frame(); await frame(); B.taps++; };
const tap = async kind => { await at(S(kind)); await pulse(() => { sv.router.action.tapped = true; }); };
const zoneTap = async id => { await frame(); if (!sv.router.zone(id)) throw new Error('no zone ' + id); await pulse(() => { sv.router.zone(id).tapped = true; }); };
const expectCarry = (k, what) => { if (K().carry.kind !== k) throw new Error(`${what}: carry=${K().carry.kind} lastBlock=${sv.lastBlock}`); };
async function fetch(ing) {
  const i = ING.indexOf(ing);
  if (K().stock[i] <= 0) {
    await tap('storeroom'); await zoneTap('slot' + i); expectCarry('crate', 'crate ' + ing);
    await tap('fridge'); expectCarry('none', 'restock ' + ing);
  }
  await tap('fridge'); await zoneTap('slot' + i);
  if (sv.panelOpen) await zoneTap('panel-outside');
  expectCarry(ing === 'patty' ? 'patty' : 'ingredient', 'take ' + ing);
}
async function washStep() {
  const k = K();
  if (k.rack.ready > 0) { await tap('rack'); expectCarry('stack', 'take-stack'); await tap('shelf'); expectCarry('none', 'shelve'); return true; }
  if (k.sink.stage === 'soaked' && k.rack.count === 0) {
    await at(S('sink'));
    while (K().sink.stage === 'soaked') { sv.router.action.holding = true; await frame(); guard(); }
    sv.router.action.holding = false; await frames(2); return true;
  }
  if (k.sink.stage === 'empty' && k.dirty > 0) { await tap('sink'); return true; }
  return false;
}
const need = { rare: 'rareAt', medium: 'mediumAt', well: 'wellAt' };
async function cook(spec) {
  const n = spec.double ? 2 : 1;
  while (K().plates < n) if (!(await washStep())) await frames(10);
  for (let i = 0; i < n; i++) { await fetch('patty'); await tap('grill'); expectCarry('none', 'place-patty'); }
  const slots = K().grill.map((g, i) => (g.busy ? i : -1)).filter(i => i >= 0);
  while (slots.some(i => K().grill[i].elapsed < K().cfg.cook[need[spec.doneness]])) { await frame(); guard(); }
  for (let i = 0; i < n; i++) { await tap('grill'); expectCarry('patty', 'take-patty'); await tap('assembly'); expectCarry('none', 'patty on bench'); }
  for (const ing of ['bun', ...spec.required.filter(i => i !== 'bun' && i !== 'patty')]) { await fetch(ing); await tap('assembly'); expectCarry('none', 'add ' + ing); }
  await tap('assembly'); expectCarry('plate', 'pick-plate');
}
function urgent() { let b = null; for (const c of sv.shift.flow.customers) if (c.active && c.ordered && !c.burgerVerdict && (!b || c.patienceLeft < b.patienceLeft)) b = c; return b; }
/** Burger already handed over, fries still due (shop fryer): fry a basket and bring it */
async function fries() {
  await tap('fryer');
  while (K().fryer.stage !== 'ready') { await frame(); guard(); }
  await tap('fryer'); expectCarry('fries', 'take-fries');
  await tap('serve'); expectCarry('none', 'serve fries');
  B.fries = (B.fries || 0) + 1;
}
/** Same for a drink (shop drink machine) */
async function drink() {
  await tap('drinks');
  while (K().drinks.stage !== 'ready') { await frame(); guard(); }
  await tap('drinks'); expectCarry('drink', 'take-drink');
  await tap('serve'); expectCarry('none', 'serve drink');
  B.drinks = (B.drinks || 0) + 1;
}
B.run = async (withDeliveries) => {
  try {
    const walkIn = sv.shift.flow.flow.takeOrder.walkInSec;
    if (sv.phase !== 'open') { await tap('register'); await zoneTap('row0'); if (sv.phase !== 'open') throw new Error('shop did not open'); }
    while (!sv.resultOpen) {
      guard();
      if (sv.shift.flow.customers.some(c => c.active && !c.ordered && c.orderWait >= walkIn)) { await tap('register'); B.log.push('orders@' + sv.shift.t.toFixed(0)); continue; }
      const c = urgent();
      if (c) {
        await cook(c.spec); await tap('serve'); expectCarry('none', 'serve'); B.log.push('served@' + sv.shift.t.toFixed(0));
        if (c.active && c.friesDue) { await fries(); B.log.push('fries@' + sv.shift.t.toFixed(0)); }
        if (c.active && c.drinkDue) { await drink(); B.log.push('drink@' + sv.shift.t.toFixed(0)); }
        continue;
      }
      const offer = sv.desk.slots.find(d => d.status === 'offer');
      if (withDeliveries && offer && !sv.desk.slots.some(d => d.status === 'accepted')) {
        await tap('register');
        const i = sv.offerRows.findIndex(d => d && d.status === 'offer');
        if (i >= 0) await zoneTap('accept' + i);
        if (sv.reviewsOpen) await zoneTap('reviews-outside');
        B.log.push('accepted@' + sv.shift.t.toFixed(0)); continue;
      }
      const job = sv.desk.slots.find(d => d.status === 'accepted');
      if (job) { await cook(job.spec); await tap('delivery'); expectCarry('none', 'deliver'); B.log.push('delivered@' + sv.shift.t.toFixed(0)); continue; }
      if (!(await washStep())) await frames(10);
    }
  } catch (e) { B.err = String(e && e.stack || e); }
  B.done = true;
};
})();
