/* combat.js: Fight resolution. Changes contestants and returns a fight item; touches no DOM and never
   calls render(). Loads after state.js and before engine.js, which supplies N(), die(), add_status()
   and infect(). Everything random goes through the seeded rng (via rnd, chance, pick, initiative). */

const reach_of = (t) => has_tag(weapon_stats(t.w), "reach"),
  ranged_of = (t) => has_tag(weapon_stats(t.w), "ranged");

/* Accuracy modifier for att hitting def in exchange n (the opening volley is n = 0 and has none).
   Reach keeps a short-range fighter out until they close in; an archer is cramped once they do. */
function position_mod(att, def, n) {
  const ar = reach_of(att),
    dr = reach_of(def),
    ag = ranged_of(att),
    dg = ranged_of(def);
  let m = 0;
  if (dr && !ar && n <= 2) m -= 2; /* not inside the reach wielder's guard yet */
  if (ar && !dr && n >= 3) m -= 1; /* reach wielder is cramped once they are inside */
  if (!ar && !ag && dg && n <= 2) m -= 2; /* still closing on an archer */
  if (ag && !dg && n >= 3) m -= 2; /* archer cramped by a melee fighter */
  return m;
}

/* Damage of one landed hit: weapon range + STR modifier + atk modifiers (doubled or more on a crit),
   less the target's toughness, times any vendetta. Always at least 1. */
function roll_damage(att, def, crit) {
  const w = weapon_stats(att.w),
    base =
      w.dmg[0] + rnd(w.dmg[1] - w.dmg[0] + 1) + ability_mod(att.str) + trait_total(att, "atk") + status_total(att, "atk");
  return Math.max(1, Math.round(((crit ? base * w.cx : base) - damage_reduction(def)) * vend_mult(att, def)));
}

/* Lines that must show even when the fight is collapsed carry a 4th element (true). */
function key_lines(lines, fn) {
  const i = lines.length;
  fn();
  for (let j = i; j < lines.length; j++) lines[j][3] = true;
}

function loot_body(w, l, lines) {
  if (l.w && weapon_rating(l.w) > weapon_rating(w.w)) {
    w.w = l.w;
    lines.push([`${N(w)} takes the ${l.w} from the body.`, "a", "🎒", true]);
  }
  l.w = null;
  const got = ITEMS.reduce((n, k) => n + l[k], 0);
  ITEMS.forEach((k) => {
    w[k] += l[k];
    l[k] = 0;
  });
  if (got) lines.push([`${N(w)} searches the body and takes ${got} suppl${got > 1 ? "ies" : "y"}.`, "a", "🎒", true]);
}

const hp_frac = (t) => Math.max(0, t.hp) / t.mhp,
  clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x)),
  ITEM_TEXT = { bottle: "a water bottle", ration: "a ration", kit: "a medkit" };

const grudge_between = (a, b) =>
  ["enemy", "rival"].includes(relationship_of(a, b)) || ["enemy", "rival"].includes(relationship_of(b, a));

/* Enemies and vendettas fight to the death: no stand-down, retreat or yield. */
const is_deadly = (a, b) =>
  relationship_of(a, b) === "enemy" ||
  relationship_of(b, a) === "enemy" ||
  a.vd.some((v) => v.k === b.id) ||
  b.vd.some((v) => v.k === a.id);

/* Fight between lead attacker a and lead defender b, each with an optional helper (ca, cb).
   Exchanges run until a lead falls, a lead leaves (retreat, yield), both stand down, or the cap is
   reached. Fights to the death (opts.deadly, enemies, vendettas) have no way out and a higher cap.
   Returns { type: "fight", sides, outcome, winner, loser, summary, cls, icon, rounds, exchanges }. */
