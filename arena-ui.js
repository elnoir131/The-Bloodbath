/* arena-ui.js: Match screen: start, roster, log pages, sponsor/disaster buttons, download log. */

/* ---------- match ---------- */
let PG = [],
  PI = 0,
  VIEW_SNAPSHOT = null;

function start(sd) {
  const raw = $("#seed").value.trim();
  SEED = sd || (raw ? (/^\d{1,10}$/.test(raw) && +raw <= 4294967295 ? +raw : hash_string(raw)) : new_seed());
  rng = mulberry32(SEED);

  T = P.slice(0, contestant_count()).map((p, i) => ({
    id: i,
    n: p.name.trim() || "Nameless",
    img: p.img,
    team: p.team,
    g: !$("#ban").checked && p.team >= 0 ? p.team : 100 + i,
    mhp: 50 + 5 * p.con,
    hp: 50 + 5 * p.con,
    left: false,
    str: p.str,
    dex: p.dex,
    con: p.con,
    int: p.int,
    wis: p.wis,
    cha: p.cha,
    atk: Math.max(1, Math.min(10, 5 + ability_mod(p.str))),
    spd: Math.max(1, Math.min(10, 5 + ability_mod(p.dex))),
    wit: Math.max(1, Math.min(10, 5 + ability_mod(p.wis))),
    traits: [...p.traits],
    job: p.job,
    fac: p.fac.trim(),
    fk: p.fac.trim().toLowerCase(),
    fx: [],
    k: 0,
    dmg: 0,
    alive: true,
    w: p.weapon || null,
    water: p.water,
    food: p.food,
    bottle: p.bottle,
    ration: p.ration,
    kit: p.kit,
    inf: false,
    ex: false,
    dz: false,
    hg: false,
    vd: [],
    round: undefined,
    why: "",
  }));

  TM = TN.map((n, j) => ({ n: n.trim() || "Team " + (j + 1) }));
  R = 0;
  dead = [];
  pend = [];
  done = false;
  gid = 1000;
  FIN = false; $("#next").textContent = "Next round";
  ENDGAME = false;
  ENDGAME_ANNOUNCED = false;
  RT = REL.filter((r) => r.a < T.length && r.b < T.length).map((r) => ({ ...r }));
  XL = [];
  POOL = [];
  M = $("#mode").value;
  BAN = $("#ban").checked;
  NOB = $("#nob").checked;
  LOCKLEAVE = $("#lockleave").checked;
  DISWIPE = $("#diswipe").checked;
  FAIRN = num($("#fairn").value, 0, 12);
  QUIETN = num($("#quiet").value, 0, 10);
  QUIET = 0;
  TALK = {};
  COMBAT = false;
  GN = {};
  TM.forEach((m, j) => (GN[j] = { n: m.n }));
  tc = TM.length;

  OPENR = new Set();
  SHOWALL = false;
  $("#dtog").textContent = "Show details";
  $("#setup").hidden = true;
  $("#arena").hidden = false;
  PG = [];
  PI = 0;
  VIEW_SNAPSHOT = null;
  show_page(false);

  $("#next").disabled = $("#spB").disabled = $("#dsB").disabled = false;
  $("#dsT").innerHTML =
    '<option value="r">Random disaster</option>' +
    DIS.map((d, i) => `<option value="${i}">${esc(d.ic + " " + d.t.slice(0, 38))}</option>`).join(
      "",
    );

  render();
}

const fmt = (x) =>
  esc(String(x)).replace(/\u0001(\d+)\u0002/g, (m, k) => (T[k] ? `<b class="hl">${esc(T[k].n)}</b>` : ""));

const ids = (x) => [...new Set([...x.matchAll(/\u0001(\d+)\u0002/g)].map((m) => +m[1]))];

const icon = (x) => {
  for (const [r, e] of ICONS) if (r.test(x)) return e;
  return "";
};

function pics(x, e0) {
  const i = ids(x),
    e = e0 || icon(x),
    b = e ? `<span class="ic" aria-hidden="true">${esc(e)}</span>` : "";
  if (!i.length && !b) return "";
  const h =
    i.length === 2
      ? av(T[i[0]]) + b + av(T[i[1]])
      : i
          .slice(0, 12)
          .map((k) => av(T[k]))
          .join("") + b;
  return `<div class="pics${i.length > 4 ? " many" : ""}">${h}</div>`;
}

