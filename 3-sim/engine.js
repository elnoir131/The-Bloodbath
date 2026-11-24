/* engine.js: The simulation: rounds, fights, solo/duo events, disasters, upkeep, alliances, finish. */

function is_harmful(event) {
  const fx = event.fx || "";
  if (["hurt", "die", "hurtb", "hurtboth", "killb"].includes(fx)) return true;
  if (fx.startsWith("st:")) {
    const s = SD(fx.slice(3));
    return !!s && (s.dmg > 0 || s.atk + s.spd + s.wit + (s.int || 0) < 0);
  }
  return false;
}

function pick_weighted(events, target) {
  const mult = target ? Math.max(0.1, 1 - ability_mod(target.wis) * 0.05 - trait_total(target, "wit") * 0.02) : 1;
  const w = events.map((event) => (event.ch ?? 100) * (is_harmful(event) ? mult : 1));
  const total = w.reduce((a, b) => a + b, 0);
  if (total <= 0) return pick(events);
  let r = rng() * total;
  for (let i = 0; i < events.length; i++) {
    r -= w[i];
    if (r <= 0) return events[i];
  }
  return events[events.length - 1];
}

const mark_end = () => { FIN = true; $("#next").textContent = "Show results"; };

const gain_water = (t, x) => {
  t.water = Math.min(12, t.water + x);
};

const gain_food = (t, x) => {
  t.food = Math.min(99, t.food + x);
};

const hp_amount = (t, p) => Math.round(t.mhp * p);

const heal = (t, p) => {
  t.hp = Math.min(t.mhp, t.hp + hp_amount(t, p));
};

function die(t, by, why) {
  t.alive = false;
  t.hp = 0;
  t.round = R;
  t.why = why || (by ? "killed by " + by.n : "wounds");
  t.cause = why ? (why.match(/disaster|thirst|hunger|infection/) || ["wounds"])[0] : by ? "kill" : "wounds";
  pend.push(t);
  dead.push(t);
  if (by) by.k++;
  settle_vendettas(t, by);
  grief_of(t, by);
}

/* The match never ends with nobody left: the last person standing is spared at 1 HP. */
function spare_last(t, L) {
  if (!t.alive || t.hp > 0 || alive().length > 1) return false;
  t.hp = 1;
  L.push([`${N(t)} is the last one standing and clings on against all odds.`, "h", "🫀"]);
  return true;
}

const settle = (L, ...ts) =>
  ts.forEach((t) => {
    if (t.alive && t.hp <= 0 && !spare_last(t, L)) {
      die(t);
      L.push([`${N(t)} succumbs to their wounds.`, "k", "💀"]);
    }
  });

const cannon = (f) =>
  f.length
    ? [`${f.length} cannon shot${f.length > 1 ? "s" : ""}: ${f.map(N).join(", ")}.`, "c"]
    : null;

const N = (t) => "\u0001" + t.id + "\u0002";

function infect(t, L) {
  t.inf = true;
  L.push([`${N(t)}'s wound turns bad and a fever sets in.`, "h", "🦠"]);
}

const fill = (x, a, b, w) =>
  x
    .replace(/\{a\}/g, N(a))
    .replace(/\{b\}/g, b ? N(b) : "someone")
    .replace(/\{w\}/g, w || "weapon");

function solo(a, L) {
  if (
    !BAN &&
    !(LOCKLEAVE && a.left) &&
    T.some((t) => t.alive && t !== a && t.g === a.g) &&
    (ENDGAME || chance(0.08))
  ) {
    a.g = gid++;
    a.left = true;
    L.push([`${N(a)} slips away from the group in the night and goes solo.`, "h", "🚶"]);
    return;
  }

  const ev = SOLO.filter((e) => e.on && !(e.fx === "craft" && a.w));
  if (!ev.length) {
    L.push([`${N(a)} rests.`, "", "💤"]);
    return;
  }

  let e = pick_weighted(ev, a);
  if ((e.fx === "hurt" || e.fx === "die") && chance(wit(a) * 0.04)) e = pick_weighted(ev, a);

  let w = null;
  if (e.fx === "weapon") {
    w = pick(WPN_STANDARD);
    if (!a.w || weapon_rating(w, a) > weapon_rating(a.w, a)) a.w = w;
  }
  if (e.fx === "craft") a.w = w = pick(WPN_CRAFTED);
  if (e.fx === "food") gain_food(a, 10);
  if (e.fx === "water") gain_water(a, 4);
  if (e.fx === "ration") a.ration++;
  if (e.fx === "bottle") a.bottle++;
  if (e.fx === "medkit") a.kit++;
  if (e.fx === "heal") heal(a, 0.18);
  if (e.fx === "hurt") a.hp -= hp_amount(a, (10 + rnd(20)) / 100);
  if (e.fx === "die") a.hp = 0;

  L.push([
    fill(e.t, a, null, w || a.w),
    e.fx === "hurt" ? "h" : e.fx === "die" ? "k" : e.fx === "none" ? "" : "a",
    e.ic,
  ]);
  if (e.fx.startsWith("st:")) add_status(a, e.fx.slice(3), L);

  if (a.hp <= 0 && a.alive && !spare_last(a, L)) {
    die(a);
    L.push([`${N(a)} does not survive.`, "k", "💀"]);
    return;
  }

  if (e.fx === "heal" && a.inf && chance(0.5)) {
    a.inf = false;
    L.push([`${N(a)}'s fever breaks.`, "a", "🌡️"]);
  }
  if (e.fx === "hurt" && !a.inf && chance(0.12)) infect(a, L);
}

