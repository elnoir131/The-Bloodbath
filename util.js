/* util.js: Pure helpers: randomness (seeded rng), string/colour helpers, avatar HTML. No game knowledge. */

const $ = (s) => document.querySelector(s);

/* ---------- randomness: everything in a match goes through rng so a seed reproduces it ---------- */
let rng = Math.random;

const rnd = (n) => Math.floor(rng() * n);

const pick = (a) => a[rnd(a.length)];

const chance = (p) => rng() < p;

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

function av(t) {
  return t.img
    ? `<img class="av" alt="" src="${esc(t.img)}">`
    : `<span class="av">${esc((t.name || t.n || "?")[0].toUpperCase())}</span>`;
}

const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0)));

const uid = () => "x" + Math.floor(Math.random() * 1e8).toString(36);

const deep_clone = (a) => JSON.parse(JSON.stringify(a));