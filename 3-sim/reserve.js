/* reserve.js: shared water and game reserve, claiming and camping at a source, hunting and foraging. */

/* ---------- shared reserve: water sources and game, scaled by the number of contestants ---------- */
function make_reserve(n) {
  return {
    water: WATER_SOURCES.map((s) => {
      const max = Math.max(2, Math.round(s.per * n));
      return { ...s, max, stock: max, holder: null };
    }),
    game: ANIMALS.map((a) => {
      const max = Math.max(1, Math.round(a.per * n));
      return { ...a, max, pop: max };
    }),
    low_w: false,
    low_g: false,
  };
}

const water_left = () => RES.water.reduce((s, x) => s + x.stock, 0);

/* Takes up to x water from the sources (fullest first) and returns how much there really was. */
function take_water(x) {
  let got = 0;
  for (const s of [...RES.water].sort((a, b) => b.stock - a.stock)) {
    const d = Math.min(x - got, Math.floor(s.stock));
    s.stock -= d;
    got += d;
    if (got >= x) break;
  }
  return got;
}

/* ---------- control of water sources: claiming, camping, guarding ---------- */
const holder_of = (s) => (s.holder !== null && T[s.holder] && T[s.holder].alive ? T[s.holder] : null);
const is_ally = (a, b) => a === b || (a.g === b.g && group_size(a.g) > 1) || relationship_of(a, b) === "lover";

function take_from(s, x) {
  const d = Math.min(x, Math.floor(s.stock));
  s.stock -= d;
  return d;
}

/* Water this contestant may drink: sources nobody holds, or held by themselves or an ally. */
function take_allowed(t, x) {
  let got = 0;
  for (const s of [...RES.water].sort((a, b) => b.stock - a.stock)) {
    const h = holder_of(s);
    if (h && !is_ally(h, t)) continue;
    got += take_from(s, x - got);
    if (got >= x) break;
  }
  return got;
}

const guarded_text = (t) => {
  const s = RES.water.find((s) => s.stock >= 1 && holder_of(s) && !is_ally(holder_of(s), t));
  return s ? `${N(t)} finds the ${s.n} guarded by ${N(holder_of(s))} and keeps away.` : "";
};

/* Everything left is held by someone else. Only the desperate push their luck: talk, fight, or be turned away. */
function contest(t, h, s, L) {
  if (t.water > 2) return false;
  const rel = relationship_of(t, h);
  if (rel !== "enemy" && rel !== "rival" && chance(TALK_WATER + 0.04 * ability_mod(t.cha))) {
    L.push([`${N(t)} talks ${N(h)} into sharing the ${s.n}.`, "a", "🤝"]);
    return true;
  }
  if (rel === "enemy" || rel === "rival" || chance(0.5)) {
    L.push([`${N(t)} challenges ${N(h)} for the ${s.n}.`, "h", "⚔️"]);
    fight_joint(t, h, L);
    return t.alive && !holder_of(s);
  }
  L.push([`${N(h)} drives ${N(t)} away from the ${s.n}.`, "h", "🚫"]);
  return false;
}

function take_for(t, x, L) {
  const got = take_allowed(t, x);
  if (got) return got;
  const s = [...RES.water].filter((s) => s.stock >= 1 && holder_of(s)).sort((a, b) => b.stock - a.stock)[0];
  return s && contest(t, holder_of(s), s, L) ? take_from(s, x) : 0;
}

function claim_source(t, L) {
  if (!t.alive || t.food <= HUNGER[1] || RES.water.some((s) => s.holder === t.id)) return;
  const free = RES.water.filter((s) => !holder_of(s) && s.stock >= 3).sort((a, b) => b.stock - a.stock)[0];
  if (!free) return;
  const scarce = 1 - water_left() / RES.water.reduce((s, x) => s + x.max, 0);
  if (!chance((CLAIM_BASE + CLAIM_ATK * (atk(t) - 5)) * (1 + 2 * scarce) * (group_size(t.g) > 1 ? 1.5 : 1))) return;
  free.holder = t.id;
  L.push([`${N(t)} stakes a claim on the ${free.n} and warns everyone off.`, "h", "🏕️"]);
}

/* The holder lives off their source: free water every round, but no foraging or hunting. They give up when it runs
   dry, when hunger sends them to find food, or now and then by chance. Returns true while camping. */