function run_duo(e, a, b, L) {
  if (is_harmful(e)) COMBAT = true;
  if (e.fx === "steal" && chance(Math.min(0.6, wit(b) * 0.05))) {
    L.push([`${N(a)} tries to take supplies from ${N(b)}, but ${N(b)} wakes in time.`, "h", "💰"]);
    return;
  }
  /* Fighting events run through the combat engine, and its log tells the story: a short fight, an ambush
     that tries to slip away afterwards, or a deadly ambush. */
  if (e.fx === "hurtboth" || e.fx === "hurtb" || e.fx === "killb") {
    const o = e.fx === "hurtboth" ? { scuffle: true } : e.fx === "hurtb" ? { hitrun: true } : { deadly: true, surprise: true };
    L.push({ kind: "fight", ...resolve_fight(a, b, null, null, o) });
    return;
  }
  if (e.fx === "steal") {
    const inv = ITEMS.filter((k) => b[k] > 0);
    if (inv.length) {
      const k = pick(inv);
      b[k]--;
      a[k]++;
    } else {
      const f = Math.min(5, b.food - 1 > 0 ? b.food - 1 : 0);
      b.food -= f;
      a.food += f;
    }
  }

  L.push([fill(e.t, a, b), "", e.ic]);
  if (e.fx.startsWith("st:")) add_status(b, e.fx.slice(3), L);
  settle(L, a, b);
}

function run_disaster(d, L) {
  const al = alive();
  if (!al.length) return;
  L.push([d.t, "c", d.ic]);

  let v = [];
  const cnt = d.n > 0 ? d.n : al.length; /* N = 0 means everyone */
  if (d.fx === "killweak")
    v = al
      .map((t) => ({ t, s: (100 * t.hp) / t.mhp + spd(t) * 3 + wit(t) * 2 + rnd(30) }))
      .sort((x, y) => x.s - y.s)
      .slice(0, cnt)
      .map((o) => o.t);
  if (d.fx === "killrand" || d.fx === "hurtrand" || d.fx.startsWith("st:"))
    v = shuffle([...al]).slice(0, cnt);

  const out = (t) => {
    if (t.alive && t.hp <= 0) {
      die(t, null, "a disaster");
      L.push([`${N(t)} does not survive.`, "k", "💀"]);
    }
  };

  /* If this disaster would kill everyone still alive, the patrons favour one of them.
     Odds are weighted by CHA squared, so a charming contestant is likelier to be spared.
     Turned off by the "Disasters can kill everyone" rule. */
  const favourite = () => {
    const doomed = alive().filter((t) => t.hp <= 0);
    if (DISWIPE || !doomed.length || doomed.length < alive().length) return null;
    const w = doomed.map((t) => t.cha * t.cha);
    let r = rng() * w.reduce((a, b) => a + b, 0),
      f = doomed[doomed.length - 1];
    for (let i = 0; i < doomed.length; i++) {
      r -= w[i];
      if (r < 0) {
        f = doomed[i];
        break;
      }
    }
    f.hp = 1;
    return f;
  };
  const patron_line = (f) =>
    L.push([`The patrons are won over by ${N(f)} and intervene at the last moment. ${N(f)} survives.`, "a", "🎁"]);

  let fav = null;
  v.forEach((t) => {
    if (d.fx === "hurtrand") t.hp -= hp_amount(t, chance(0.3 + 0.04 * ability_mod(t.dex)) ? 0.15 : 0.3);
    else if (!d.fx.startsWith("st:")) t.hp = 0;
  });
  fav = favourite();

  v.forEach((t) => {
    L.push([
      fill(d.v || "{a} is caught up in it.", t),
      d.fx === "hurtrand" || d.fx.startsWith("st:") ? "h" : "k",
      d.ic,
    ]);
    out(t);
    if (d.fx.startsWith("st:")) add_status(t, d.fx.slice(3), L);
  });
  if (fav) patron_line(fav);

  if (d.fx === "hurtall") {
    al.forEach((t) => {
      if (t.alive) t.hp -= hp_amount(t, 0.15);
    });
    fav = favourite();
    al.forEach(out);
    if (fav) patron_line(fav);
  }

  al.forEach((t) => {
    if (!t.alive) return;
    if (d.fx === "healall") heal(t, 0.25);
    if (d.fx === "foodall") gain_food(t, 10);
    if (d.fx === "thirstall") t.water = Math.max(0, t.water - 2);
    if (d.fx === "rainall") gain_water(t, 3);
  });
}