function summary_html(s) {
  if (!s) return "";
  const nm = (a) => a.map((k) => `<b class="hl">${esc(T[k].n)}</b>`).join(", ");
  const parts = [`👥 ${s.alive} alive`];
  if (s.dead.length) parts.push(`💀 Fallen: ${nm(s.dead)}`);
  if (s.low.length) parts.push(`🩸 Low: ${nm(s.low)}`);
  if (s.fought.length) parts.push(`⚔ Fought: ${nm(s.fought)}`);
  return `<div class="rsum">${parts.join("<br>")}</div>`;
}

function summary_text(s) {
  if (!s) return "";
  const nm = (a) => a.map((k) => T[k].n).join(", ");
  const parts = [`${s.alive} alive`];
  if (s.dead.length) parts.push("fallen: " + nm(s.dead));
  if (s.low.length) parts.push("low: " + nm(s.low));
  if (s.fought.length) parts.push("fought: " + nm(s.fought));
  return "_" + parts.join(" · ") + "_";
}

function show_page(live) {
  const p = PG[PI];
  $("#log").setAttribute("aria-live", live ? "polite" : "off");
  $("#log").innerHTML = p
    ? p.raw ||
      `<div class="rd"><h3>${p.h}</h3>` + summary_html(p.sum) +
        p.L.map(([t, c, e]) => `<div class="ev ${c}">${pics(t, e)}<div>${fmt(t)}</div></div>`).join(
          "",
        ) +
        "</div>"
    : "";
  $("#log").scrollTop = 0;
  $("#pgl").textContent = p ? `${p.h} · ${PI + 1} of ${PG.length}` : "No rounds yet";
  $("#pp").disabled = PI <= 0;
  $("#pn").disabled = $("#pl").disabled = PI >= PG.length - 1;

  VIEW_SNAPSHOT = !live && p && p.snap ? p.snap : null;
  render();
}

function take_snap() {
  return T.map((t) => ({
    alive: t.alive,
    hp: t.hp,
    k: t.k,
    dmg: t.dmg,
    fx: t.fx.map((x) => ({ ...x })),
    water: t.water,
    food: t.food,
    bottle: t.bottle,
    ration: t.ration,
    kit: t.kit,
    inf: t.inf,
    dz: t.dz,
    hg: t.hg,
    vd: t.vd.map((x) => ({ ...x })),
    g: t.g,
    left: t.left,
    round: t.round,
    why: t.why,
    w: t.w,
  }));
}

function add_log(h, L, raw, txt, sum) {
  const f = PI >= PG.length - 1;
  const snap = take_snap();
  PG.push({ h, L, raw, txt, snap, sum });
  if (f) PI = PG.length - 1;
  show_page(true);
}

$("#pp").onclick = () => {
  if (PI > 0) {
    PI--;
    show_page(false);
  }
};

$("#pn").onclick = () => {
  if (PI < PG.length - 1) {
    PI++;
    show_page(false);
  }
};

$("#pl").onclick = () => {
  PI = PG.length - 1;
  show_page(false);
};

$("#rtog").onclick = () => {
  const h = ($("#rp").hidden = !$("#rp").hidden);
  document.querySelector(".grid").classList.toggle("one", h);
  $("#rtog").textContent = h ? "Show contestants" : "Hide contestants";
};

$("#dtog").onclick = () => {
  SHOWALL = !SHOWALL;
  $("#dtog").textContent = SHOWALL ? "Hide details" : "Show details";
  render();
};

function sponsor() {
  const t = T[+$("#spT").value];
  if (done || FIN || !t || !t.alive) return;
  const g = $("#spG").value,
    L = [];
  if (g === "food") {
    t.ration++;
    L.push([`A sponsor parachutes a food basket to ${N(t)}.`, "a", "🎁"]);
  }
  if (g === "water") {
    t.bottle += 2;
    L.push([`A sponsor drops two bottles of clean water to ${N(t)}.`, "a", "🚰"]);
  }
  if (g === "heal") {
    heal(t, 0.45);
    t.inf = false;
    L.push([`A sponsor sends ${N(t)} a medical kit.`, "a", "🏥"]);
  }
  if (g === "weapon") {
    t.w = pick(WPN_STANDARD);
    L.push([`A sponsor sends ${N(t)} a ${t.w}.`, "a", "🎁"]);
  }
  drop("Sponsor drop", L);
  render();
}

function drop(h, L, fell) {
  const lp = PG[PG.length - 1];
  if (lp && !lp.raw) {
    lp.L.push(...L);
    if (lp.sum) {
      lp.sum.dead.push(...(fell || []));
      lp.sum.low = alive().filter((t) => t.hp < t.mhp * 0.3).map((t) => t.id);
      lp.sum.alive = alive().length;
    }
    lp.snap = take_snap();
    if (PI === PG.length - 1) show_page(true);
  } else {
    add_log(h, L);
  }
}

