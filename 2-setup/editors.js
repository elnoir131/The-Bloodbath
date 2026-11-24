/* editors.js: Setup editors: solo/duo/disaster events, traits and jobs, statuses, relationships. */

const LST = (k) => (k === "s" ? SOLO : k === "d" ? DUO : DIS);

const BADTOK = /\{(?!a\}|b\}|w\})[^}]*\}/;

function draw_events() {
  const row = (e, i, k) => `
    <div class="erow" data-k="${k}" data-i="${i}">
      <input type="checkbox" data-f="on"${e.on ? " checked" : ""} aria-label="Enabled">
      <input class="nm ei" maxlength="8" data-f="ic" value="${esc(e.ic)}" aria-label="Icon">
      <input class="nm et${BADTOK.test(e.t) ? " bad" : ""}" maxlength="160" data-f="t" value="${esc(e.t)}" aria-label="Event text">
      ${
        k === "z"
          ? `<input class="nm et${BADTOK.test(e.v || "") ? " bad" : ""}" maxlength="160" data-f="v" value="${esc(e.v)}" placeholder="Victim line, e.g. {a} is caught" aria-label="Victim line">
           <input class="nm ei" type="number" min="0" max="48" data-f="n" value="${e.n}" aria-label="How many people">`
          : ""
      }
      <label class="nl" title="Base chance (%)">%<input type="number" min="0" max="100" data-f="ch" value="${e.ch ?? 100}"></label>
      <select data-f="fx" aria-label="Effect">
        ${fx_list(k)
          .map(([v, l]) => `<option value="${v}"${e.fx === v ? " selected" : ""}>${l}</option>`)
          .join("")}
      </select>
      <button class="ghost" data-del aria-label="Delete event">×</button>
    </div>
  `;

  $("#evS").innerHTML = SOLO.map((e, i) => row(e, i, "s")).join("");
  $("#evD").innerHTML = DUO.map((e, i) => row(e, i, "d")).join("");
  $("#evZ").innerHTML = DIS.map((e, i) => row(e, i, "z")).join("");
  save_soon();
}

function handle_event_change(e) {
  const r = e.target.closest(".erow"),
    f = e.target.dataset.f;
  if (!r || !f) return;

  const v =
    f === "on"
      ? e.target.checked
      : f === "n" || f === "ch"
        ? Math.max(0, Math.min(f === "ch" ? 100 : 48, Math.round(+e.target.value || 0)))
        : e.target.value;
  LST(r.dataset.k)[+r.dataset.i][f] = v;

  if ((f === "n" || f === "ch") && e.type === "change") e.target.value = v;
  if (f === "t" || f === "v") {
    const bad = BADTOK.test(v);
    e.target.classList.toggle("bad", bad);
    e.target.title = bad ? "Unknown placeholder. Use {a}, {b} or {w}." : "";
  }
}

["#evS", "#evD", "#evZ"].forEach((sel) => {
  const el = $(sel);
  if (el) {
    el.addEventListener("input", handle_event_change);
    el.addEventListener("change", handle_event_change);
    el.addEventListener("click", (e) => {
      const r = e.target.closest(".erow");
      if (r && e.target.dataset.del !== undefined) {
        LST(r.dataset.k).splice(+r.dataset.i, 1);
        draw_events();
      }
    });
  }
});

$("#addS").onclick = () => {
  SOLO.push({ t: "{a} does something unexpected.", fx: "none", ic: "❓", on: true });
  draw_events();
};

$("#addD").onclick = () => {
  DUO.push({ t: "{a} and {b} cross paths.", fx: "none", ic: "❓", on: true });
  draw_events();
};

$("#addZ").onclick = () => {
  DIS.push({
    t: "Something strange happens in the arena.",
    v: "{a} is caught up in it.",
    fx: "none",
    n: 1,
    ic: "❓",
    on: true,
  });
  draw_events();
};

$("#resetEv").onclick = () => {
  SOLO = JSON.parse(JSON.stringify(DEF_SOLO));
  DUO = JSON.parse(JSON.stringify(DEF_DUO));
  DIS = JSON.parse(JSON.stringify(DEF_DIS));
  draw_events();
};

const fx_list = (k) => [
  ...(k === "s" ? SFX : k === "d" ? DFX : ZFX),
  ...STATUS.map((s) => [
    "st:" + s.id,
    (k === "s" ? "Gain " : k === "d" ? "Inflict on second: " : "Status on N random: ") +
      s.ic +
      " " +
      s.n,
  ]),
];

/* ---------- editors for traits, statuses and relationships ---------- */
const nrow = (e, i, k, F) => `<div class="erow" data-k="${k}" data-i="${i}">
  <input class="nm ei" maxlength="8" data-f="ic" value="${esc(e.ic)}" aria-label="Icon">
  <input class="nm et" maxlength="24" data-f="n" value="${esc(e.n)}" aria-label="Name">
  ${k === "t" ? `<select data-f="kind" aria-label="Type"><option value="trait"${e.kind !== "job" ? " selected" : ""}>Trait</option><option value="job"${e.kind === "job" ? " selected" : ""}>Job</option></select>` : ""}
  ${F.map(([f, lo, hi]) => `<label class="nl" title="${TL[f]}">${TLAB[f]}<input type="number" min="${lo}" max="${hi}" data-f="${f}" value="${e[f]}"></label>`).join("")}
  <button class="ghost" data-del aria-label="Delete">×</button></div>`;

