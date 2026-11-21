/* state.js: Shared mutable state (match + setup) and pure derived helpers (atk/spd/wit, alive, relationships). */

let GN = {}, tc = 0, BAN = false, NOB = false, LOCKLEAVE = false, DISWIPE = false,
  FAIRN = 3, QUIETN = 3, QUIET = 0, COMBAT = false;

let P = [], TN = [], T = [], TM = [], R = 0, dead = [], pend = [],
  done = false, gid = 1000, M = "one", SEED = 0, THEME = "auto";

let OPEN = new Set(),
  OPENR = new Set(),
  SHOWALL = false;

let ENDGAME = false,
  ENDGAME_ANNOUNCED = false;

let FIN = false;

let current_bg = "";

const clamp_stat = (k, v) => Math.max(SR[k][0], Math.min(SR[k][1], Math.round(+v || 0)));

const roll_3d6 = () => 3 + rnd(6) + rnd(6) + rnd(6);

const roll_combat = () => ({ str: roll_3d6(), dex: roll_3d6(), con: roll_3d6(), int: roll_3d6(), wis: roll_3d6(), cha: roll_3d6() });

function random_name() {
  return pick(FIRST) + " " + pick(LAST);
}

const new_contestant = () => ({
  name: random_name(),
  img: "",
  team: -1,
  ...roll_combat(),
  ...DEFS,
  weapon: "",
  traits: [],
  job: "",
  fac: "",
});

const alive = () => T.filter((t) => t.alive);

let SOLO = JSON.parse(JSON.stringify(DEF_SOLO)),
  DUO = JSON.parse(JSON.stringify(DEF_DUO));

let DIS = JSON.parse(JSON.stringify(DEF_DIS));

/* ---------- D&D-style abilities, traits, jobs, status effects and relationships ---------- */
const ability_mod = (s) => Math.floor((s - 10) / 2),
  signed = (n) => (n >= 0 ? "+" : "") + n;

let TRAITS = deep_clone(DEF_TR),
  STATUS = deep_clone(DEF_ST),
  REL = [],
  RT = [],
  XL = [],
  POOL = [];

const TR = (id) => TRAITS.find((x) => x.id === id),
  SD = (id) => STATUS.find((x) => x.id === id);

const trait_total = (t, k) =>
  t.traits.concat(t.job ? [t.job] : []).reduce((n, id) => n + ((TR(id) || {})[k] || 0), 0);

const status_total = (t, k) => t.fx.reduce((n, s) => n + ((SD(s.id) || {})[k] || 0), 0);

/* Combat stats on a 1-10 scale: 5 + ability modifier + trait and status modifiers. */
const derived = (t, raw, k) =>
  Math.max(1, Math.min(10, 5 + ability_mod(raw) + trait_total(t, k) + status_total(t, k)));

const atk = (t) => derived(t, t.str, "atk");
const spd = (t) => derived(t, t.dex, "spd");
const wit = (t) => derived(t, t.wis, "wit");
const int = (t) => derived(t, t.int, "int");

/* ---------- combat helpers (pure: no DOM; initiative is the only one that rolls) ---------- */
const weapon_stats = (name) => (Object.prototype.hasOwnProperty.call(WEAPONS, name) ? WEAPONS[name] : UNARMED);

const has_tag = (w, tag) => w.tags.includes(tag);

/* The range a wielder really rolls with a weapon, and their crit multiplier. Attack (STR, traits,
   statuses) moves it: strong fighters keep the top of it and hit consistently, weak ones lose the top. */
const damage_range = (t, w) => {
  const span = w.dmg[1] - w.dmg[0],
    s = (atk(t) - 5) / 5;
  return {
    lo: w.dmg[0] + (s > 0 ? s * DMG_SHIFT * span : 0),
    hi: w.dmg[1] - (s < 0 ? -s * DMG_SHIFT * span : 0),
    cx: w.cx + CRIT_STR * (atk(t) - 5),
  };
};

/* How good a weapon is in this wielder's hands: expected damage per exchange against a typical
   opponent, counting hit chance, their damage range, crits, a heavy weapon they cannot lift and a
   slow reload. Used to decide whether a looted weapon is an upgrade. */
const weapon_rating = (name, t) => {
  const w = weapon_stats(name),
    r = damage_range(t, w),
    acc = spd(t) + w.acc - (has_tag(w, "heavy") && t.str < HEAVY_STR ? HEAVY_PEN : 0),
    crit = Math.min(CRIT_MAX, w.crit + CRIT_INT * int(t) + CRIT_WIT * wit(t));
  return hit_chance(acc, RATING_EVADE) * ((r.lo + r.hi) / 2) * (1 + crit * (r.cx - 1)) * (w.reload ? 0.5 : 1);
};

/* Base accuracy: speed, weapon, heavy weapons without the strength, thirst. Per-fight modifiers
   (reach, ranged, surprise, outnumbered) are added by the fight itself. */
const accuracy = (t) => {
  const w = weapon_stats(t.w);
  return spd(t) + w.acc - (has_tag(w, "heavy") && t.str < HEAVY_STR ? HEAVY_PEN : 0) - (t.water <= 0 ? THIRST_PEN : 0);
};

const evade = (t) => EVADE_SPD * spd(t) + EVADE_WIT * wit(t) + EVADE_INT * int(t);

const hit_chance = (acc, ev) => Math.max(HIT_MIN, Math.min(HIT_MAX, HIT_BASE + HIT_STEP * (acc - ev)));

const crit_chance = (t) => Math.min(CRIT_MAX, weapon_stats(t.w).crit + CRIT_INT * int(t) + CRIT_WIT * wit(t));

/* Each hit taken is reduced by half the CON modifier (never below 0). */
const damage_reduction = (t) => Math.max(0, Math.floor(ability_mod(t.con) / 2));

/* Roll initiative: weapon speed plus DEX, with a little noise. */
const initiative = (t) => weapon_stats(t.w).init + spd(t) + rnd(4);

/* Damage multiplier for vendetta: a griever hits their lover's killer harder, and takes more from them. */
const vend_mult = (from, to) =>
  (from.vd.some((v) => v.k === to.id) ? VEND_DEALT : 1) * (to.vd.some((v) => v.k === from.id) ? VEND_TAKEN : 1);

/* How dangerous someone looks right now: attack, weapon, health and kills. */
const threat = (t) => atk(t) + (t.w ? 3 : 0) + (4 * t.hp) / t.mhp + t.k * 1.5 + ability_mod(t.int) * 0.5;

/* Talk-down history per pair of contestants: n = times it worked (each halves the next chance),
   last = round of the latest success, fought = they have come to blows. */
let TALK = {};
const talk_entry = (a, b) => {
  const k = a.id < b.id ? a.id + ":" + b.id : b.id + ":" + a.id;
  return TALK[k] || (TALK[k] = { n: 0, last: R, fought: false });
};

const group_size = (g) => T.filter((t) => t.alive && t.g === g).length;

/* How a feels about b. A row {a, b, type} means a feels it toward b; it also counts the other
   way round unless mutual === false (older saves have no flag, so they stay two-sided). */
function relationship_of(a, b) {
  let r = null;
  for (const x of RT) {
    const fwd = x.a === a.id && x.b === b.id,
      back = x.a === b.id && x.b === a.id && x.mutual !== false;
    if (!fwd && !back) continue;
    if (x.type === "enemy") return "enemy";
    if (x.type === "rival") r = "rival";
    else if (!r) r = "lover";
  }
  return r;
}