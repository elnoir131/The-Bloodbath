const $ = (s) => document.querySelector(s);

const FIRST = ["Ash", "Freddy", "Michael", "Myst", "L", "Plushie", 
    "Gus", "Hana", "Iris", "Subary", "Wei", "Yuki", "Arjun", "Min-ji", 
    "Chen", "Naruto", "Priya", "Ji-hoon", "Ananya", "Kenji", "Sasuke"];

const LAST = ["Ketchum", "Fazbear", "Jackson", "FGO", "Lawliet", "Mistress", 
    "Kim", "Natsuki", "Sato", "Cruz", "Uchiha", "Frost", "Bell", "Uzumaki", "Doyle", "Park"];

const WPN_STANDARD = ["Dagger", "Short Sword", "Long Sword", "Katana", "Spear", "Battle Axe", 
    "Bow", "Crossbow", "Halberd", "Metal Bat", "Rapier", "Sweihander", "Glaive", "Weapon gloves"];
const WPN_CRAFTED = ["Crude Bow", "Wooden Spear", "Wooden Club", "Stone Axe"];

const WPN = [...WPN_STANDARD, ...WPN_CRAFTED];

/* ---------- randomness: everything in a match goes through rng so a seed reproduces it ---------- */
let rng = Math.random;

const rnd = (n) => Math.floor(rng() * n);
const pick = (a) => a[rnd(a.length)];
const chance = (p) => rng() < p;

function is_harmful(event) {
  const fx = event.fx || "";
  if (fx === "hurt" || fx === "die") return true;
  if (fx.startsWith("st:")) {
    const s = SD(fx.slice(3));
    return !!s && (s.dmg > 0 || s.atk + s.spd + s.wit < 0);
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

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash_string = (s) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const new_seed = () => {
  try {
    return (crypto.getRandomValues(new Uint32Array(1))[0] % 1000000) + 1;
  } catch (e) {
    return Math.floor(Math.random() * 1000000) + 1;
  }
};

const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const col = (j) => `hsl(${(j * 47) % 360} 60% 55%)`;

let GN = {}, tc = 0, BAN = false, NOB = false, LOCKLEAVE = false;
let P = [], TN = [], T = [], TM = [], R = 0, dead = [], pend = [],
  done = false, gid = 1000, M = "one", SEED = 0, THEME = "auto";

let OPEN = new Set(),
  OPENR = new Set(),
  SHOWALL = false;
let ENDGAME = false,
  ENDGAME_ANNOUNCED = false;
let FIN = false;
const mark_end = () => { FIN = true; $("#next").textContent = "Show results"; };
let current_bg = "";

/* ---------- stats and inventory ---------- */
const STATS = [
  ["str", "💪", "Strength: melee power", "STR"],
  ["dex", "🏃", "Dexterity: speed and escaping", "DEX"],
  ["con", "🛡️", "Constitution: toughness and disease resistance", "CON"],
  ["int", "📖", "Intelligence: tactics", "INT"],
  ["wis", "🧠", "Wisdom: survival instincts", "WIS"],
  ["cha", "💬", "Charisma: forming alliances", "CHA"],
  ["water", "💧", "Water: rounds before thirst", "Water"],
  ["food", "🍖", "Food: rounds before hunger", "Food"],
  ["bottle", "🍾", "Water bottles", "Bottles"],
  ["ration", "🥫", "Rations", "Rations"],
  ["kit", "🩹", "Medkits", "Medkits"],
];

const ITEMS = ["bottle", "ration", "kit"];
const SR = {
  str: [1, 20],
  dex: [1, 20],
  con: [1, 20],
  int: [1, 20],
  wis: [1, 20],
  cha: [1, 20],
  hp: [1, 100],
  water: [1, 12],
  food: [1, 99],
  bottle: [0, 5],
  ration: [0, 5],
  kit: [0, 5],
};
const DEFS = { hp: 100, water: 5, food: 40, bottle: 0, ration: 0, kit: 0 };

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
const contestant_count = () => Math.max(4, Math.min(48, +$("#cnt").value || 24));

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

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
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
            t: String(e.t).slice(0, 160),
            v: String(e.v || "").slice(0, 160),
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
    if (d.dim !== undefined) $("#dim").value = d.dim;
    if (typeof d.seed === "string") $("#seed").value = d.seed.slice(0, 24);
    if (typeof d.bg === "string" && d.bg.startsWith("data:image")) {
      set_bg(d.bg);
    }
    load_new(d);
  } catch (e) {}
}

function sync() {
  const n = contestant_count();
  $("#cnt").value = n;
  while (P.length < n) P.push(new_contestant());
  draw_setup();
}

function av(t) {
  return t.img
    ? `<img class="av" alt="" src="${t.img}">`
    : `<span class="av">${esc((t.name || t.n || "?")[0].toUpperCase())}</span>`;
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

/* ---------- images: the file pickers and clipboard paste share the same resizing ---------- */
function load_image(file, done) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => done(im);
    im.src = r.result;
  };
  r.readAsDataURL(file);
}

function set_photo_from_file(i, file) {
  load_image(file, (im) => {
    if (!P[i]) return;
    const c = document.createElement("canvas");
    c.width = c.height = 96;
    const x = c.getContext("2d"),
      m = Math.min(im.width, im.height);
    x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 96, 96);
    P[i].img = c.toDataURL("image/jpeg", 0.82);
    draw_people();
    save_soon();
  });
}

function set_bg_from_file(file) {
  load_image(file, (im) => {
    const k = Math.min(1, 1600 / Math.max(im.width, im.height)),
      c = document.createElement("canvas");
    c.width = im.width * k;
    c.height = im.height * k;
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    set_bg(c.toDataURL("image/jpeg", 0.8));
  });
}