function resolve_fight(a, b, ca, cb, opts) {
  opts = opts || {};
  COMBAT = true;
  talk_entry(a, b).fought = true;
  a.ex = b.ex = true;

  const sides = [[a, ca].filter(Boolean), [b, cb].filter(Boolean)],
    side_of = new Map();
  sides.forEach((s, i) => s.forEach((t) => side_of.set(t, i)));
  const foes_of = (t) => sides[1 - side_of.get(t)].filter((x) => x.alive),
    deadly = !!opts.deadly || is_deadly(a, b),
    cap = deadly ? DEATH_CAP : FIGHT_CAP,
    lead_down = () => !a.alive || !b.alive;

  const item = {
    type: "fight",
    sides: sides.map((s) => ({ ids: s.map((t) => t.id), hpBefore: s.map((t) => Math.round(t.hp)), hpAfter: [] })),
    outcome: "cap",
    winner: null,
    loser: null,
    summary: "",
    cls: "h",
    icon: "🤜🤛",
    rounds: 0,
    exchanges: [],
  };

  const last_hit = [null, null] /* who most recently damaged each side's lead */,
    cool = new Map() /* reloading weapons that fired last exchange */,
    fallen = [0, 0] /* helpers lost on each side */;
  let end = null /* a lead was killed */,
    ended = null; /* the fight was ended some other way */

  /* Leads go for the opposing lead 70% of the time and otherwise for one of its helpers.
     Helpers go for whoever last hurt their own lead, else anyone. */
  const choose = (att) => {
    const foes = foes_of(att);
    if (!foes.length) return null;
    const i = side_of.get(att),
      lead = sides[1 - i][0];
    if (att === sides[i][0]) {
      const helpers = foes.filter((x) => x !== lead);
      return lead.alive && helpers.length && !chance(LEAD_FOCUS) ? pick(helpers) : lead.alive ? lead : pick(foes);
    }
    const lh = last_hit[i];
    return lh && lh.alive ? lh : pick(foes);
  };

  const attack = (att, n, lines, forced, bonus) => {
    const tgt = forced || choose(att);
    if (!tgt) return;
    const i = side_of.get(att),
      w = weapon_stats(att.w),
      how = att.w ? ` with a ${att.w}` : " with bare hands",
      acc = accuracy(att) + (n === 0 ? 0 : position_mod(att, tgt, n)) + (bonus ? bonus.acc : 0),
      ev = evade(tgt) - SWARM_PEN * (sides[i].filter((x) => x.alive).length - 1);
    if (!chance(hit_chance(acc, ev))) {
      const verb = has_tag(w, "ranged") ? "shoots at" : att.w ? "attacks" : "swings at";
      lines.push([`${N(att)} ${verb} ${N(tgt)} and misses.`, "a"]);
      return;
    }
    const crit = chance(Math.min(1, crit_chance(att) * (bonus ? bonus.crit : 1))),
      taken = roll_damage(att, tgt, crit);
    att.dmg += Math.min(taken, Math.max(0, tgt.hp));
    tgt.hp -= taken;
    if (tgt === sides[1 - i][0]) last_hit[1 - i] = att;
    lines.push([
      `${N(att)} ${crit ? "lands a critical blow on" : "hits"} ${N(tgt)}${how} for ${taken}.`,
      "h",
      crit ? "💥" : "🗡️",
      crit,
    ]);

    if (att.w && w.crafted && chance(CRAFT_BREAK)) {
      lines.push([`${N(att)}'s ${att.w} breaks.`, "h", "💥", true]);
      att.w = null;
    }

    if (tgt.hp <= 0) {
      die(tgt, att);
      lines.push([`${N(tgt)} falls to ${N(att)}${how}.`, "k", "💀"]);
      loot_body(att, tgt, lines);
      if (tgt === a || tgt === b) end = { killer: att, victim: tgt, how };
      else fallen[side_of.get(tgt)]++;
      return;
    }
    if (taken >= INFECT_FRAC * tgt.mhp && !tgt.inf && chance(0.3 - ability_mod(tgt.con) * 0.03))
      key_lines(lines, () => infect(tgt, lines));
    if (taken >= BLEED_FRAC * tgt.mhp && tgt.alive) key_lines(lines, () => add_status(tgt, "bleed", lines));
  };

  const act = (t, n, lines) => {
    if (weapon_stats(t.w).reload && cool.get(t.id)) {
      cool.set(t.id, false);
      lines.push([`${N(t)} reloads.`, "a", "⏳"]);
      return;
    }
    attack(t, n, lines);
    if (weapon_stats(t.w).reload) cool.set(t.id, true);
  };

  /* Fastest first, with a little noise so ties are random. */
  const by_speed = (ts, first) =>
    ts
      .map((t) => ({ t, f: first && first(t) ? 1 : 0, i: initiative(t) + rng() * 0.01 }))
      .sort((x, y) => y.f - x.f || y.i - x.i)
      .map((x) => x.t);

  /* ---------- ways out ---------- */
  const losing = (x, y) => hp_frac(x) <= YIELD_HP && hp_frac(y) - hp_frac(x) >= YIELD_GAP,
    outnumbered = (i) => sides[1 - i].filter((t) => t.alive).length > sides[i].filter((t) => t.alive).length;

  /* The loser hands over a supply item, and a weapon if the winner has none. */
  const tribute = (x, y, lines) => {
    if (!y.w && x.w && chance(TRIBUTE_WEAPON_P)) {
      y.w = x.w;
      x.w = null;
      lines.push([`${N(x)} hands over their ${y.w}.`, "a", "🎒", true]);
    }
    const have = ITEMS.filter((k) => x[k] > 0);
    if (have.length && chance(TRIBUTE_P)) {
      const k = pick(have);
      x[k]--;
      y[k]++;
      lines.push([`${N(x)} hands over ${ITEM_TEXT[k]}.`, "a", "🎒", true]);
    }
  };

  /* x, clearly losing, may beg y to stop. y then recruits them, kills them anyway, or spares them.
     Returns true if x offered, which ends the fight either way. */
  const yield_offer = (x, y, lines) => {
    if (!chance(clamp(0.25 + 0.04 * ability_mod(x.cha) + 0.2 * ((YIELD_HP - hp_frac(x)) / YIELD_HP), 0.05, 0.7))) return false;
    lines.push([`${N(x)} yields and begs ${N(y)} to stop.`, "a", "🏳️", true]);
    const can = !BAN && !ENDGAME && (!LOCKLEAVE || (!x.left && !y.left)) && x.g !== y.g && !grudge_between(x, y),
      p_join = can
        ? clamp(0.1 + 0.03 * ability_mod(x.cha) + 0.01 * threat(x) + (trait_total(x, "ally") - trait_total(y, "betray")) / 200, 0, 0.5)
        : 0,
      p_kill = Math.min(1 - p_join, clamp(0.2 + trait_total(y, "betray") / 100 - 0.02 * ability_mod(x.cha), 0.05, 0.6)),
      r = rng();
    let mode = r < p_join ? "recruit" : r < p_join + p_kill ? "kill" : "spare",
      j = null;
    if (mode === "recruit" && !(j = join_group(y, x))) mode = "spare";

    if (mode === "kill") {
      y.dmg += Math.max(0, x.hp);
      x.hp = 0;
      die(x, y);
      lines.push([`${N(y)} shows no mercy and finishes ${N(x)}.`, "k", "💀", true]);
      loot_body(y, x, lines);
      end = { killer: y, victim: x, how: " without mercy" };
      return true;
    }
    if (mode === "recruit") {
      ended = { outcome: "yield", summary: `${N(x)} yields, and ${N(y)} lets them join ${j.nm}.`, cls: "a", icon: "🤝" };
    } else {
      tribute(x, y, lines);
      if (chance(SPARE_GRUDGE) && !RT.some((r) => r.a === x.id && r.b === y.id)) {
        RT.push({ a: x.id, b: y.id, type: "enemy", mutual: false });
        lines.push([`${N(x)} will not forget this.`, "h", "💢", true]);
      }
      ended = { outcome: "yield", summary: `${N(x)} yields to ${N(y)}, who lets them go.`, cls: "a", icon: "🕊️" };
    }
    Object.assign(ended, { winner: y.id, loser: x.id, mode });
    return true;
  };

  /* x, hurt or outnumbered, may try to run from y. Returns 0 (stays), 1 (the fight is over) or 2 (tried and
     failed, so the fight goes on). A ranged pursuer gets a free shot at anyone who runs; a failed escape
     also gives a melee pursuer one free attack, unless x yields first. */
  const try_flee = (x, y, n, lines) => {
    const i = side_of.get(x),
      hx = hp_frac(x);
    if (!(hx < FLEE_HP || fallen[i] > 0 || (outnumbered(i) && hx < FLEE_OUTNUM_HP))) return 0;
    if (!chance(clamp(0.1 + 0.5 * (FLEE_HP - hx) + 0.03 * (threat(y) - threat(x)), 0, 0.8))) return 0;
    lines.push([`${N(x)} tries to break away from ${N(y)}.`, "h", "🏃", true]);
    const gun = ranged_of(y);
    if (gun) {
      attack(y, n, lines, x);
      if (lead_down()) return 1;
    }
    if (chance(Math.max(0.05, clamp(0.5 + 0.06 * (spd(x) - spd(y)), 0.15, 0.9) - (gun ? 0.2 : 0)))) {
      ended = {
        outcome: "retreat",
        winner: y.id,
        loser: x.id,
        summary: `${N(x)} breaks away from ${N(y)} and escapes.`,
        cls: "h",
        icon: "💨",
      };
      return 1;
    }
    lines.push([`${N(y)} will not let ${N(x)} get away.`, "h", "🏃", true]);
    if (losing(x, y) && yield_offer(x, y, lines)) return 1;
    if (!gun) {
      attack(y, n, lines, x);
      if (lead_down()) return 1;
    }
    return 2;
  };

  /* Checked before every exchange after the first: stand-down, then retreat and yield, hurtest lead first. */
  const check_exits = (n, lines) => {
    if (deadly) return;
    const fa = hp_frac(a),
      fb = hp_frac(b);
    if (fa < STANDDOWN_HP && fb < STANDDOWN_HP && Math.abs(fa - fb) < STANDDOWN_GAP && chance(STANDDOWN_P)) {
      ended = {
        outcome: "standdown",
        summary: `${N(a)} and ${N(b)} trade blows, then both back off, bloodied.`,
        cls: "h",
        icon: "🤜🤛",
      };
      return;
    }
    for (const x of fa <= fb ? [a, b] : [b, a]) {
      const y = sides[1 - side_of.get(x)][0],
        fled = try_flee(x, y, n, lines);
      if (fled === 1 || lead_down() || ended) return;
      if (fled === 0 && losing(x, y) && yield_offer(x, y, lines)) return;
      if (lead_down() || ended) return;
    }
  };

  /* Surprise (a betrayal): the attacker lands a free opening blow before anything else happens. */
  if (opts.surprise) {
    const lines = [];
    key_lines(lines, () => attack(a, 0, lines, b, { acc: AMBUSH_ACC, crit: AMBUSH_CRIT }));
    item.exchanges.push({ n: 0, kind: "ambush", lines });
  }

  /* Opening volley: archers shoot before anyone closes in. */
  const archers = sides.flat().filter(ranged_of);
  if (archers.length) {
    const lines = [];
    by_speed(archers).forEach((t) => {
      if (!lead_down() && t.alive) act(t, 0, lines);
    });
    item.exchanges.push({ n: 0, kind: "volley", lines });
  }

  /* On the first exchange a reach wielder strikes before anyone without reach. */
  for (let n = 1; n <= cap && !lead_down() && !ended; n++) {
    const lines = [];
    if (n > 1) check_exits(n, lines);
    if (lead_down() || ended) {
      if (lines.length) item.exchanges.push({ n, kind: "exit", lines });
      break;
    }
    const order = by_speed(
        sides.flat().filter((t) => t.alive),
        (t) => n === 1 && reach_of(t) && foes_of(t).some((f) => !reach_of(f)),
      );
    for (const t of order) {
      if (lead_down()) break;
      if (t.alive) act(t, n, lines);
    }
    item.exchanges.push({ n, lines });
    item.rounds = n;
  }

  item.sides.forEach((s, i) => (s.hpAfter = sides[i].map((t) => Math.max(0, Math.round(t.hp)))));
  if (end) {
    item.outcome = "death";
    item.winner = end.killer.id;
    item.loser = end.victim.id;
    item.summary = `${N(end.killer)} catches ${N(end.victim)} and ends the fight${end.how}.`;
    item.cls = "k";
    item.icon = "🗡️💀";
    if (end.how === " without mercy") item.mode = "kill";
  } else if (ended) {
    Object.assign(item, ended);
  } else {
    item.summary = `${N(a)} and ${N(b)} trade blows until both are spent, then back off, bloodied.`;
  }
  return item;
}