function disaster() {
  if (done || FIN) return;
  const v = $("#dsT").value,
    d = v === "r" ? pick(DIS) : DIS[+v],
    L = [];
  if (!d) return;
  run_disaster(d, L);
  L.push(...XL.splice(0));
  const fell = pend.map((t) => t.id);
  const c = cannon(pend.splice(0));
  if (c) L.push(c);
  drop("Disaster", L, fell);
  if (over()) mark_end();
  render();
}

function render() {
  const t_list = VIEW_SNAPSHOT ? T.map((orig, i) => ({ ...orig, ...VIEW_SNAPSHOT[i] })) : T;
  const al = t_list.filter((t) => t.alive),
    gs = {};
  al.forEach((t) => (gs[t.g] = gs[t.g] || []).push(t));

  const teams = Object.keys(gs).filter((g) => gs[g].length > 1),
    solos = al.filter((t) => gs[t.g].length === 1);
  const dead_list = t_list.filter((t) => !t.alive);

  const detail = (t) =>
    t.alive
      ? `<span class="meta dt">${abil(t)}</span><span class="meta dt">⚔${atk(t)} 💨${spd(t)} 🧠${wit(t)} · ❤${Math.max(0, Math.round(t.hp))}/${t.mhp} · 💧${+t.water.toFixed(1)} 🍖${Math.round(t.food)}${t.inf ? " · 🦠 infected" : ""}${t.vd && t.vd.length ? " · 🗡 vendetta: " + t.vd.map((v) => esc(T[v.k].n)).join(", ") : ""}${t.left ? " · left a team" : ""}</span><span class="meta dt">🍶${t.bottle} 🥫${t.ration} 🩹${t.kit}</span>`
      : `<span class="meta dt">Out in round ${t.round}: ${esc(t.why)}</span>`;

  const row = (t) => {
    const op = SHOWALL || OPENR.has(t.id);
    return `
      <div class="t ${t.alive ? "" : "d"}${op ? " o" : ""}" data-id="${t.id}" tabindex="0" role="button" aria-expanded="${op}">
        ${av(t)}
        <div class="x">
          <b>${esc(t.n)}</b>
          <div class="hp"><i style="width:${Math.max(0, (100 * t.hp) / t.mhp)}%"></i></div>
          <span class="meta">${t.alive ? esc(t.w || "unarmed") : "fallen"} · ${t.k} kill${t.k === 1 ? "" : "s"}${t.alive ? " " + sx(t) : ""}</span>
          ${detail(t)}
        </div>
      </div>
    `;
  };

  const blk = (h, c, ms, o) =>
    `<div class="rt ${o || ""}" style="--c:${c}"><h4>${h}</h4>${ms.map(row).join("")}</div>`;

  $("#roster").innerHTML =
    teams.map((g) => blk(esc((GN[g] || { n: "Team" }).n), col(+g), gs[g])).join("") +
    (solos.length ? blk("Solo", "var(--line)", solos) : "") +
    (dead_list.length ? blk("Fallen", "var(--dead)", [...dead_list].reverse(), "out") : "");

  $("#stat").textContent = VIEW_SNAPSHOT
    ? `Viewing past round · ${al.length} were alive`
    : `Round ${R} · ${alive().length} of ${T.length} alive · seed ${SEED}`;

  const real_al = alive();
  const cur = $("#spT").value;
  $("#spT").innerHTML = real_al.map((t) => `<option value="${t.id}">${esc(t.n)}</option>`).join("");
  if (cur && T[+cur] && T[+cur].alive) $("#spT").value = cur;
}

function toggle_row(el) {
  if (!el) return;
  const id = +el.dataset.id;
  if (OPENR.has(id)) OPENR.delete(id);
  else OPENR.add(id);
  render();
  const f = document.querySelector(`#roster .t[data-id="${id}"]`);
  if (f) f.focus();
}

$("#roster").addEventListener("click", (e) => toggle_row(e.target.closest(".t")));

$("#roster").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("t")) {
    e.preventDefault();
    toggle_row(e.target);
  }
});