function rrow(r, i) {
  const o = P.slice(0, contestant_count())
    .map((p, j) => `<option value="${j}">${esc(p.name || "#" + (j + 1))}</option>`)
    .join("");
  const sel = (v) => o.replace(`value="${v}"`, `value="${v}" selected`);
  return `<div class="erow" data-k="r" data-i="${i}"><select data-f="a" aria-label="First">${sel(r.a)}</select>
    <select data-f="type" aria-label="Relationship">${Object.keys(RN)
      .map((x) => `<option value="${x}"${r.type === x ? " selected" : ""}>${RN[x]}</option>`)
      .join("")}</select>
    <select data-f="b" aria-label="Second">${sel(r.b)}</select>
    <label class="nl" title="Ticked: both feel it. Unticked: only the first feels it toward the second."><input type="checkbox" data-f="mutual"${r.mutual !== false ? " checked" : ""}>both ways</label><button class="ghost" data-del aria-label="Delete">×</button></div>`;
}

function draw_tsr() {
  $("#evT").innerHTML = TRAITS.map((e, i) => nrow(e, i, "t", TF)).join("");
  $("#evX").innerHTML = STATUS.map((e, i) => nrow(e, i, "x", SF)).join("");
  $("#evR").innerHTML =
    REL.map((r, i) => rrow(r, i)).join("") || `<p class="meta">No relationships yet.</p>`;
}

const TSL = (k) => (k === "t" ? TRAITS : k === "x" ? STATUS : REL);

function handle_tsr_change(e) {
  const r = e.target.closest(".erow"),
    f = e.target.dataset.f;
  if (!r || !f) return;
  const k = r.dataset.k,
    o = TSL(k)[+r.dataset.i],
    F = k === "t" ? TF : SF;
  let v = e.target.value;
  const sp = F.find((x) => x[0] === f);
  if (k === "r") v = f === "type" ? v : f === "mutual" ? e.target.checked : +v;
  else if (sp) {
    v = clamp_int(v, sp[1], sp[2]);
    if (e.type === "change") e.target.value = v;
  }
  o[f] = v;
  if (k === "t" && e.type === "change") draw_people();
  save_soon();
}

["#evT", "#evX", "#evR"].forEach((sel) => {
  const el = $(sel);
  if (!el) return;
  el.addEventListener("input", handle_tsr_change);
  el.addEventListener("change", handle_tsr_change);
  el.addEventListener("click", (e) => {
    const r = e.target.closest(".erow");
    if (!r || e.target.dataset.del === undefined) return;
    const k = r.dataset.k,
      i = +r.dataset.i,
      id = k === "t" ? TRAITS[i].id : null;
    TSL(k).splice(i, 1);
    if (id)
      P.forEach((p) => {
        p.traits = p.traits.filter((x) => x !== id);
        if (p.job === id) p.job = "";
      });
    draw_tsr();
    draw_people();
    save_soon();
  });
});

const add_new_entry = (k, o) => () => {
  TSL(k).push(o());
  draw_tsr();
  draw_people();
  save_soon();
};

$("#addT").onclick = add_new_entry("t", () => ({
  id: unique_id(),
  n: "New trait",
  ic: "⭐",
  kind: "trait",
  ...T0,
}));

$("#addJ").onclick = add_new_entry("t", () => ({
  id: unique_id(),
  n: "New job",
  ic: "💼",
  kind: "job",
  ...T0,
}));

$("#addX").onclick = add_new_entry("x", () => ({
  id: unique_id(),
  n: "New status",
  ic: "✨",
  dmg: 0,
  atk: 0,
  spd: 0,
  wit: 0,
  int: 0,
  dur: 2,
}));

$("#addR").onclick = add_new_entry("r", () => ({ a: 0, b: 1, type: "rival", mutual: true }));

$("#rndR").onclick = () => {
  const n = contestant_count(),
    types = ["lover", "rival", "rival", "enemy"];
  REL = [];
  for (let k = 0; k < Math.max(1, Math.floor(n / 6)); k++) {
    const a = Math.floor(Math.random() * n);
    let b = Math.floor(Math.random() * n);
    if (b === a) b = (a + 1) % n;
    REL.push({ a, b, type: types[Math.floor(Math.random() * types.length)], mutual: true });
  }
  draw_tsr();
  save_soon();
};

$("#resetTS").onclick = () => {
  TRAITS = deep_clone(DEF_TR);
  STATUS = deep_clone(DEF_ST);
  REL = [];
  P.forEach((p) => {
    p.traits = [];
    p.job = "";
  });
  draw_tsr();
  draw_people();
  save_soon();
};

document.querySelector(".evbox").addEventListener("toggle", draw_tsr);