function camp(t, L) {
  const s = RES.water.find((x) => x.holder === t.id);
  if (!s) return false;
  if (s.stock < 1) {
    s.holder = null;
    L.push([`The ${s.n} has run dry and ${N(t)} gives up the claim.`, "h", "🏜️"]);
    return false;
  }
  if (t.food <= HUNGER[1]) {
    s.holder = null;
    L.push([`${N(t)} leaves the ${s.n} to look for food.`, "h", "🚶"]);
    return false;
  }
  if (chance(ABANDON_P)) {
    s.holder = null;
    L.push([`${N(t)} abandons the ${s.n}.`, "h", "🚶"]);
    return false;
  }
  gain_water(t, take_from(s, CAMP_WATER));
  return true;
}

/* A random species of this size that still has animals left (more common ones are likelier), or null. */
function game_of(tier) {
  const c = RES.game.filter((a) => a.tier === tier && a.pop >= 1);
  if (!c.length) return null;
  let r = rng() * c.reduce((s, a) => s + a.pop, 0);
  for (const a of c) {
    r -= a.pop;
    if (r < 0) return a;
  }
  return c[c.length - 1];
}

/* Once per round: water and animals recover a little, and the log says when either is running thin. */
function regen_reserve(L) {
  RES.water.forEach((s) => (s.stock = Math.min(s.max, s.stock + s.regen * s.max)));
  RES.game.forEach((a) => (a.pop = Math.min(a.max, a.pop + a.regen * a.max)));
  const big = RES.game.filter((a) => a.tier > 0),
    wf = water_left() / RES.water.reduce((s, x) => s + x.max, 0),
    gf = big.reduce((s, a) => s + a.pop, 0) / big.reduce((s, a) => s + a.max, 0);
  if (wf < 0.3 && !RES.low_w) {
    RES.low_w = true;
    L.push(["The streams and ponds are running low.", "h", "💧"]);
  } else if (wf > 0.5) RES.low_w = false;
  if (gf < 0.4 && !RES.low_g) {
    RES.low_g = true;
    L.push(["Big game is growing scarce.", "h", "🦌"]);
  } else if (gf > 0.6) RES.low_g = false;
}

/* Hunting: more likely when hungry, and the hungrier they are the bolder the prey. Bigger game feeds more but
   fights back. Skill is attack plus speed (and a weapon helps). Nothing is logged for a quiet miss. */
function hunt(t, L) {
  if (!t.alive) return;
  const need = t.food <= HUNGER[2] ? 2 : t.food <= HUNGER[0] ? 1 : 0;
  if (!chance(HUNT_BASE + HUNT_NEED * need + wit(t) * 0.005)) return;
  const w = need >= 2 ? [3, 4, 3] : need === 1 ? [5, 3, 1] : [8, 2, 0.5];
  let r = rng() * w.reduce((a, b) => a + b, 0),
    tier = 0;
  for (let i = 0; i < 3; i++) {
    r -= w[i];
    if (r < 0) {
      tier = i;
      break;
    }
  }
  const sp = game_of(tier);
  if (!sp) return;
  const p = Math.max(0.1, Math.min(0.9, TIERS[tier].base + 0.04 * (atk(t) + spd(t) - 10) + (t.w ? 0.05 : 0)));
  if (chance(p)) {
    sp.pop -= 1;
    gain_food(t, sp.food);
    L.push([`${N(t)} hunts down a ${sp.n} and eats well.`, "a", sp.ic]);
  } else if (chance(TIERS[tier].hurt)) {
    t.hp -= hp_amount(t, 0.1 + 0.08 * tier + rnd(10) / 100);
    L.push([`${N(t)} is hurt hunting a ${sp.n}.`, "h", "🩸"]);
    if (t.hp <= 0 && t.alive && !spare_last(t, L)) {
      die(t, null, `killed hunting a ${sp.n}`);
      L.push([`${N(t)} is killed by a ${sp.n}.`, "k", "💀"]);
    }
  }
}

/* Foraging: a filter makes pond and river water safe; without one there is a risk of getting sick. */
const forage_water = (t, L) => {
  const got = take_for(t, t.filter > 0 ? 3 : 2, L);
  if (!got) return;
  gain_water(t, got);
  if (t.filter > 0) return;
  if (chance(DIRTY_WATER_P - ability_mod(t.con) * 0.02)) {
    const pl = [`${N(t)} drinks untreated water.`, "h", "🤢"];
    L.push(pl);
    add_status(t, "poison", L, pl);
  }
};