/* Human-readable setup section, so a log is understandable without the original setup file. */
function setup_text() {
  const m = setup_snapshot(true);
  const cell = (x) => String(x).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const tr = (id) => (m.TRAITS.find((x) => x.id === id) || {}).n || id;
  const rules = [
    m.mode === "grp" ? `last group can share (max group ${m.mgs})` : `one survivor (endgame alert at ${m.endgame})`,
    m.ban && "teaming banned",
    m.nob && "betrayal banned",
    m.lockleave && "leavers cannot rejoin",
    m.diswipe && "disasters can kill everyone",
    `fair fight at ${m.fairn}`,
    `Gamemakers after ${m.quiet} quiet rounds`,
  ].filter(Boolean);
  const out = ["## Setup", "", "Rules: " + rules.join(", ") + ".", ""];
  out.push("| # | Name | Team | STR | DEX | CON | INT | WIS | CHA | Weapon | Job / traits | Faction |");
  out.push("|---|------|------|-----|-----|-----|-----|-----|-----|--------|--------------|---------|");
  m.P.forEach((p, i) =>
    out.push(
      `| ${i + 1} | ${cell(p.name || "Nameless")} | ${p.team >= 0 && m.TN[p.team] ? cell(m.TN[p.team]) : "solo"} | ${p.str} | ${p.dex} | ${p.con} | ${p.int} | ${p.wis} | ${p.cha} | ${p.weapon || "-"} | ${cell([p.job && tr(p.job), ...p.traits.map(tr)].filter(Boolean).join(", ") || "-")} | ${cell(p.fac || "-")} |`,
    ),
  );
  const rel = m.REL.filter((r) => r.a < m.P.length && r.b < m.P.length);
  if (rel.length) {
    out.push("", "Relationships:");
    rel.forEach((r) => {
      const A = m.P[r.a].name || "#" + (r.a + 1),
        B = m.P[r.b].name || "#" + (r.b + 1);
      out.push(r.mutual === false ? `- ${A} → ${B}: ${RN[r.type] || r.type} (one-sided)` : `- ${A} / ${B}: ${RN[r.type] || r.type}`);
    });
  }
  return out.concat("");
}

function export_log() {
  const nm = (x) => x.replace(/\u0001(\d+)\u0002/g, (m, k) => T[k].n);
  const out = [`# The Bloodbath (seed ${SEED})`, ""];
  PG.forEach((p) => {
    out.push(`## ${p.h}`);
    if (p.sum) out.push(summary_text(p.sum), "");
    if (p.txt) out.push(p.txt);
    else p.L.forEach(([t]) => out.push("- " + nm(t.replace(/<[^>]+>/g, ""))));
    out.push("");
  });
  out.push(...setup_text());
  download_file(`arena-seed-${SEED}.md`, out.join("\n"), "text/markdown");
}

$("#go").onclick = () => start();

$("#spB").onclick = sponsor;

$("#next").onclick = step;

$("#dsB").onclick = disaster;

$("#dl").onclick = export_log;

$("#replay").onclick = () => start(SEED);

/* Link that pre-fills the seed. The same seed only replays the same match with the same setup,
   so share the exported setup file too. */
$("#share").onclick = async () => {
  const url = location.href.split(/[?#]/)[0] + "?seed=" + SEED,
    b = $("#share");
  try {
    await navigator.clipboard.writeText(url);
    b.textContent = "Link copied";
  } catch (e) {
    prompt("Copy this link:", url);
  }
  setTimeout(() => (b.textContent = "Copy seed link"), 1500);
};

/* Dev/balance helper (use from the console): play the current match to the end. */
function sim_to_end() {
  for (let g = 0; !done && g < 500; g++) step();
}

$("#reset").onclick = () => {
  rng = Math.random;
  $("#arena").hidden = true;
  $("#setup").hidden = false;
};

const abil = (t) =>
  ["str", "dex", "con", "int", "wis", "cha"]
    .map((k) => `${k.toUpperCase()} ${t[k]} (${signed(ability_mod(t[k]))})`)
    .join(" · ") +
  (t.traits.length || t.job || t.fac
    ? "<br>" +
      [
        t.job && TR(t.job) ? esc(TR(t.job).ic) + " " + esc(TR(t.job).n) : "",
        ...t.traits.map((id) => (TR(id) ? esc(TR(id).ic) + " " + esc(TR(id).n) : "")),
        t.fac ? "🏷 " + esc(t.fac) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "") +
  (t.fx.length
    ? "<br>" +
      t.fx
        .map((s) => (SD(s.id) ? esc(SD(s.id).ic) + " " + esc(SD(s.id).n) + " (" + s.left + ")" : ""))
        .join(" · ")
    : "");

const sx = (t) => t.fx.map((s) => esc((SD(s.id) || {}).ic || "")).join("");