/* A disaster that picks out some contestants rather than hitting everyone (or nobody). */
const singles_out = (d) =>
  ["killweak", "killrand", "hurtrand"].includes(d.fx) || (d.fx.startsWith("st:") && d.n > 0 && d.n < alive().length);

function hazard(L) {
  let ds = DIS.filter((e) => e.on);
  /* Fair fight: when few remain, random disasters stop picking victims and the survivors settle it. */
  if (FAIRN > 0 && alive().length <= FAIRN) ds = ds.filter((e) => !singles_out(e));
  if (alive().length < 2 || !ds.length) return;
  run_disaster(pick_weighted(ds), L);
}

/* Stalemate breaker: after several rounds with no death and no combat, the Gamemakers step in.
   Many remain: a harmful disaster. Few remain: two survivors are forced into a fight. */
const harmful_dis = () =>
  DIS.filter((e) => e.on && (["killweak", "killrand", "hurtrand", "hurtall"].includes(e.fx) || is_harmful(e)));

function gamemakers(L) {
  const al = alive();
  if (al.length < 2) return false;
  if (FAIRN > 0 && al.length <= FAIRN) {
    const a = pick(al),
      far = al.filter((x) => x !== a && x.g !== a.g),
      b = pick(far.length ? far : al.filter((x) => x !== a));
    L.push([`The Gamemakers grow impatient and herd ${N(a)} and ${N(b)} into the same clearing.`, "c", "🚨"]);
    fight_joint(a, b, L, true);
    return true;
  }
  const ds = harmful_dis();
  if (!ds.length) return false;
  L.push(["The Gamemakers grow impatient with the quiet.", "c", "🚨"]);
  run_disaster(pick_weighted(ds), L);
  return true;
}

const over = () =>
  alive().length <= 1 || (M === "grp" && new Set(alive().map((t) => t.g)).size <= 1);

function upkeep(t, L) {
  const hurt = t.hp < t.mhp * 0.5;
  t.water -= 1 + (t.ex ? 0.75 : 0) + (hurt ? 0.5 : 0) + (t.inf ? 0.5 : 0);
  t.food -= 1 + (t.ex ? 1 : 0) + (hurt || t.inf ? 1 : 0);
  t.ex = false;

  if (t.inf) t.hp -= hp_amount(t, 0.05);
  if (t.water <= 1 && t.bottle > 0) {
    t.bottle--;
    gain_water(t, 4);
    L.push([`${N(t)} drinks from a water bottle.`, "a", "🍶"]);
  }
  if (t.food <= 3 && t.ration > 0) {
    t.ration--;
    gain_food(t, 14);
    L.push([`${N(t)} eats a ration.`, "a", "🥫"]);
  }
  if (t.kit > 0 && (t.hp < t.mhp * 0.4 || (t.inf && t.hp < t.mhp * 0.7))) {
    t.kit--;
    heal(t, 0.35);
    t.inf = false;
    L.push([`${N(t)} uses a medkit.`, "a", "🩹"]);
  }

  if (t.water <= 0) {
    t.water = 0;
    t.hp -= hp_amount(t, Math.max(0.12, 0.3 - 0.03 * ability_mod(t.con)));
    if (t.hp > 0 && !t.dz) {
      t.dz = true;
      L.push([`${N(t)} is badly dehydrated and growing weak.`, "h", "🥵"]);
    }
  } else {
    t.dz = false;
  }

  /* Grief has no timer, but it always lasts at least GRIEF_MIN rounds. After that each round there is a
     chance the griever comes to terms with the loss. */
  const gi = t.fx.findIndex((s) => s.id === "grief");
  if (gi >= 0 && R - (t.fx[gi].since || 0) >= GRIEF_MIN && chance(Math.min(0.5, Math.max(0.05, GRIEF_BASE + ability_mod(t.wis) * GRIEF_WIS)))) {
    t.fx.splice(gi, 1);
    t.vd = [];
    L.push([`${N(t)} slowly comes to terms with the loss.`, "a", "🕊️"]);
  }

  t.fx = t.fx.filter((s) => {
    const d = SD(s.id);
    if (!d) return false;
    t.hp = Math.min(t.mhp, t.hp - Math.round((t.mhp * d.dmg) / 100));
    if (s.id === "grief") return true;
    s.left--;
    return s.left > 0;
  });

  if (t.food <= 0) {
    t.food = 0;
    t.hp -= hp_amount(t, Math.max(0.02, 0.08 - 0.01 * ability_mod(t.con)));
    if (t.hp > 0 && !t.hg) {
      t.hg = true;
      L.push([`${N(t)} is starving and losing strength.`, "h", "🥀"]);
    }
  } else {
    t.hg = false;
  }

  if (t.hp <= 0 && t.alive && !spare_last(t, L)) {
    const why = t.water <= 0 ? "thirst" : t.food <= 0 ? "hunger" : t.inf ? "infection" : "wounds";
    die(t, null, why);
    L.push([
      why === "thirst"
        ? `${N(t)} collapses from thirst.`
        : why === "hunger"
          ? `${N(t)} collapses from hunger.`
          : why === "infection"
            ? `${N(t)} succumbs to the infection.`
            : `${N(t)} succumbs to their wounds.`,
      "k",
      "💀",
    ]);
  }
}

