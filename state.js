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

const atk = (t) => Math.max(0, t.atk + trait_total(t, "atk") + status_total(t, "atk"));

const spd = (t) => Math.max(0, t.spd + trait_total(t, "spd") + status_total(t, "spd"));

const wit = (t) => Math.max(0, t.wit + trait_total(t, "wit") + status_total(t, "wit"));

const group_size = (g) => T.filter((t) => t.alive && t.g === g).length;

function relationship_of(a, b) {
  let r = null;
  for (const x of RT) {
    if ((x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id)) {
      if (x.type === "enemy") return "enemy";
      if (x.type === "rival") r = "rival";
      else if (!r) r = "lover";
    }
  }
  return r;
}