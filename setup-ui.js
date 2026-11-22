/* setup-ui.js: Setup screen: team chips, contestant cards, stat editing, theme, mode toggle. */

const contestant_count = () => Math.max(4, Math.min(48, +$("#cnt").value || 24));

function sync() {
  const n = contestant_count();
  $("#cnt").value = n;
  while (P.length < n) P.push(new_contestant());
  draw_setup();
}

function draw_teams() {
  $("#tlist").innerHTML =
    TN.map(
      (n, j) =>
        `<span class="chip" style="--c:${col(j)}">
      <input class="tn" maxlength="24" data-tn="${j}" value="${esc(n)}" aria-label="Team name">
      <button class="ghost" data-rm="${j}" aria-label="Remove team" title="Remove team">×</button>
    </span>`,
    ).join("") || `<span class="meta">No teams yet.</span>`;
}

function update_help() {
  $("#statHelp").hidden = OPEN.size === 0;
  $("#stg").textContent = OPEN.size ? "Hide all stats" : "Show all stats";
}

function draw_people() {
  const opts = (sel) =>
    `<option value="-1"${sel < 0 ? " selected" : ""}>Solo</option>` +
    TN.map(
      (n, j) =>
        `<option value="${j}"${sel === j ? " selected" : ""}>${esc(n || "Team " + (j + 1))}</option>`,
    ).join("");

  const inp =
    (p, i) =>
    ([k, ic, l, s]) =>
      `<label title="${esc(l)}">${ic} ${s}<input type="number" min="${SR[k][0]}" max="${SR[k][1]}" data-s="${k}" data-i="${i}" value="${p[k]}" aria-label="${esc(l)}"></label>`;

  $("#teams").innerHTML = P.slice(0, contestant_count())
    .map((p, i) => {
      const op = OPEN.has(i);
      return `
      <div class="team" style="--c:${p.team >= 0 ? col(p.team) : "var(--line)"}">
        <div class="row" style="margin-top:0">
          <label class="avl" title="Choose a photo">
            ${av(p)}
            <input type="file" accept="image/*" hidden data-img="${i}">
          </label>
          <input class="nm" maxlength="24" data-n="${i}" value="${esc(p.name)}" aria-label="Name">
          <select data-t="${i}" aria-label="Team">${opts(p.team)}</select>
        </div>
        <button class="ghost sbtn" data-ts="${i}" aria-expanded="${op}">${op ? "Hide stats" : "Edit stats and items"}</button>
        <div class="sp"${op ? "" : " hidden"}>
          <div class="stats">${STATS.slice(0, 6).map(inp(p, i)).join("")}</div>${extra(p, i)}
          <div class="stats">
            ${STATS.slice(6).map(inp(p, i)).join("")}
            <label title="Starting weapon">🗡 Weapon
              <select data-w="${i}" aria-label="Starting weapon">
                <option value="">None</option>
                ${WPN.map((w) => `<option${p.weapon === w ? " selected" : ""}>${w}</option>`).join("")}
              </select>
            </label>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
  update_help();
}

function draw_setup() {
  draw_teams();
  draw_people();
  save_soon();
}

function update_options() {
  document.querySelectorAll("#teams select[data-t]").forEach((s) =>
    [...s.options].forEach((o) => {
      const j = +o.value;
      if (j >= 0) o.textContent = TN[j] || "Team " + (j + 1);
    }),
  );
}

$("#tlist").addEventListener("input", (e) => {
  const j = e.target.dataset.tn;
  if (j !== undefined) {
    TN[+j] = e.target.value;
    update_options();
  }
});

$("#tlist").addEventListener("click", (e) => {
  const b = e.target.closest("[data-rm]");
  if (!b) return;
  const k = +b.dataset.rm;
  TN.splice(k, 1);
  P.forEach((p) => {
    if (p.team === k) p.team = -1;
    else if (p.team > k) p.team--;
  });
  draw_setup();
});

$("#teams").addEventListener("click", (e) => {
  const b = e.target.closest("[data-ts]");
  if (!b) return;
  const i = +b.dataset.ts,
    panel = b.nextElementSibling,
    open = panel.hidden;
  panel.hidden = !open;
  if (open) OPEN.add(i);
  else OPEN.delete(i);
  b.textContent = open ? "Hide stats" : "Edit stats and items";
  b.setAttribute("aria-expanded", open);
  update_help();
});

$("#stg").onclick = () => {
  if (OPEN.size) OPEN.clear();
  else for (let i = 0; i < contestant_count(); i++) OPEN.add(i);
  draw_people();
};

$("#teams").addEventListener("input", (e) => {
  const d = e.target.dataset;
  if (d.n !== undefined) P[+d.n].name = e.target.value;
  else if (d.fac !== undefined) P[+d.fac].fac = e.target.value.slice(0, 20);
  else if (d.s && e.target.value !== "") {
    P[+d.i][d.s] = clamp_stat(d.s, e.target.value);
    if (d.s === "con") {
      const m = e.target.closest(".sp").querySelector(".mhp");
      if (m) m.textContent = "❤ Max HP " + (50 + 5 * P[+d.i].con);
    }
  }
});

$("#teams").addEventListener("change", (e) => {
  const d = e.target.dataset;
  if (d.s) {
    const v = clamp_stat(d.s, e.target.value);
    P[+d.i][d.s] = v;
    e.target.value = v;
    save_soon();
    return;
  }
  if (d.job !== undefined) {
    P[+d.job].job = e.target.value;
    save_soon();
    return;
  }
  if (d.tr !== undefined) {
    const p = P[+d.i];
    if (e.target.checked) {
      if (p.traits.length >= 3) {
        e.target.checked = false;
        return;
      }
      p.traits.push(d.tr);
    } else p.traits = p.traits.filter((x) => x !== d.tr);
    save_soon();
    return;
  }
  if (d.w !== undefined) {
    P[+d.w].weapon = WPN.includes(e.target.value) ? e.target.value : "";
    save_soon();
    return;
  }
  if (d.t !== undefined) {
    P[+d.t].team = +e.target.value;
    draw_people();
    save_soon();
    return;
  }
  const f = e.target.files && e.target.files[0];
  if (d.img === undefined || !f) return;
  set_photo_from_file(+d.img, f);
});

$("#cnt").onchange = sync;

$("#addt").onclick = () => {
  TN.push("Team " + (TN.length + 1));
  draw_setup();
};

$("#autof").onclick = () => {
  const z = +$("#size").value,
    n = contestant_count();
  TN.length = 0;
  for (let j = 0; j < Math.ceil(n / z); j++) TN.push("Team " + (j + 1));
  P.forEach((p, i) => (p.team = i < n ? Math.floor(i / z) : -1));
  draw_setup();
};

$("#solo").onclick = () => {
  P.forEach((p) => (p.team = -1));
  draw_setup();
};

$("#rnd").onclick = () => {
  const used = new Set();
  P.forEach((p) => used.add((p.name = random_name(used))));
  draw_setup();
};

$("#rst").onclick = () => {
  P.forEach((p) => Object.assign(p, roll_combat()));
  draw_setup();
};

function apply_theme() {
  const r = document.documentElement;
  if (THEME === "auto") delete r.dataset.theme;
  else r.dataset.theme = THEME;
  $("#theme").textContent = "Theme: " + THEME[0].toUpperCase() + THEME.slice(1);
}

$("#theme").onclick = () => {
  THEME = { auto: "light", light: "dark", dark: "auto" }[THEME];
  apply_theme();
  save_soon();
};

function update_mode_ui() {
  const grp = $("#mode").value === "grp";
  $("#egWrap").hidden = grp;
}

$("#mode").onchange = update_mode_ui;

$("#setup").addEventListener("change", save_soon);

$("#setup").addEventListener("input", save_soon);

/* ---------- setup: per-contestant faction, job and traits ---------- */
const describe = (x) =>
  TF.filter(([k]) => x[k])
    .map(([k]) => `${TLAB[k]} ${signed(x[k])}`)
    .join(", ") || "no modifiers";

const extra = (p, i) => `
  <div class="stats">
    <span class="meta mhp" title="Max HP = 50 + 5 x CON">❤ Max HP ${50 + 5 * p.con}</span><label title="Same-faction contestants coordinate better">🏷 Faction<input class="nm fac" maxlength="20" data-fac="${i}" value="${esc(p.fac)}" placeholder="none"></label>
    <label title="Job">💼 Job<select data-job="${i}"><option value="">None</option>${TRAITS.filter(
      (x) => x.kind === "job",
    )
      .map(
        (x) =>
          `<option value="${esc(x.id)}"${p.job === x.id ? " selected" : ""}>${esc(x.ic + " " + x.n)}</option>`,
      )
      .join("")}</select></label>
  </div>
  <div class="tchips">${TRAITS.filter((x) => x.kind !== "job")
    .map(
      (x) =>
        `<label class="tc" title="${esc(describe(x))}"><input type="checkbox" data-tr="${esc(x.id)}" data-i="${i}"${p.traits.includes(x.id) ? " checked" : ""}>${esc(x.ic + " " + x.n)}</label>`,
    )
    .join("")}</div>`;