function step() {
  if (done) return;
  if (FIN) { finish(); render(); return; }

  R++;
  HELPERS = new Set();
  COMBAT = false;
  const L = [];

  if (M === "one" && alive().length > 1) {
    const threshold = ENDN;
    const groups = new Set(alive().map((t) => t.g));

    if (!ENDGAME && (alive().length <= threshold || groups.size === 1)) {
      ENDGAME = true;
      ENDGAME_ANNOUNCED = true;
      L.push([
        "The endgame approaches. Alliances will fracture. Only one can survive.",
        "announce",
        "🚨",
      ]);
    }

    if (ENDGAME) {
      const remaining = new Set(alive().map((t) => t.g));
      if (remaining.size < alive().length) {
        if (ENDGAME_ANNOUNCED) {
          ENDGAME_ANNOUNCED = false;
        } else {
          L.push([
            "Alliances are forbidden. The Gamemakers strike the remaining teams.",
            "announce",
            "💀",
          ]);
          const ds = harmful_dis();
          if (ds.length) run_disaster(pick_weighted(ds), L);
        }
      }
    }
  }

  alive().forEach((t) => {
    if (chance(FORAGE_BASE + wit(t) * FORAGE_WIT)) gain_water(t, 2);
    upkeep(t, L);
  });

  alive().forEach((t) => {
    const h = trait_total(t, "heal");
    if (h > 0 && chance(h / 100)) {
      const w = alive().filter((o) => o !== t && o.g === t.g && o.hp < o.mhp * 0.7);
      if (w.length) {
        const o = pick(w);
        heal(o, 0.15);
        L.push([`${N(t)} patches up ${N(o)}'s wounds.`, "a", "🩺"]);
      }
    }
  });
  const pool = shuffle(alive());
  POOL = pool;
  while (pool.length) {
    const a = pool.pop();
    if (!a.alive) continue;
    let b = null;
    if (pool.length && chance(0.5)) {
      let i = rnd(pool.length);
      if (pool.length > 1 && chance(LEAN_CHANCE)) i = lean_target(a, pool);
      const m = pool.findIndex((x) => x.g === a.g);
      if (m >= 0 && chance(0.5)) i = m;
      const r = pool.findIndex((x) => relationship_of(a, x) || relationship_of(x, a));
      if (r >= 0 && chance(0.4)) i = r;
      b = pool.splice(i, 1)[0];
    }
    if (!b) solo(a, L);
    else if (b.alive) pair(a, b, L);
  }

  const forced = QUIETN > 0 && QUIET >= QUIETN && gamemakers(L);
  if (forced) QUIET = 0;
  else if (R % 3 === 0 || (R > 8 && chance(0.4)) || (alive().length > 8 && R > 5 && chance(0.3))) hazard(L);

  L.push(...XL.splice(0));
  const fell = pend.map((t) => t.id);
  QUIET = COMBAT || fell.length ? 0 : QUIET + 1;
  L.push(cannon(pend.splice(0)) || ["Nobody falls this round.", ""]);
  add_log(`${R % 2 ? "Day" : "Night"} ${Math.ceil(R / 2)}`, L, undefined, undefined, round_summary(fell));

  if (over()) mark_end();
  render();
}

const kill_text = (n) => `${n} kill${n === 1 ? "" : "s"}`;

/* Joint-attack helpers this round (they are not marked as fighting by t.ex, which also drains water and food). */
let HELPERS = new Set();

/* Compact "who fell / who is low / who fought" header for a round. */
function round_summary(fell) {
  return {
    dead: fell,
    low: alive().filter((t) => t.hp < t.mhp * 0.3).map((t) => t.id),
    fought: T.filter((t) => (t.ex || HELPERS.has(t.id)) && (t.alive || t.round === R)).map((t) => t.id),
    alive: alive().length,
  };
}