/* Choosing an image: click a photo circle (or the Background image button) to get a small
   popup with the image on your clipboard, plus "Show all files" for the normal file picker.
   While the popup is open, Ctrl+V / Cmd+V pastes a copied image straight in. */
let image_popup = null;

function close_image_popup() {
  if (!image_popup) return;
  if (image_popup.url) URL.revokeObjectURL(image_popup.url);
  image_popup.el.remove();
  image_popup = null;
}

async function read_clipboard_image() {
  if (!navigator.clipboard || !navigator.clipboard.read) return null;
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) return await item.getType(type);
    }
  } catch (e) {
    /* permission denied, or the page is not focused */
  }
  return null;
}

function open_image_popup(anchor, use_image, show_files) {
  const same = image_popup && image_popup.anchor === anchor;
  close_image_popup();
  if (same) return;

  const el = document.createElement("div");
  el.className = "imgpop";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Choose an image");

  const files_btn = document.createElement("button");
  files_btn.className = "ghost";
  files_btn.textContent = "Show all files";
  const x_btn = document.createElement("button");
  x_btn.className = "ghost";
  x_btn.textContent = "\u00d7";
  x_btn.setAttribute("aria-label", "Close");
  const head = document.createElement("div");
  head.className = "imgpop-head";
  head.append(files_btn, x_btn);

  const title = document.createElement("h4");
  title.textContent = "Clipboard";
  const slot = document.createElement("div");
  slot.className = "imgpop-slot meta";
  slot.textContent = "Checking the clipboard\u2026";
  el.append(head, title, slot);
  document.body.appendChild(el);

  const place = () => {
    const r = anchor.getBoundingClientRect();
    el.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 8)) + "px";
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8)) + "px";
  };
  place();

  image_popup = { el, anchor, url: null, use_image };
  files_btn.onclick = () => {
    close_image_popup();
    show_files();
  };
  x_btn.onclick = close_image_popup;

  read_clipboard_image().then((blob) => {
    if (!image_popup || image_popup.el !== el) return;
    if (!blob) {
      slot.textContent = "No image on the clipboard. Copy one, then press Ctrl+V here.";
      place();
      return;
    }
    image_popup.url = URL.createObjectURL(blob);
    const thumb = document.createElement("button");
    thumb.className = "imgpop-thumb";
    thumb.title = "Use this image";
    const im = document.createElement("img");
    im.alt = "Clipboard image";
    im.onload = place;
    im.src = image_popup.url;
    thumb.append(im);
    thumb.onclick = () => {
      close_image_popup();
      use_image(blob);
    };
    slot.replaceChildren(thumb);
    place();
  });
}

