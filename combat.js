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

/* Damage of one landed hit: a roll in the wielder's range (see damage_range), times the crit
   multiplier, less the target's toughness, times any vendetta. Always at least 1. */
function roll_damage(att, def, crit) {
  const r = damage_range(att, weapon_stats(att.w)),
    base = r.lo + rng() * (r.hi - r.lo);
  return Math.max(1, Math.round(((crit ? base * r.cx : base) - damage_reduction(def)) * vend_mult(att, def)));
}

/* Lines that must show even when the fight is collapsed carry a 4th element (true). */
function key_lines(lines, fn) {
  const i = lines.length;
  fn();
  for (let j = i; j < lines.length; j++) lines[j][3] = true;
}

/* The killer takes a better weapon (judged for them) and everything in the victim's pack. */
function loot_body(w, l, lines) {
  if (l.w && weapon_rating(l.w, w) > weapon_rating(w.w, w)) {
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
   Exchanges run until one side has nobody left in the fight, both sides stand down, or the cap is
   reached. Everyone can leave on their own: fall, run, or yield. Helpers are not the main target, so
   they slip away more easily. Fights to the death (opts.deadly, enemies, vendettas) bind only the two
   leads: they have no way out, and the cap is higher.
   Returns { type: "fight", sides, outcome, winner, loser, summary, cls, icon, rounds, exchanges }. */
function resolve_fight(a, b, ca, cb, opts) {
  opts = opts || {};
  COMBAT = true;
  talk_entry(a, b).fought = true;
  a.ex = b.ex = true;

  const sides = [[a, ca].filter(Boolean), [b, cb].filter(Boolean)],
    side_of = new Map(),
    gone = new Set() /* left the fight alive: ran away, or yielded */;
  sides.forEach((s, i) => s.forEach((t) => side_of.set(t, i)));
  const active = (i) => sides[i].filter((t) => t.alive && !gone.has(t)),
    foes_of = (t) => active(1 - side_of.get(t)),
    lead_of = (i) => active(i)[0] || null /* the first still in it: a helper steps up if the lead is out */,
    deadly = !!opts.deadly || is_deadly(a, b),
    bound = (t) => deadly && (t === a || t === b),
    cap = opts.scuffle ? SCUFFLE_CAP : deadly ? DEATH_CAP : FIGHT_CAP;

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
    hit_by = new Map() /* fighter -> the foe who last hurt them */,
    cool = new Map() /* reloading weapons that fired last exchange */,
    lost = [0, 0] /* allies fallen or gone, per side */;
  let final = null /* how the last departure happened */,
    standdown = false;
  const events = [] /* every departure, in order: a death, an escape or a yield */,
    note = (f) => {
      final = f;
      events.push(f);
    };
  const over = () => standdown || !active(0).length || !active(1).length;

  /* Leads go for the opposing lead 70% of the time and otherwise for one of its helpers.
     Helpers go for whoever last hurt their own lead, else anyone. */
  const choose = (att) => {
    const foes = foes_of(att);
    if (!foes.length) return null;
    const i = side_of.get(att);
    if (att === lead_of(i)) return foes.length > 1 && !chance(LEAD_FOCUS) ? pick(foes.slice(1)) : foes[0];
    const lh = last_hit[i];
    return lh && foes.includes(lh) ? lh : pick(foes);
  };

  const attack = (att, n, lines, forced, bonus) => {
    const tgt = forced || choose(att);
    if (!tgt) return;
    const i = side_of.get(att),
      w = weapon_stats(att.w),
      how = att.w ? ` with a ${att.w}` : " with bare hands",
      acc = accuracy(att) + (n === 0 ? 0 : position_mod(att, tgt, n)) + (bonus ? bonus.acc : 0),
      ev = evade(tgt) - SWARM_PEN * (active(i).length - 1);
    const odds = hit_chance(acc, ev),
      pct = Math.round(100 * odds);
    if (!chance(odds)) {
      const verb = has_tag(w, "ranged") ? "shoots at" : att.w ? "attacks" : "swings at";
      lines.push([`${N(att)} ${verb} ${N(tgt)} and misses (${pct}% to hit).`, "a"]);
      return;
    }
    const crit = chance(Math.min(1, crit_chance(att) * (bonus ? bonus.crit : 1))),
      taken = roll_damage(att, tgt, crit);
    att.dmg += Math.min(taken, Math.max(0, tgt.hp));
    tgt.hp -= taken;
    hit_by.set(tgt, att);
    if (tgt === lead_of(1 - i)) last_hit[1 - i] = att;
    lines.push([
      `${N(att)} ${crit ? "lands a critical blow on" : "hits"} ${N(tgt)}${how} for ${taken} (${pct}% to hit).`,
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
      lost[side_of.get(tgt)]++;
      note({ kind: "death", x: tgt, other: att, how });
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
    outnumbered = (i) => active(1 - i).length > active(i).length,
    /* Whoever last hurt x, if still in it, else the opposing lead. */
    chaser = (x) => {
      const h = hit_by.get(x);
      return h && foes_of(x).includes(h) ? h : lead_of(1 - side_of.get(x));
    },
    leave = (x, info) => {
      gone.add(x);
      lost[side_of.get(x)]++;
      note(Object.assign({ x }, info));
    };

  /* The loser hands over a supply item, and a weapon if the winner has none. Returns what changed hands. */
  const tribute = (x, y, lines) => {
    const gave = [];
    if (!y.w && x.w && chance(TRIBUTE_WEAPON_P)) {
      y.w = x.w;
      x.w = null;
      gave.push(`a ${y.w}`);
      lines.push([`${N(x)} hands over their ${y.w}.`, "a", "🎒", true]);
    }
    const have = ITEMS.filter((k) => x[k] > 0);
    if (have.length && chance(TRIBUTE_P)) {
      const k = pick(have);
      x[k]--;
      y[k]++;
      gave.push(ITEM_TEXT[k]);
      lines.push([`${N(x)} hands over ${ITEM_TEXT[k]}.`, "a", "🎒", true]);
    }
    return gave;
  };

  /* x, clearly losing, may beg y to stop. y then recruits them, kills them anyway, or spares them. Mercy is
     harder with x's friends still swinging. Returns true if x offered, which takes x out of the fight. */
  const yield_offer = (x, y, lines) => {
    if (!chance(clamp(0.25 + 0.04 * ability_mod(x.cha) + 0.2 * ((YIELD_HP - hp_frac(x)) / YIELD_HP), 0.05, 0.7))) return false;
    lines.push([`${N(x)} yields and begs ${N(y)} to stop.`, "a", "🏳️", true]);
    const others = active(side_of.get(x)).length - 1,
      can = !BAN && !ENDGAME && (!LOCKLEAVE || (!x.left && !y.left)) && x.g !== y.g && !grudge_between(x, y),
      p_join = can
        ? clamp(0.1 + 0.03 * ability_mod(x.cha) + 0.01 * threat(x) + (trait_total(x, "ally") - trait_total(y, "betray")) / 200, 0, 0.5)
        : 0,
      p_kill = Math.min(
        1 - p_join,
        clamp(0.2 + trait_total(y, "betray") / 100 - 0.02 * ability_mod(x.cha), 0.05, 0.6) + YIELD_PRESSURE * others,
      ),
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
      lost[side_of.get(x)]++;
      note({ kind: "death", x, other: y, how: " without mercy" });
      return true;
    }
    let gave = [];
    if (mode === "spare") {
      gave = tribute(x, y, lines);
      if (chance(SPARE_GRUDGE) && !RT.some((q) => q.a === x.id && q.b === y.id)) {
        RT.push({ a: x.id, b: y.id, type: "enemy", mutual: false });
        lines.push([`${N(x)} will not forget this.`, "h", "💢", true]);
      }
    }
    leave(x, { kind: "yield", other: y, mode, gave, nm: j && j.nm });
    return true;
  };

  /* x, hurt or shaken, may try to run from y. Returns 0 (stays), 1 (x is out: escaped, yielded or fell) or
     2 (tried and failed, so the fight goes on). A ranged pursuer gets a free shot at anyone who runs; a
     failed escape also gives a melee pursuer one free attack, unless x yields first. */
  const try_flee = (x, y, n, lines) => {
    const i = side_of.get(x),
      hx = hp_frac(x),
      helper = x !== sides[i][0] /* an original helper stays one, even once the lead is down */;
    if (!(hx < FLEE_HP || lost[i] > 0 || (outnumbered(i) && hx < FLEE_OUTNUM_HP))) return 0;
    const p_flee = clamp(
      0.1 + 0.5 * (FLEE_HP - hx) + 0.03 * (threat(y) - threat(x)) + MORALE_LOSS * lost[i] + (helper ? HELPER_FLEE : 0),
      0,
      0.8,
    );
    if (!chance(p_flee)) return 0;
    lines.push([`${N(x)} tries to break away from ${N(y)}.`, "h", "🏃", true]);
    const gun = ranged_of(y);
    if (gun) {
      attack(y, n, lines, x);
      if (!x.alive) return 1;
    }
    const p_escape = clamp(0.5 + 0.06 * (spd(x) - spd(y)) + (helper ? HELPER_ESCAPE : 0), 0.15, 0.9) - (gun ? 0.2 : 0);
    if (chance(Math.max(0.05, p_escape))) {
      leave(x, { kind: "retreat", other: y });
      return 1;
    }
    lines.push([`${N(y)} will not let ${N(x)} get away.`, "h", "🏃", true]);
    if (losing(x, y) && yield_offer(x, y, lines)) return 1;
    if (!gun) {
      attack(y, n, lines, x);
      if (!x.alive) return 1;
    }
    return 2;
  };

  /* Checked before every exchange after the first: a stand-down, then each fighter in turn (hurtest first)
     may run or yield. The two leads of a fight to the death cannot. */
  const check_exits = (n, lines) => {
    const all = [...active(0), ...active(1)],
      l0 = lead_of(0),
      l1 = lead_of(1);
    if (
      !deadly &&
      all.every((t) => hp_frac(t) < STANDDOWN_HP) &&
      Math.abs(hp_frac(l0) - hp_frac(l1)) < STANDDOWN_GAP &&
      chance(STANDDOWN_P)
    ) {
      standdown = true;
      return;
    }
    for (const x of all.sort((p, q) => hp_frac(p) - hp_frac(q))) {
      if (over()) return;
      if (!x.alive || gone.has(x) || bound(x)) continue;
      const y = chaser(x);
      if (!y) return;
      const fled = try_flee(x, y, n, lines);
      if (fled === 0 && !over() && x.alive && !gone.has(x) && losing(x, y)) yield_offer(x, y, lines);
    }
  };

  /* Surprise (a betrayal or an ambush): the attacker lands a free opening blow before anything else happens.
     A hit-and-run ambusher then tries to slip away; if they are caught, the fight goes on. */
  if (opts.surprise || opts.hitrun) {
    const lines = [],
      before = b.hp;
    key_lines(lines, () => attack(a, 0, lines, b, { acc: AMBUSH_ACC, crit: AMBUSH_CRIT }));
    if (opts.hitrun && !over()) {
      const p = clamp(0.5 + 0.06 * (spd(a) - spd(b)) + AMBUSH_ESCAPE, 0.15, 0.95) - (ranged_of(b) ? 0.2 : 0);
      if (chance(Math.max(0.05, p))) {
        leave(a, { kind: "retreat", other: b, hitrun: true, dealt: Math.max(0, Math.round(before - b.hp)) });
        lines.push([`${N(a)} slips away.`, "h", "💨", true]);
      } else lines.push([`${N(b)} catches ${N(a)} before they can get away.`, "h", "🏃", true]);
    }
    item.exchanges.push({ n: 0, kind: "ambush", lines });
  }

  /* Opening volley: archers shoot before anyone closes in. */
  const archers = sides.flat().filter(ranged_of);
  if (archers.length && !over()) {
    const lines = [];
    by_speed(archers).forEach((t) => {
      if (!over() && t.alive) act(t, 0, lines);
    });
    item.exchanges.push({ n: 0, kind: "volley", lines });
  }

  /* On the first exchange a reach wielder strikes before anyone without reach. */
  for (let n = 1; n <= cap && !over(); n++) {
    const lines = [];
    if (n > 1) check_exits(n, lines);
    if (over()) {
      if (lines.length) item.exchanges.push({ n, kind: "exit", lines });
      break;
    }
    const order = by_speed(
      [...active(0), ...active(1)],
      (t) => n === 1 && reach_of(t) && foes_of(t).some((f) => !reach_of(f)),
    );
    for (const t of order) {
      if (over()) break;
      if (t.alive && !gone.has(t)) act(t, n, lines);
    }
    item.exchanges.push({ n, lines });
    item.rounds = n;
  }

  item.sides.forEach((s, i) => (s.hpAfter = sides[i].map((t) => Math.max(0, Math.round(t.hp)))));

  /* One sentence per departure, in order; the last one ends the fight unless it ended some other way. */
  const text_of = (f, last) =>
    f.kind === "death"
      ? last
        ? `${N(f.other)} catches ${N(f.x)} and ends the fight${f.how}.`
        : `${N(f.other)} cuts down ${N(f.x)}${f.how}.`
      : f.kind === "retreat"
        ? f.hitrun
          ? `${N(f.x)} ambushes ${N(f.other)}${f.dealt > 0 ? ", hurting them," : ", misses,"} and slips away.`
          : `${N(f.x)} breaks away from ${N(f.other)} and escapes.`
        : f.mode === "recruit"
          ? `${N(f.x)} yields, and ${N(f.other)} lets them join ${f.nm}.`
          : `${N(f.x)} yields to ${N(f.other)}, who lets them go${f.gave.length ? ", taking " + f.gave.join(" and ") : ", taking nothing"}.`;

  const done = over() && !standdown && final,
    words = events.map((f, k) => text_of(f, done && k === events.length - 1));
  if (standdown || (!done && opts.scuffle)) words.push(`${N(a)} and ${N(b)} trade blows, then both back off, bloodied.`);
  else if (!done) words.push(`${N(lead_of(0))} and ${N(lead_of(1))} trade blows until both are spent, then back off, bloodied.`);
  item.summary = words.join(" ");
  if (standdown) item.outcome = "standdown";
  else if (done) {
    const f = final;
    item.winner = f.other.id;
    item.loser = f.x.id;
    if (f.kind === "death") {
      item.outcome = "death";
      item.cls = "k";
      item.icon = "🗡️💀";
      if (f.how === " without mercy") item.mode = "kill";
    } else if (f.kind === "retreat") {
      item.outcome = "retreat";
      item.icon = "💨";
    } else {
      item.outcome = "yield";
      item.mode = f.mode;
      item.cls = "a";
      item.icon = f.mode === "recruit" ? "🤝" : "🕊️";
    }
  }
  return item;
}