/* Short prose recap built only from the final state (no randomness). */
function epilogue() {
  const al = alive(),
    names = (a) => a.map((t) => t.n).join(" and "),
    out = [];
  const kills = al.reduce((n, t) => n + t.k, 0);
  if (al.length) {
    out.push(
      `${names(al)} ${al.length > 1 ? "walk" : "walks"} out of the arena after ${R} rounds, ${
        kills ? `having taken ${kills} li${kills > 1 ? "ves" : "fe"} along the way` : "without taking a single life"
      }.`,
    );
  } else {
    const last = dead.filter((t) => t.round === R);
    out.push(
      `Nobody walks out. ${last.length ? names(last) + (last.length > 1 ? " fall" : " falls") + " together in round " + R : "The arena claims everyone"}.`,
    );
  }
  if (dead.length) {
    const first = dead[0];
    out.push(`${first.n} was the first to fall, in round ${first.round} (${first.why}).`);
  }
  const top = [...T].sort((x, y) => y.k - x.k)[0];
  if (top && top.k > 1 && !top.alive)
    out.push(`${top.n} was the deadliest with ${top.k} kills but fell in round ${top.round}.`);
  const cause = (c) => dead.filter((t) => t.cause === c).length,
    tolls = [
      [cause("disaster"), "to disasters"],
      [cause("thirst"), "to thirst"],
      [cause("hunger"), "to hunger"],
      [cause("infection"), "to infection"],
      [cause("kill"), "at another contestant's hand"],
    ].filter(([n]) => n);
  const rest = dead.length - tolls.reduce((n, [c]) => n + c, 0);
  if (rest > 0) tolls.push([rest, "to their wounds"]);
  if (tolls.length)
    out.push(`The arena took its toll: ${tolls.map(([n, w]) => `${n} ${w}`).join(", ")}.`);
  return out.join(" ");
}

function finish() {
  FIN = false; $("#next").textContent = "Next round";
  done = true;
  $("#next").disabled = $("#spB").disabled = $("#dsB").disabled = true;

  const al = alive().sort((x, y) => y.k - x.k),
    order = [...al, ...[...dead].reverse()];
  const info = (t) =>
    `${t.k} kill${t.k === 1 ? "" : "s"} · ${t.dmg} damage · ${t.alive ? "survived" : "out in round " + t.round + " (" + t.why + ")"}${t.team >= 0 ? " · started with " + TM[t.team].n : " · started solo"}`;
  const head = al.length
    ? `${al.map((t) => t.n).join(" & ")} ${al.length > 1 ? "win together" : "wins"} (${kill_text(al.reduce((n, t) => n + t.k, 0))}, ${R} rounds)`
    : "No survivors";

  const epi = epilogue();
  const d = document.createElement("div");
  d.className = "win";
  d.innerHTML =
    (al.length
      ? `${al.map(avatar_html).join("")}<h2>${esc(al.map((t) => t.n).join(" & "))} ${al.length > 1 ? "win together" : "wins"}</h2><p class="meta">${kill_text(al.reduce((n, t) => n + t.k, 0))} · ${R} rounds · seed ${SEED}</p>`
      : `<h2>No survivors</h2><p class="meta">The arena claims everyone. Seed ${SEED}.</p>`) +
    `<p class="epi">${esc(epi)}</p>` +
    `<ol>${order.map((t) => `<li>${esc(t.n)} <span class="meta">${esc(info(t))}</span></li>`).join("")}</ol>`;

  add_log(
    "Final results",
    [],
    d.outerHTML,
    head + "\n\n" + epi + "\n\n" + order.map((t, i) => `${i + 1}. ${t.n}: ${info(t)}`).join("\n"),
  );
}

function join_group(a, b) {
  const max = MGS;
  const sa = group_size(a.g),
    sb = group_size(b.g);
  if (sa + sb > max) return null;
  const ag = a.g,
    bg = b.g,
    to = sa === 1 && sb > 1 ? bg : ag,
    from = to === ag ? bg : ag;
  if (!GN[to]) GN[to] = { n: "Team " + ++tc };
  T.forEach((t) => {
    if (t.g === from) t.g = to;
  });
  return { nm: GN[to].n, fn: GN[from] ? GN[from].n : "another group" };
}

function add_status(t, id, L) {
  const d = SD(id);
  if (!d || !t.alive) return;
  /* Only harmful statuses can be resisted. Buffs (inspired, regenerating...) always land. */
  const harmful = d.dmg > 0 || d.atk < 0 || d.spd < 0 || d.wit < 0 || d.int < 0;
  if (harmful && chance(Math.max(0, ability_mod(t.con) * 0.05))) {
    L.push([`${N(t)} shrugs off the ${d.n.toLowerCase()} effect.`, "a", "🛡️"]);
    return;
  }
  const s = t.fx.find((x) => x.id === id);
  if (s) s.left = d.dur;
  else {
    t.fx.push({ id, left: d.dur });
    L.push([`${N(t)} is ${d.n.toLowerCase()}.`, "h", d.ic]);
  }
}