document.addEventListener("pointerdown", (e) => {
  if (image_popup && !image_popup.el.contains(e.target) && !image_popup.anchor.contains(e.target)) {
    close_image_popup();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") close_image_popup();
});
window.addEventListener("scroll", close_image_popup, true);
document.addEventListener("paste", (e) => {
  const cb = e.clipboardData;
  if (!image_popup || !cb || cb.getData("text/plain")) return;
  const file = [...cb.files].find((f) => f.type.startsWith("image/"));
  if (!file) return;
  e.preventDefault();
  const use_image = image_popup.use_image;
  close_image_popup();
  use_image(file);
});

$("#teams").addEventListener("click", (e) => {
  const label = e.target.closest(".avl");
  if (!label || e.target.matches("input[type=file]")) return;
  e.preventDefault();
  const input = label.querySelector("input[data-img]");
  open_image_popup(
    label,
    (f) => set_photo_from_file(+input.dataset.img, f),
    () => input.click(),
  );
});

$("#bgf")
  .closest("label")
  .addEventListener("click", (e) => {
    if (e.target === $("#bgf")) return;
    e.preventDefault();
    open_image_popup(e.currentTarget, set_bg_from_file, () => $("#bgf").click());
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
  P.forEach((p) => (p.name = random_name()));
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
  $("#mgsWrap").hidden = !grp;
  $("#egWrap").hidden = grp;
}
$("#mode").onchange = update_mode_ui;

$("#setup").addEventListener("change", save_soon);
$("#setup").addEventListener("input", save_soon);

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

      if (Array.isArray(d.TN)) TN = d.TN;
      if (Array.isArray(d.SOLO)) SOLO = d.SOLO;
      if (Array.isArray(d.DUO)) DUO = d.DUO;
      if (Array.isArray(d.DIS)) DIS = d.DIS;
      if (Array.isArray(d.TRAITS)) TRAITS = d.TRAITS;
      if (Array.isArray(d.STATUS)) STATUS = d.STATUS;
      if (Array.isArray(d.REL)) REL = d.REL;

      if (d.cnt) $("#cnt").value = d.cnt;
      if (d.size) $("#size").value = d.size;
      if (d.mode) $("#mode").value = d.mode;
      if (d.mgs) $("#mgs").value = d.mgs;
      if (d.endgame) $("#endgame").value = d.endgame;
      $("#ban").checked = !!d.ban;
      $("#nob").checked = !!d.nob;
      $("#lockleave").checked = !!d.lockleave;

      P = d.P.map((p) => ({ ...new_contestant(), ...p }));

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

/* ---------- match ---------- */
let PG = [],
  PI = 0,
  VIEW_SNAPSHOT = null;

function start(sd) {
  const raw = $("#seed").value.trim();
  SEED = sd || (raw ? (/^\d{1,9}$/.test(raw) ? +raw : hash_string(raw)) : new_seed());
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
    ally: null,
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

const alive = () => T.filter((t) => t.alive);
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
  if (t.ally) t.ally.ally = null;
  t.ally = null;
  t.round = R;
  t.why = why || (by ? "killed by " + by.n : "wounds");
  pend.push(t);
  dead.push(t);
  if (by) by.k++;
  grief_of(t, by);
}

const settle = (L, ...ts) =>
  ts.forEach((t) => {
    if (t.alive && t.hp <= 0) {
      die(t);
      L.push([`${N(t)} succumbs to their wounds.`, "k", "💀"]);
    }
  });

const cannon = (f) =>
  f.length
    ? [`${f.length} cannon shot${f.length > 1 ? "s" : ""}: ${f.map(N).join(", ")}.`, "c"]
    : null;
const N = (t) => "\u0001" + t.id + "\u0002";
const fmt = (x) => {
  const s = String(x);
  if (s.startsWith("<div class='announce'>")) return s;
  return esc(s).replace(/\u0001(\d+)\u0002/g, (m, k) => `<b class="hl">${esc(T[k].n)}</b>`);
};
const ids = (x) => [...new Set([...x.matchAll(/\u0001(\d+)\u0002/g)].map((m) => +m[1]))];

const ICONS = [
  [/turns on/, "🔪"],
  [/ends the fight/, "🗡️💀"],
  [/trade blows/, "🤜🤛"],
  [/wounds/, "🗡️🩸"],
  [/takes the .* from the body/, "🎒"],
  [/gives chase/, "🏃"],
  [/alliance|joins|merge/, "🤝"],
  [/share a meal/, "🍽️"],
  [/argues/, "🗣️💢"],
  [/goes solo|sits alone/, "🚶"],
  [/ration crate/, "📦"],
  [/abandoned supply drop/, "🎒"],
  [/sleeps/, "💤"],
  [/traps a small animal/, "🐇"],
  [/slips on a ridge/, "🩸"],
  [/pit trap/, "🩸"],
  [/does not climb/, "💀"],
  [/snare/, "⚠️"],
  [/watches a rival/, "👁️"],
  [/hides in the reeds/, "🌿"],
  [/storm wall/, "⛈️"],
  [/flood siren|swept away|barely escapes/, "🌊"],
  [/fractures/, "💥"],
  [/hunger/, "🥀"],
  [/thirst/, "🥵"],
  [/bleeds out/, "🩸💀"],
  [/cannon/, "💀"],
  [/Nobody falls/, "🕊️"],
  [/Gamemakers/, "🚨"],
];

const icon = (x) => {
  for (const [r, e] of ICONS) if (r.test(x)) return e;
  return "";
};

function pics(x, e0) {
  const i = ids(x),
    e = e0 || icon(x),
    b = e ? `<span class="ic" aria-hidden="true">${e}</span>` : "";
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

function infect(t, L) {
  t.inf = true;
  L.push([`${N(t)}'s wound turns bad and a fever sets in.`, "h", "🦠"]);
}

function fight(a, b, L, ca, cb) {
  const p = (t) =>
    atk(t) +
    (t.w ? 3 : 0) +
    rnd(7) +
    (4 * t.hp) / t.mhp -
    (t.water <= 0 ? 3 : 0) +
    (t === a && ca ? atk(ca) * 0.6 : 0) +
    (t === b && cb ? atk(cb) * 0.6 : 0);
  let w = a,
    l = b;
  if (p(b) > p(a)) {
    w = b;
    l = a;
  }
  a.ex = b.ex = true;

  if (chance(0.15)) {
    L.push([`${N(a)} and ${N(b)} trade blows, then both back off, bloodied.`, "h"]);
    const da = hp_amount(a, 0.15),
      db = hp_amount(b, 0.15);
    a.hp -= da;
    b.hp -= db;
    a.dmg += da;
    b.dmg += db;
    settle(L, a, b);
    return;
  }

  if (
    chance(Math.max(0.03, Math.min(0.5, 0.1 + 0.03 * (spd(l) - spd(w)) + 0.1 * (1 - l.hp / l.mhp))))
  ) {
    L.push([`${N(l)} breaks away from ${N(w)} and escapes.`, "h", "💨"]);
    return;
  }

  const roll = Math.round(12 + 2.5 * atk(w) + (w.w ? 8 : 0) + rnd(16)),
    taken = Math.max(5, roll - 2 * ability_mod(l.con));
  w.dmg += Math.min(taken, Math.max(0, l.hp));
  l.hp -= taken;
  const how = w.w ? `with a ${w.w}` : "with bare hands";

  if (l.hp <= 0) {
    die(l, w);
    L.push([`${N(w)} catches ${N(l)} and ends the fight ${how}.`, "k"]);
    if (!w.w && l.w) {
      w.w = l.w;
      L.push([`${N(w)} takes the ${l.w} from the body.`, "a"]);
    }
    const got = ITEMS.reduce((n, k) => n + l[k], 0);
    ITEMS.forEach((k) => {
      w[k] += l[k];
      l[k] = 0;
    });
    if (got)
      L.push([
        `${N(w)} searches the body and takes ${got} suppl${got > 1 ? "ies" : "y"}.`,
        "a",
        "🎒",
      ]);
  } else {
    L.push([`${N(w)} wounds ${N(l)} ${how}, and ${N(l)} limps away.`, "h"]);
    if (taken >= 0.4 * l.mhp && !l.inf && chance(0.3 - ability_mod(l.con) * 0.03)) infect(l, L);
    if (taken >= 0.35 * l.mhp && l.alive) add_status(l, "bleed", L);
  }
}

const DEF_SOLO = [
  { t: "{a} eats suspicious berries and doubles over.", fx: "st:poison", ic: "☠️", on: true },
  { t: "{a} hears something huge in the dark and freezes.", fx: "st:fear", ic: "😨", on: true },
  {
    t: "{a} finds a quiet moment and steadies their nerves.",
    fx: "st:inspire",
    ic: "✨",
    on: true,
  },
  { t: "{a} steps too close to a smouldering vent.", fx: "st:burn", ic: "🔥", on: true },
  { t: "{a} drinks from a glowing spring and feels stronger.", fx: "st:regen", ic: "💚", on: true },
  {
    t: "{a} walks into a giant cactus in the dark and sees stars.",
    fx: "st:stun",
    ic: "🌵",
    on: true,
  },
  { t: "{a} cuts a hand on rusted wire.", fx: "st:bleed", ic: "🩸", on: true },
  { t: "{a} finds a sealed ration crate in a collapsed tower.", fx: "ration", ic: "📦", on: true },
  { t: "{a} pulls a {w} from an abandoned supply drop.", fx: "weapon", ic: "🎒", on: true },
  { t: "{a} sleeps in a hollow and recovers some strength.", fx: "heal", ic: "💤", on: true },
  { t: "{a} traps a small animal and eats well.", fx: "food", ic: "🐇", on: true },
  { t: "{a} slips on a ridge and tears open a leg.", fx: "hurt", ic: "🤕", on: true },
  { t: "{a} steps into a hidden pit trap.", fx: "hurt", ic: "🕳️", on: true },
  { t: "{a} watches a rival camp from the treeline and moves on.", fx: "none", ic: "👁️", on: true },
  { t: "{a} hides in the reeds as footsteps pass.", fx: "none", ic: "🌿", on: true },
  { t: "{a} finds a clean stream and drinks deeply.", fx: "water", ic: "🏞️", on: true },
  { t: "{a} collects rainwater in a torn tarp.", fx: "water", ic: "🌧️", on: true },
  { t: "{a} digs a dented canteen out of the rubble.", fx: "bottle", ic: "🍾", on: true },
  { t: "{a} cracks open a field medic's pouch.", fx: "medkit", ic: "🩹", on: true },
];

const DEF_DUO = [
  { t: "{a} flings a handful of poisoned thorns at {b}.", fx: "st:poison", ic: "☠️", on: true },
  { t: "{a} sets the grass alight around {b}.", fx: "st:burn", ic: "🔥", on: true },
  { t: "{a} clubs {b} across the head.", fx: "st:stun", ic: "😵", on: true },
  { t: "{a} gives {b} a rousing speech.", fx: "st:inspire", ic: "✨", on: true },
  {
    t: "{a} and {b} trade blows, then both back off, bloodied.",
    fx: "hurtboth",
    ic: "🗡️",
    on: true,
  },
  { t: "{a} gives chase, but {b} is too quick.", fx: "none", ic: "🏃💨", on: true },
  { t: "{a} steals supplies from {b} while they sleep.", fx: "steal", ic: "💰", on: true },
  { t: "{a} ambushes {b} and leaves them bleeding.", fx: "hurtb", ic: "🗡️", on: true },
];

const SFX = [
  ["none", "Nothing"],
  ["food", "Eat (+10 food)"],
  ["water", "Drink (+4 water)"],
  ["craft", "Craft scrap weapon"],
  ["ration", "Find a ration"],
  ["bottle", "Find a water bottle"],
  ["medkit", "Find a medkit"],
  ["heal", "Heal"],
  ["weapon", "Find weapon"],
  ["hurt", "Get hurt"],
  ["die", "Die"],
];

const DFX = [
  ["none", "Nothing"],
  ["hurtboth", "Hurt both"],
  ["hurtb", "Hurt second"],
  ["killb", "Kill second"],
  ["steal", "Steal supplies"],
];

let SOLO = JSON.parse(JSON.stringify(DEF_SOLO)),
  DUO = JSON.parse(JSON.stringify(DEF_DUO));

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

  const ev = SOLO.filter((e) => e.on);
  if (!ev.length) {
    L.push([`${N(a)} rests.`, "", "💤"]);
    return;
  }

  let e = pick_weighted(ev, a);
  if ((e.fx === "hurt" || e.fx === "die") && chance(wit(a) * 0.04)) e = pick_weighted(ev, a);

  let w = null;
  if (e.fx === "weapon") a.w = w = pick(WPN);
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

  if (a.hp <= 0 && a.alive) {
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
  if (e.fx === "steal" && chance(Math.min(0.6, wit(b) * 0.05))) {
    L.push([`${N(a)} tries to take supplies from ${N(b)}, but ${N(b)} wakes in time.`, "h", "💰"]);
    return;
  }
  if (e.fx === "hurtboth") {
    const da = hp_amount(a, 0.15),
      db = hp_amount(b, 0.15);
    a.hp -= da;
    b.hp -= db;
    a.dmg += da;
    b.dmg += db;
    a.ex = b.ex = true;
  }
  if (e.fx === "hurtb") {
    const d = Math.max(3, hp_amount(b, 0.12 + 0.015 * atk(a)) + rnd(10));
    b.hp -= d;
    a.dmg += d;
    a.ex = b.ex = true;
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

  L.push([fill(e.t, a, b), ["hurtboth", "hurtb", "killb"].includes(e.fx) ? "h" : "", e.ic]);
  if (e.fx.startsWith("st:")) add_status(b, e.fx.slice(3), L);

  if (e.fx === "killb") {
    die(b, a);
    L[L.length - 1][1] = "k";
  }
  settle(L, a, b);
}

function show_page(live) {
  const p = PG[PI];
  $("#log").setAttribute("aria-live", live ? "polite" : "off");
  $("#log").innerHTML = p
    ? p.raw ||
      `<div class="rd"><h3>${p.h}</h3>` +
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

function add_log(h, L, raw, txt) {
  const f = PI >= PG.length - 1;
  const snap = T.map((t) => ({
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
    g: t.g,
    left: t.left,
    round: t.round,
    why: t.why,
    w: t.w,
  }));
  PG.push({ h, L, raw, txt, snap });
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
    t.w = pick(WPN);
    L.push([`A sponsor sends ${N(t)} a ${t.w}.`, "a", "🎁"]);
  }
  drop("Sponsor drop", L);
  render();
}

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

const DEF_DIS = [
  {
    t: "Toxic spores drift across the arena.",
    v: "{a} breathes the spores.",
    fx: "st:poison",
    n: 3,
    ic: "☣️",
    on: true,
  },
  {
    t: "Fear toxin is released in the area.",
    v: "{a} breathes in the hallucinogenic gas.",
    fx: "st:fear",
    n: 4,
    ic: "😰",
    on: true,
  },
  {
    t: "A blinding flash lights up the sky.",
    v: "{a} is stunned by the light.",
    fx: "st:stun",
    n: 3,
    ic: "⚡",
    on: true,
  },
  {
    t: "The storm wall tightens. Anyone left outside gets caught.",
    v: "{a} is swept into the storm.",
    fx: "killweak",
    n: 2,
    ic: "⛈️",
    on: true,
  },
  {
    t: "A flood siren sounds in the lowlands.",
    v: "{a} is knocked off their feet by the water.",
    fx: "hurtrand",
    n: 3,
    ic: "🌊",
    on: true,
  },
  {
    t: "A wildfire races through the dry grass.",
    v: "{a} is scorched by the flames.",
    fx: "hurtrand",
    n: 3,
    ic: "🔥",
    on: true,
  },
  {
    t: "A meteor streaks overhead and crashes nearby.",
    v: "{a} is under it.",
    fx: "killrand",
    n: 1,
    ic: "☄️",
    on: true,
  },
  {
    t: "A heat wave bakes the arena and the streams shrink.",
    v: "",
    fx: "thirstall",
    n: 0,
    ic: "🌡️",
    on: true,
  },
  {
    t: "Heavy rain fills every hollow in the arena.",
    v: "",
    fx: "rainall",
    n: 0,
    ic: "🌧️",
    on: true,
  },
  {
    t: "A swarm of rubber ducks floods the arena.",
    v: "{a} slips on a rubber duck.",
    fx: "hurtrand",
    n: 2,
    ic: "🦆",
    on: false,
  },
  {
    t: "The sponsors air-drop free pizza for everyone.",
    v: "",
    fx: "healall",
    n: 0,
    ic: "🍕",
    on: false,
  },
  {
    t: "Loud music starts and everyone has to dance. Nobody knows why.",
    v: "",
    fx: "none",
    n: 0,
    ic: "🕺",
    on: false,
  },
];

const ZFX = [
  ["none", "Just for fun"],
  ["killweak", "Kill weakest"],
  ["killrand", "Kill random"],
  ["hurtrand", "Hurt random"],
  ["hurtall", "Hurt everyone"],
  ["healall", "Heal everyone"],
  ["foodall", "Feed everyone (+10 food)"],
  ["thirstall", "Dry up (-2 water)"],
  ["rainall", "Rain (+3 water)"],
];

let DIS = JSON.parse(JSON.stringify(DEF_DIS));

function run_disaster(d, L) {
  const al = alive();
  if (!al.length) return;
  L.push([d.t, "c", d.ic]);

  let v = [];
  if (d.fx === "killweak")
    v = al
      .map((t) => ({ t, s: (100 * t.hp) / t.mhp + spd(t) * 3 + wit(t) * 2 + rnd(30) }))
      .sort((x, y) => x.s - y.s)
      .slice(0, d.n)
      .map((o) => o.t);
  if (d.fx === "killrand" || d.fx === "hurtrand" || d.fx.startsWith("st:"))
    v = shuffle([...al]).slice(0, d.n);

  const out = (t) => {
    if (t.alive && t.hp <= 0) {
      die(t, null, "a disaster");
      L.push([`${N(t)} does not survive.`, "k", "💀"]);
    }
  };

  v.forEach((t) => {
    if (d.fx === "hurtrand") t.hp -= hp_amount(t, chance(0.3 + 0.04 * ability_mod(t.dex)) ? 0.15 : 0.3);
    else if (!d.fx.startsWith("st:")) t.hp = 0;
    L.push([
      fill(d.v || "{a} is caught up in it.", t),
      d.fx === "hurtrand" || d.fx.startsWith("st:") ? "h" : "k",
      d.ic,
    ]);
    out(t);
    if (d.fx.startsWith("st:")) add_status(t, d.fx.slice(3), L);
  });

  al.forEach((t) => {
    if (!t.alive) return;
    if (d.fx === "hurtall") {
      t.hp -= hp_amount(t, 0.15);
      out(t);
    }
    if (d.fx === "healall") heal(t, 0.25);
    if (d.fx === "foodall") gain_food(t, 10);
    if (d.fx === "thirstall") t.water = Math.max(0, t.water - 2);
    if (d.fx === "rainall") gain_water(t, 3);
  });
}

function hazard(L) {
  const ds = DIS.filter((e) => e.on);
  if (alive().length < 2 || !ds.length) return;
  run_disaster(pick_weighted(ds), L);
}

function drop(h, L) {
  const lp = PG[PG.length - 1];
  if (lp && !lp.raw) {
    lp.L.push(...L);
    if (PI === PG.length - 1) show_page(true);
  } else {
    add_log(h, L);
  }
}

const over = () =>
  alive().length <= 1 || (M === "grp" && new Set(alive().map((t) => t.g)).size <= 1);

function disaster() {
  if (done || FIN) return;
  const v = $("#dsT").value,
    d = v === "r" ? pick(DIS) : DIS[+v],
    L = [];
  if (!d) return;
  run_disaster(d, L);
  L.push(...XL.splice(0));
  const c = cannon(pend.splice(0));
  if (c) L.push(c);
  drop("Disaster", L);
  if (over()) mark_end();
  render();
}

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

  t.fx = t.fx.filter((s) => {
    const d = SD(s.id);
    if (!d) return false;
    t.hp = Math.min(t.mhp, t.hp - Math.round((t.mhp * d.dmg) / 100));
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

  if (t.hp <= 0 && t.alive) {
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
  const L = [];

  if (M === "one" && alive().length > 1) {
    const threshold = +$("#endgame").value || 5;
    const groups = new Set(alive().map((t) => t.g));

    if (!ENDGAME && (alive().length <= threshold || groups.size === 1)) {
      ENDGAME = true;
      ENDGAME_ANNOUNCED = true;
      L.push([
        "<div class='announce'>The endgame approaches. Alliances will fracture. Only one can survive.</div>",
        "c",
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
            "<div class='announce'>Alliances are forbidden. The Gamemakers strike the remaining teams.</div>",
            "c",
            "💀",
          ]);
          const ds = DIS.filter((e) => e.on);
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
      const m = pool.findIndex((x) => x.g === a.g);
      if (m >= 0 && chance(0.5)) i = m;
      const r = pool.findIndex((x) => relationship_of(a, x));
      if (r >= 0 && chance(0.4)) i = r;
      b = pool.splice(i, 1)[0];
    }
    if (!b) solo(a, L);
    else if (b.alive) pair(a, b, L);
  }

  if (R % 3 === 0 || R > 8 || (alive().length > 8 && R > 5 && chance(0.3))) hazard(L);

  L.push(...XL.splice(0));
  L.push(cannon(pend.splice(0)) || ["Nobody falls this round.", ""]);
  add_log(`${R % 2 ? "Day" : "Night"} ${Math.ceil(R / 2)}`, L);

  if (over()) mark_end();
  render();
}

const FORAGE_BASE = 0.12,
  FORAGE_WIT = 0.025;

function finish() {
  FIN = false; $("#next").textContent = "Next round";
  done = true;
  $("#next").disabled = $("#spB").disabled = $("#dsB").disabled = true;

  const al = alive().sort((x, y) => y.k - x.k),
    order = [...al, ...[...dead].reverse()];
  const info = (t) =>
    `${t.k} kill${t.k === 1 ? "" : "s"} · ${t.dmg} damage · ${t.alive ? "survived" : "out in round " + t.round + " (" + t.why + ")"}${t.team >= 0 ? " · started with " + TM[t.team].n : " · started solo"}`;
  const head = al.length
    ? `${al.map((t) => t.n).join(" & ")} ${al.length > 1 ? "win together" : "wins"} (${al.reduce((n, t) => n + t.k, 0)} kills, ${R} rounds)`
    : "No survivors";

  const d = document.createElement("div");
  d.className = "win";
  d.innerHTML =
    (al.length
      ? `${al.map(av).join("")}<h2>${esc(al.map((t) => t.n).join(" & "))} ${al.length > 1 ? "win together" : "wins"}</h2><p class="meta">${al.reduce((n, t) => n + t.k, 0)} kills · ${R} rounds · seed ${SEED}</p>`
      : `<h2>No survivors</h2><p class="meta">The arena claims everyone. Seed ${SEED}.</p>`) +
    `<ol>${order.map((t) => `<li>${esc(t.n)} <span class="meta">${esc(info(t))}</span></li>`).join("")}</ol>`;

  add_log(
    "Final results",
    [],
    d.outerHTML,
    head + "\n" + order.map((t, i) => `${i + 1}. ${t.n}: ${info(t)}`).join("\n"),
  );
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
      ? `<span class="meta dt">${abil(t)}</span><span class="meta dt">⚔${atk(t)} 💨${spd(t)} 🧠${wit(t)} · ❤${Math.max(0, Math.round(t.hp))}/${t.mhp} · 💧${+t.water.toFixed(1)} 🍖${Math.round(t.food)}${t.inf ? " · 🦠 infected" : ""}${t.left ? " · left a team" : ""}</span><span class="meta dt">🍶${t.bottle} 🥫${t.ration} 🩹${t.kit}</span>`
      : `<span class="meta dt">Out in round ${t.round}: ${esc(t.why)}</span>`;

  const row = (t) => {
    const op = SHOWALL || OPENR.has(t.id);
    return `
      <div class="t ${t.alive ? "" : "d"}${op ? " o" : ""}" data-id="${t.id}" tabindex="0" role="button" aria-expanded="${op}">
        ${av(t)}
        <div class="x">
          <b>${esc(t.n)}</b>
          <div class="hp"><i style="width:${Math.max(0, (100 * t.hp) / t.mhp)}%"></i></div>
          <span class="meta">${t.alive ? t.w || "unarmed" : "fallen"} · ${t.k} kill${t.k === 1 ? "" : "s"}${t.alive ? " " + sx(t) : ""}</span>
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

function export_log() {
  const nm = (x) => x.replace(/\u0001(\d+)\u0002/g, (m, k) => T[k].n);
  const out = [`# Last Light Arena (seed ${SEED})`, ""];
  PG.forEach((p) => {
    out.push(`## ${p.h}`);
    if (p.txt) out.push(p.txt);
    else p.L.forEach(([t]) => out.push("- " + nm(t.replace(/<[^>]+>/g, ""))));
    out.push("");
  });
  const b = new Blob([out.join("\n")], { type: "text/markdown" }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = `arena-seed-${SEED}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("#go").onclick = () => start();
$("#spB").onclick = sponsor;
$("#next").onclick = step;
$("#dsB").onclick = disaster;
$("#dl").onclick = export_log;
$("#replay").onclick = () => start(SEED);
$("#reset").onclick = () => {
  rng = Math.random;
  $("#arena").hidden = true;
  $("#setup").hidden = false;
};

function set_bg(u) {
  current_bg = u;
  const r = document.documentElement;
  r.style.setProperty("--bgimg", u ? `url(${u})` : "none");
  r.classList.toggle("hasbg", !!u);
  save_soon();
}

$("#dim").oninput = (e) => {
  document.documentElement.style.setProperty("--dim", e.target.value);
  save_soon();
};
$("#bgx").onclick = () => set_bg("");
$("#bgf").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) set_bg_from_file(f);
});

/* ---------- D&D-style abilities, traits, jobs, status effects and relationships ---------- */
const ability_mod = (s) => Math.floor((s - 10) / 2),
  signed = (n) => (n >= 0 ? "+" : "") + n;
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0)));
const uid = () => "x" + Math.floor(Math.random() * 1e8).toString(36);
const OLD = { str: "atk", dex: "spd", wis: "wit" };
const TF = [
  ["atk", -5, 5],
  ["spd", -5, 5],
  ["wit", -5, 5],
  ["coord", -50, 100],
  ["betray", -50, 100],
  ["ally", -50, 100],
  ["heal", 0, 100],
];
const SF = [
  ["dmg", -30, 30],
  ["atk", -5, 5],
  ["spd", -5, 5],
  ["wit", -5, 5],
  ["dur", 1, 10],
];
const TL = {
  atk: "Attack",
  spd: "Speed",
  wit: "Wits",
  coord: "Joint-attack chance (%)",
  betray: "Betrayal chance (% points)",
  ally: "Alliance chance (%)",
  heal: "Chance each round to patch up a groupmate (%)",
  dmg: "% of max HP lost each round (negative heals)",
  dur: "Rounds it lasts",
};
const T0 = { atk: 0, spd: 0, wit: 0, coord: 0, betray: 0, ally: 0, heal: 0 };
const DEF_TR = [
  { id: "coord", n: "Coordinated", ic: "🤝", kind: "trait", ...T0, coord: 30, ally: 5 },
  { id: "loyal", n: "Loyal", ic: "🐶", kind: "trait", ...T0, betray: -8 },
  { id: "traitor", n: "Treacherous", ic: "🐍", kind: "trait", ...T0, betray: 10 },
  { id: "brute", n: "Brute", ic: "🐗", kind: "trait", ...T0, atk: 2, spd: -1 },
  { id: "nimble", n: "Nimble", ic: "🤸", kind: "trait", ...T0, spd: 2 },
  { id: "sharp", n: "Sharp-eyed", ic: "🎯", kind: "trait", ...T0, wit: 2 },
  { id: "charm", n: "Charming", ic: "😊", kind: "trait", ...T0, ally: 15 },
  { id: "hot", n: "Hothead", ic: "🤬", kind: "trait", ...T0, atk: 1, wit: -1, betray: 5 },
  { id: "medic", n: "Medic", ic: "🩺", kind: "job", ...T0, heal: 35, wit: 1 },
  { id: "soldier", n: "Soldier", ic: "🪖", kind: "job", ...T0, atk: 2, coord: 10 },
  { id: "scout", n: "Scout", ic: "🧭", kind: "job", ...T0, spd: 1, wit: 1 },
  { id: "leader", n: "Leader", ic: "👑", kind: "job", ...T0, coord: 15, ally: 10 },
];
const DEF_ST = [
  { id: "bleed", n: "Bleeding", ic: "🩸", dmg: 4, atk: 0, spd: 0, wit: 0, dur: 3 },
  { id: "poison", n: "Poisoned", ic: "☠️", dmg: 6, atk: 0, spd: -1, wit: 0, dur: 3 },
  { id: "burn", n: "Burning", ic: "🔥", dmg: 8, atk: 0, spd: 0, wit: 0, dur: 2 },
  { id: "stun", n: "Stunned", ic: "😵", dmg: 0, atk: -3, spd: -3, wit: 0, dur: 2 },
  { id: "inspire", n: "Inspired", ic: "✨", dmg: 0, atk: 2, spd: 0, wit: 1, dur: 3 },
  { id: "fear", n: "Frightened", ic: "😱", dmg: 0, atk: -2, spd: 0, wit: 0, dur: 2 },
  { id: "regen", n: "Regenerating", ic: "💚", dmg: -5, atk: 0, spd: 0, wit: 0, dur: 3 },
  { id: "grief", n: "Grieving", ic: "💔", dmg: 0, atk: 2, spd: -2, wit: 0, dur: 3 },
];
const deep_clone = (a) => JSON.parse(JSON.stringify(a));
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

function join_group(a, b) {
  const max = +$("#mgs").value || 3;
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

function add_status(t, id, L) {
  const d = SD(id);
  if (!d || !t.alive) return;
  if (chance(Math.max(0, ability_mod(t.con) * 0.05))) {
    L.push([`${N(t)} resists the ${d.n.toLowerCase()}.`, "a", "🛡️"]);
    return;
  }
  const s = t.fx.find((x) => x.id === id);
  if (s) s.left = d.dur;
  else {
    t.fx.push({ id, left: d.dur });
    L.push([`${N(t)} is ${d.n.toLowerCase()}.`, "h", d.ic]);
  }
}

function grief_of(t, by) {
  RT.filter((r) => r.type === "lover" && (r.a === t.id || r.b === t.id)).forEach((r) => {
    const o = T[r.a === t.id ? r.b : r.a];
    if (!o || !o.alive) return;
    const d = SD("grief");
    if (d && !o.fx.some((s) => s.id === "grief")) o.fx.push({ id: "grief", left: d.dur });
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

function assist(x, y) {
  const i = POOL.findIndex(
    (t) =>
      t.alive &&
      t !== x &&
      t !== y &&
      (!LOCKLEAVE || (!t.left && !x.left)) &&
      (t.g === x.g || (x.fk && t.fk === x.fk)) &&
      relationship_of(t, y) !== "lover" &&
      relationship_of(t, x) !== "enemy",
  );
  if (i < 0) return null;
  const c = POOL[i];
  const p =
    0.08 +
    (trait_total(x, "coord") + trait_total(c, "coord")) / 100 +
    (ability_mod(x.int) + ability_mod(c.int)) * 0.01 +
    (x.fk && x.fk === c.fk ? 0.2 : 0) +
    (c.g === x.g ? 0.05 : 0);
  return chance(Math.min(0.85, Math.max(0, p))) ? POOL.splice(i, 1)[0] : null;
}

function fight_joint(a, b, L) {
  const ca = assist(a, b),
    cb = ca ? null : assist(b, a);
  if (ca) L.push([`${N(a)} and ${N(ca)} strike ${N(b)} together.`, "h", "⚔️"]);
  if (cb) L.push([`${N(b)} and ${N(cb)} close ranks against ${N(a)}.`, "h", "⚔️"]);
  fight(a, b, L, ca, cb);
}

function pair(a, b, L) {
  const rel = relationship_of(a, b),
    same = a.g === b.g,
    fac = a.fk && a.fk === b.fk,
    bt = (t) => trait_total(t, "betray");
  const can_join = (t) => !LOCKLEAVE || !t.left;

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
        "k",
        "🔪",
      ]);
      die(l, w);
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
    if (sa + sb <= (+$("#mgs").value || 3) && (!(sa > 1 && sb > 1) || chance(0.4))) {
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
  const dv = DUO.filter((e) => e.on);
  if (dv.length && chance(0.3)) {
    run_duo(pick_weighted(dv, a), a, b, L);
    return;
  }
  fight_joint(a, b, L);
}

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

/* ---------- setup: per-contestant faction, job and traits ---------- */
const describe = (x) =>
  TF.filter(([k]) => x[k])
    .map(([k]) => `${k} ${signed(x[k])}`)
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

const abil = (t) =>
  ["str", "dex", "con", "int", "wis", "cha"]
    .map((k) => `${k.toUpperCase()} ${t[k]} (${signed(ability_mod(t[k]))})`)
    .join(" · ") +
  (t.traits.length || t.job || t.fac
    ? "<br>" +
      [
        t.job && TR(t.job) ? TR(t.job).ic + " " + esc(TR(t.job).n) : "",
        ...t.traits.map((id) => (TR(id) ? TR(id).ic + " " + esc(TR(id).n) : "")),
        t.fac ? "🏷 " + esc(t.fac) : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "") +
  (t.fx.length
    ? "<br>" +
      t.fx
        .map((s) => (SD(s.id) ? SD(s.id).ic + " " + esc(SD(s.id).n) + " (" + s.left + ")" : ""))
        .join(" · ")
    : "");
const sx = (t) => t.fx.map((s) => (SD(s.id) || {}).ic || "").join("");

/* ---------- editors for traits, statuses and relationships ---------- */
const nrow = (e, i, k, F) => `<div class="erow" data-k="${k}" data-i="${i}">
  <input class="nm ei" maxlength="8" data-f="ic" value="${esc(e.ic)}" aria-label="Icon">
  <input class="nm et" maxlength="24" data-f="n" value="${esc(e.n)}" aria-label="Name">
  ${k === "t" ? `<select data-f="kind" aria-label="Type"><option value="trait"${e.kind !== "job" ? " selected" : ""}>Trait</option><option value="job"${e.kind === "job" ? " selected" : ""}>Job</option></select>` : ""}
  ${F.map(([f, lo, hi]) => `<label class="nl" title="${TL[f]}">${f}<input type="number" min="${lo}" max="${hi}" data-f="${f}" value="${e[f]}"></label>`).join("")}
  <button class="ghost" data-del aria-label="Delete">×</button></div>`;

const RN = { lover: "💞 Lovers", rival: "⚡ Rivals", enemy: "💢 Enemies" };
function rrow(r, i) {
  const o = P.slice(0, contestant_count())
    .map((p, j) => `<option value="${j}">${esc(p.name || "#" + (j + 1))}</option>`)
    .join("");
  const sel = (v) => o.replace(`value="${v}"`, `value="${v}" selected`);
  return `<div class="erow" data-k="r" data-i="${i}"><select data-f="a" aria-label="First">${sel(r.a)}</select>
    <select data-f="type" aria-label="Relationship">${Object.keys(RN)
      .map((x) => `<option value="${x}"${r.type === x ? " selected" : ""}>${RN[x]}</option>`)
      .join("")}</select>
    <select data-f="b" aria-label="Second">${sel(r.b)}</select><button class="ghost" data-del aria-label="Delete">×</button></div>`;
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
  if (k === "r") v = f === "type" ? v : +v;
  else if (sp) {
    v = num(v, sp[1], sp[2]);
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
  id: uid(),
  n: "New trait",
  ic: "⭐",
  kind: "trait",
  ...T0,
}));
$("#addJ").onclick = add_new_entry("t", () => ({
  id: uid(),
  n: "New job",
  ic: "💼",
  kind: "job",
  ...T0,
}));
$("#addX").onclick = add_new_entry("x", () => ({
  id: uid(),
  n: "New status",
  ic: "✨",
  dmg: 0,
  atk: 0,
  spd: 0,
  wit: 0,
  dur: 2,
}));
$("#addR").onclick = add_new_entry("r", () => ({ a: 0, b: 1, type: "rival" }));
$("#rndR").onclick = () => {
  const n = contestant_count(),
    types = ["lover", "rival", "rival", "enemy"];
  REL = [];
  for (let k = 0; k < Math.max(1, Math.floor(n / 6)); k++) {
    const a = Math.floor(Math.random() * n);
    let b = Math.floor(Math.random() * n);
    if (b === a) b = (a + 1) % n;
    REL.push({ a, b, type: types[Math.floor(Math.random() * types.length)] });
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

load();
sync();
update_mode_ui();
document.documentElement.style.setProperty("--dim", $("#dim").value);
apply_theme();
try {
  draw_events();
} catch (e) {
  console.error("event editor:", e);
}
try {
  draw_tsr();
} catch (e) {
  console.error("trait editor:", e);
}
try {
  draw_people();
} catch (e) {
  console.error("people editor:", e);
}