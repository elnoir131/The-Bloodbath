/* storage.js: localStorage save/load, export/import setup JSON, clear saved data. */

/* ---------- persistence ---------- */
const KEY = "Bloodbath-Setup";

let st = null,
  nosave = false;

function save() {
  if (nosave) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ver: 14,
        P,
        TN,
        SOLO,
        DUO,
        DIS,
        TRAITS,
        STATUS,
        REL,
        theme: THEME,
        cnt: $("#cnt").value,
        size: $("#size").value,
        mode: $("#mode").value,
        ban: $("#ban").checked,
        nob: $("#nob").checked,
        lockleave: $("#lockleave").checked,
        diswipe: $("#diswipe").checked,
        mgs: $("#mgs").value,
        endgame: $("#endgame").value,
        dim: $("#dim").value,
        seed: $("#seed").value,
        bg: current_bg,
      }),
    );
  } catch (e) {
    console.warn("Could not save data. LocalStorage might be full.", e);
  }
}

const save_soon = () => {
  clearTimeout(st);
  st = setTimeout(save, 300);
};

const IMG = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

function apply_setup(d) {
  {
    if (!d || typeof d !== "object") return;
    const mig = d.ver < 12;

    if (Array.isArray(d.TN)) TN = d.TN.map((x) => String(x).slice(0, 24));

    if (Array.isArray(d.P)) {
      P = d.P.filter((p) => p && typeof p === "object")
        .slice(0, 48)
        .map((p) => {
          const o = {
            name: String(p.name || "").slice(0, 24),
            img: typeof p.img === "string" && IMG.test(p.img) ? p.img : "",
            team: Number.isInteger(p.team) && p.team < TN.length ? p.team : -1,
            weapon: WPN.includes(p.weapon) ? p.weapon : "",
            traits: Array.isArray(p.traits)
              ? p.traits.filter((x) => typeof x === "string").slice(0, 3)
              : [],
            job: typeof p.job === "string" ? p.job : "",
            fac: String(p.fac || "").slice(0, 20),
          };
          STATS.forEach(([k]) => {
            let v = p[k];
            if (
              v === undefined ||
              (mig && ["food", "water", "bottle", "ration", "kit"].includes(k))
            ) {
              v =
                DEFS[k] !== undefined
                  ? DEFS[k]
                  : OLD[k] && p[OLD[k]] !== undefined
                    ? p[OLD[k]] * 2
                    : 10;
            }
            o[k] = clamp_stat(k, v);
          });
          return o;
        });
    }

    const ev = (a, def) =>
      Array.isArray(a) && a.length && a.every((e) => e && typeof e.t === "string")
        ? a.map((e) => ({
            t: String(e.t).replace(/[\u0001\u0002]/g, "").slice(0, 160),
            v: String(e.v || "").replace(/[\u0001\u0002]/g, "").slice(0, 160),
            fx: String(e.fx || "none"),
            n: Math.max(0, Math.min(48, +e.n || 0)),
            ic: String(e.ic || "❓").slice(0, 8),
            ch: Math.max(0, Math.min(100, e.ch === undefined ? 100 : +e.ch)),
            on: !!e.on,
          }))
        : def;

    if (!mig) {
      SOLO = ev(d.SOLO, SOLO);
      DUO = ev(d.DUO, DUO);
      DIS = ev(d.DIS, DIS);
    }

    if (["auto", "light", "dark"].includes(d.theme)) THEME = d.theme;
    if (d.cnt) $("#cnt").value = d.cnt;
    if (d.size) $("#size").value = d.size;
    if (d.mode) $("#mode").value = d.mode;
    if (d.mgs) $("#mgs").value = d.mgs;
    if (d.endgame) $("#endgame").value = d.endgame;
    $("#ban").checked = !!d.ban;
    $("#nob").checked = !!d.nob;
    $("#lockleave").checked = !!d.lockleave;
    $("#diswipe").checked = !!d.diswipe;
    if (d.dim !== undefined) $("#dim").value = d.dim;
    if (typeof d.seed === "string") $("#seed").value = d.seed.slice(0, 24);
    if (typeof d.bg === "string" && d.bg.startsWith("data:image")) {
      set_bg(d.bg);
    }
    load_new(d);
  }
}

function load() {
  try {
    apply_setup(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch (e) {}
}

$("#wipe").onclick = () => {
  if (!confirm("Clear the saved roster, teams, events and settings on this device?")) return;
  nosave = true;
  clearTimeout(st);
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
  location.reload();
};

/* ---------- Import / Export ---------- */
$("#expBtn").onclick = () => {
  const data = {
    ver: 14,
    P: P.slice(0, contestant_count()),
    TN,
    SOLO,
    DUO,
    DIS,
    TRAITS,
    STATUS,
    REL,
    cnt: $("#cnt").value,
    size: $("#size").value,
    mode: $("#mode").value,
    ban: $("#ban").checked,
    nob: $("#nob").checked,
    lockleave: $("#lockleave").checked,
        diswipe: $("#diswipe").checked,
    mgs: $("#mgs").value,
    endgame: $("#endgame").value,
  };

  const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = `bloodbath-setup-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

$("#impBtn").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;

  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || typeof d !== "object" || !Array.isArray(d.P)) {
        throw new Error("Invalid file format.");
      }

      apply_setup(d);

      sync();
      update_mode_ui();
      draw_events();
      draw_tsr();
      save_soon();

      alert("Setup imported successfully!");
    } catch (err) {
      alert("Failed to import file: " + err.message);
      console.error(err);
    }
    e.target.value = "";
  };
  r.readAsText(f);
});

/* ---------- saved data for the new systems ---------- */
const clean_list = (a, F, job) =>
  Array.isArray(a)
    ? a
        .slice(0, 40)
        .filter((e) => e && typeof e === "object")
        .map((e) => {
          const o = {
            id: String(e.id || uid()).slice(0, 14),
            n: String(e.n || "?").slice(0, 24),
            ic: String(e.ic || "⭐").slice(0, 8),
          };
          if (job) o.kind = e.kind === "job" ? "job" : "trait";
          F.forEach(([k, lo, hi]) => {
            o[k] = num(e[k], lo, hi);
          });
          return o;
        })
    : null;

function load_new(d) {
  const t = clean_list(d.TRAITS, TF, true),
    s = clean_list(d.STATUS, SF, false);
  if (t) TRAITS = t;
  if (s) STATUS = s;
  if (Array.isArray(d.REL))
    REL = d.REL.filter(
      (r) =>
        r &&
        Number.isInteger(r.a) &&
        Number.isInteger(r.b) &&
        r.a !== r.b &&
        r.a >= 0 &&
        r.b >= 0 &&
        RN[r.type],
    )
      .slice(0, 100)
      .map((r) => ({ a: r.a, b: r.b, type: r.type }));
  P.forEach((p) => {
    p.traits = p.traits.filter((id) => TR(id) && TR(id).kind !== "job");
    if (!(TR(p.job) && TR(p.job).kind === "job")) p.job = "";
  });
}