/* Something dying ends every vendetta aimed at them. Killing the target yourself also ends the grief. */
function settle_vendettas(t, by) {
  T.forEach((o) => {
    const v = o.alive && o.vd.find((x) => x.k === t.id);
    if (!v) return;
    o.vd = o.vd.filter((x) => x !== v);
    if (by === o) {
      XL.push([`${N(o)} avenges ${N(T[v.f])} by killing ${N(t)}.`, "a", "🕯️"]);
      if (!o.vd.length) o.fx = o.fx.filter((s) => s.id !== "grief");
    } else {
      XL.push([`${N(t)} dies before ${N(o)} can avenge ${T[v.f].n}.`, "h", ["☠️", "🥀"]]);
    }
  });
}

function grief_of(t, by) {
  /* A one-sided lover row (mutual === false) means a loves b: only a grieves, and only if b dies. */
  RT.filter((r) => r.type === "lover" && (r.b === t.id || (r.a === t.id && r.mutual !== false))).forEach((r) => {
    const o = T[r.a === t.id ? r.b : r.a];
    if (!o || !o.alive) return;
    const d = SD("grief");
    if (d && !o.fx.some((s) => s.id === "grief")) o.fx.push({ id: "grief", left: d.dur, since: R });
    if (by && by !== o && !o.vd.some((v) => v.k === by.id)) o.vd.push({ k: by.id, f: t.id });
    if (
      by &&
      by !== o &&
      !RT.some(
        (x) =>
          x.type === "enemy" &&
          ((x.a === o.id && x.b === by.id) || (x.a === by.id && x.b === o.id)),
      )
    )
      RT.push({ a: o.id, b: by.id, type: "enemy" });
    XL.push([
      `${N(o)} is shattered by ${N(t)}'s death${by ? ` and swears revenge on ${N(by)}` : ""}.`,
      "h",
      "💔",
    ]);
  });
}

/* Who may join x's attack on y: a groupmate or faction mate of x, or anyone who is an enemy of y.
   Enemies of y are tried first. Never an enemy of x, and never a lover of y. */
function assist(x, y) {
  const mate = (t) => (!LOCKLEAVE || (!t.left && !x.left)) && (t.g === x.g || (x.fk && t.fk === x.fk)),
    foe = (t) => relationship_of(t, y) === "enemy",
    ok = (t) =>
      t.alive &&
      t !== x &&
      t !== y &&
      relationship_of(t, x) !== "enemy" &&
      relationship_of(t, y) !== "lover" &&
      (mate(t) || foe(t));
  let i = POOL.findIndex((t) => ok(t) && foe(t));
  if (i < 0) i = POOL.findIndex(ok);
  if (i < 0) return null;
  const c = POOL[i];
  const p =
    0.15 +
    ability_mod(x.cha) * 0.02 +
    (trait_total(x, "coord") + trait_total(c, "coord")) / 100 +
    (ability_mod(x.int) + ability_mod(c.int)) * 0.01 +
    (x.fk && x.fk === c.fk ? 0.2 : 0) +
    (c.g === x.g ? 0.05 : 0) +
    (foe(c) ? FOE_JOIN : 0) +
    Math.max(-0.1, Math.min(0.25, 0.02 * (threat(y) - threat(x))));
  return chance(Math.min(0.85, Math.max(0, p))) ? POOL.splice(i, 1)[0] : null;
}

function fight_joint(a, b, L, deadly) {
  const ca = assist(a, b),
    cb = ca ? null : assist(b, a);
  /* A helper who is only there because they hate the target gets their own line. */
  const grudge = (c, lead, tgt) =>
    relationship_of(c, tgt) === "enemy" && c.g !== lead.g && !(lead.fk && c.fk === lead.fk);
  if (ca)
    L.push([
      grudge(ca, a, b)
        ? `${N(ca)} has a score to settle with ${N(b)} and joins ${N(a)}'s attack.`
        : `${N(a)} and ${N(ca)} strike ${N(b)} together.`,
      "h",
      "⚔️",
    ]);
  if (cb)
    L.push([
      grudge(cb, b, a)
        ? `${N(cb)} has a score to settle with ${N(a)} and joins ${N(b)}'s defence.`
        : `${N(b)} and ${N(cb)} close ranks against ${N(a)}.`,
      "h",
      "⚔️",
    ]);
  if (ca) HELPERS.add(ca.id);
  if (cb) HELPERS.add(cb.id);
  L.push({ kind: "fight", ...resolve_fight(a, b, ca, cb, { deadly }) });
}

/* Index of the partner a leans toward: weaker and hurt ones early, the biggest threat late. */
function lean_target(a, pool) {
  const late = ENDGAME || alive().length <= Math.ceil(T.length * LATE_FRAC),
    th = pool.map(threat),
    top = Math.max(...th, 1),
    ta = threat(a),
    w = th.map((x) => (late ? Math.pow(Math.max(0, x) / top, 3) + 0.05 : Math.max(0.1, 1 + 0.08 * (ta - x))));
  let r = rng() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return w.length - 1;
}

function pair(a, b, L) {
  /* Feelings can be one-sided. If only b has them toward a, swap so a is the one who feels. */
  if (!relationship_of(a, b) && relationship_of(b, a)) [a, b] = [b, a];
  const rel = relationship_of(a, b),
    same = a.g === b.g,
    fac = a.fk && a.fk === b.fk,
    bt = (t) => trait_total(t, "betray");
  const can_join = (t) => !LOCKLEAVE || !t.left;

  /* Unrequited love: a seeks b, but b does not feel the same. A calculating b (INT) may exploit it:
     a joins b's group and hands over supplies. Otherwise b turns a away. */
  if (rel === "lover" && !same && relationship_of(b, a) !== "lover") {
    const use =
      !BAN && !ENDGAME && can_join(a) && can_join(b) &&
      chance(Math.min(0.9, Math.max(0.2, 0.5 + ability_mod(b.int) * 0.03)));
    const j = use ? join_group(a, b) : null;
    if (!j) {
      L.push([`${N(a)} seeks out ${N(b)}, but ${N(b)} does not return the feeling.`, "a", "💔"]);
      return;
    }
    let gift;
    if (a.ration > 0) (a.ration--, b.ration++, (gift = "a ration"));
    else if (a.bottle > 0) (a.bottle--, b.bottle++, (gift = "a water bottle"));
    else (gain_food(b, 3), (a.food = Math.max(1, a.food - 3)), (gift = "some food"));
    L.push([
      `${N(a)} seeks out ${N(b)}, who does not feel the same but happily lets ${N(a)} tag along in ${j.nm} and hand over ${gift}.`,
      "a",
      "💔",
    ]);
    return;
  }

  if (rel === "lover" && !same) {
    if (BAN || ENDGAME || !can_join(a) || !can_join(b)) {
      const lft = !can_join(a) ? a : b;
      L.push([
        `${N(a)} and ${N(b)} find each other, but ${N(lft)} will not rejoin a group.`,
        "a",
        "💞",
      ]);
      return;
    }
    const j = join_group(a, b);
    if (!j) {
      L.push([`${N(a)} and ${N(b)} try to unite, but the group is full.`, "a", "💞"]);
      return;
    }
    L.push([`${N(a)} and ${N(b)} find each other and stay together as ${j.nm}.`, "a", "💞"]);
    return;
  }

  if (same) {
    let p =
      0.07 + (alive().length <= 6 ? 0.1 : 0) + Math.max(bt(a), bt(b)) / 100 - (fac ? 0.03 : 0);
    if (rel === "enemy") p += 0.35;
    else if (rel === "rival") p += 0.18;
    else if (rel === "lover") p *= 0.1;
    if (!NOB && (R > 3 || rel === "enemy") && chance(Math.max(0, Math.min(0.9, p)))) {
      const w = atk(a) + bt(a) / 10 + rnd(6) > atk(b) + bt(b) / 10 + rnd(6) ? a : b,
        l = w === a ? b : a;
      L.push([
        rel === "enemy" || rel === "rival"
          ? `${N(w)} finally strikes ${N(l)}, settling an old grudge.`
          : `${N(w)} turns on ${N(l)} in the middle of the night.`,
        "h",
        "🔪",
      ]);
      L.push({ kind: "fight", ...resolve_fight(w, l, null, null, { deadly: true, surprise: true }) });
      if (w.alive && l.alive) {
        w.g = gid++;
        w.left = true;
        L.push([`${N(w)} cannot finish it and leaves the group.`, "h", "🚶"]);
      }
      return;
    }
    if (!BAN && (ENDGAME || (rel !== "lover" && chance(0.1 + (rel ? 0.15 : 0))))) {
      a.g = gid++;
      a.left = true;
      L.push([`${N(a)} argues with ${N(b)} and walks off alone.`, "h", "🗣️💢"]);
      return;
    }
    gain_food(a, 3);
    gain_food(b, 3);
    L.push([
      `${N(a)} and ${N(b)} share a meal and keep watch in turns.`,
      "a",
      rel === "lover" ? "💞" : "🍽️",
    ]);
    return;
  }

  if (rel === "enemy" || (rel === "rival" && chance(0.6))) {
    L.push([`${N(a)} and ${N(b)} meet, and the old grudge boils over.`, "h", "💢"]);
    fight_joint(a, b, L);
    return;
  }

  const ap =
    0.3 +
    (ability_mod(a.cha) + ability_mod(b.cha)) * 0.015 +
    (trait_total(a, "ally") + trait_total(b, "ally")) / 200 +
    (fac ? 0.2 : 0);
  if (!BAN && !ENDGAME && can_join(a) && can_join(b) && chance(Math.max(0, Math.min(0.85, ap)))) {
    const sa = group_size(a.g),
      sb = group_size(b.g);
    if (sa + sb <= (MGS) && (!(sa > 1 && sb > 1) || chance(0.4))) {
      const j = join_group(a, b);
      L.push([
        sa === 1 && sb === 1
          ? `${N(a)} and ${N(b)} form ${j.nm}.`
          : sa > 1 && sb > 1
            ? `${j.nm} absorbs ${j.fn} after a truce.`
            : `${N(sb === 1 ? b : a)} joins ${j.nm}.`,
        "a",
        "🤝",
      ]);
      return;
    }
  }
  const ta = threat(a),
    tb = threat(b);

  /* A badly hurt aggressor may think twice, more so against someone more dangerous. */
  if (a.hp < a.mhp * 0.4) {
    const wary = Math.min(0.5, 0.15 + 0.02 * Math.max(0, tb - ta) + 0.3 * (0.4 - a.hp / a.mhp));
    if (chance(wary)) {
      L.push([`${N(a)} sizes up ${N(b)}, but is too hurt to risk it and backs off.`, "a", "🩹"]);
      return;
    }
  }

  /* Charisma: a charming target can talk the aggressor down before any blow lands. Each success
     against the same person halves the next chance (it recovers one step per 3 quiet rounds),
     and a past fight between them makes it harder. */
  const tk = talk_entry(a, b),
    eff = Math.max(0, tk.n - Math.floor((R - tk.last) / 3)),
    calm =
      Math.min(0.5, Math.max(0, 0.15 * ability_mod(b.cha) - 0.03 * ability_mod(a.cha) - (tk.fought ? 0.1 : 0))) *
      Math.pow(0.5, eff);
  if (chance(calm)) {
    tk.n++;
    tk.last = R;
    const gap = ta - tb;
    /* A far more dangerous aggressor simply laughs it off. */
    if (gap >= 5 && chance(Math.min(0.6, 0.06 * (gap - 4)))) {
      L.push([`${N(b)} tries to talk ${N(a)} down, but ${N(a)} laughs it off and attacks.`, "h", "😏"]);
      fight_joint(a, b, L);
      return;
    }
    /* The calm talk can turn into teaming up. Leaving a group for another is far harder. */
    if (!BAN && !ENDGAME && can_join(a) && can_join(b)) {
      const sa = group_size(a.g),
        sb = group_size(b.g),
        mx = MGS,
        tp = Math.min(
          0.5,
          Math.max(0, 0.5 * (0.3 + (ability_mod(a.cha) + ability_mod(b.cha)) * 0.015 + (trait_total(a, "ally") + trait_total(b, "ally")) / 200 + (fac ? 0.2 : 0))),
        );
      if (sa > 1 && sb > 1) {
        const val = (g) => alive().filter((t) => t.g === g).reduce((n, t) => n + threat(t), 0),
          lp = tp * 0.3 * Math.min(2, Math.max(0.2, 1 + bt(a) / 25));
        if (sb + 1 <= mx && val(b.g) + ta > val(a.g) && chance(lp)) {
          const old = GN[a.g] ? GN[a.g].n : "their group";
          if (!GN[b.g]) GN[b.g] = { n: "Team " + ++tc };
          a.g = b.g;
          a.left = true;
          L.push([`${N(b)} talks ${N(a)} down, and ${N(a)} leaves ${old} to join ${GN[b.g].n}.`, "a", "🤝"]);
          return;
        }
      } else if (chance(tp)) {
        const j = join_group(a, b);
        if (j) {
          L.push([
            sa === 1 && sb === 1
              ? `${N(b)} talks ${N(a)} down, and they end up forming ${j.nm}.`
              : `${N(b)} talks ${N(a)} down, and ${N(sb === 1 ? b : a)} joins ${j.nm}.`,
            "a",
            "🤝",
          ]);
          return;
        }
      }
    }
    L.push([`${N(a)} sizes up ${N(b)}, but ${N(b)} talks ${N(a)} down and they part ways.`, "a", "🗣️"]);
    return;
  }

  const dv = DUO.filter((e) => e.on);
  if (dv.length && chance(0.3)) {
    run_duo(pick_weighted(dv, b), a, b, L);
    return;
  }
  fight_joint(a, b, L);
}