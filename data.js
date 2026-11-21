/* data.js: Content and defaults only: names, weapons, stat ranges, default events/traits/statuses, tuning constants. */

const FIRST = ["Ash", "Freddy", "Michael", "Myst", "L", "Plushie", 
    "Gus", "Hana", "Iris", "Subary", "Wei", "Yuki", "Arjun", "Min-ji", 
    "Chen", "Naruto", "Priya", "Ji-hoon", "Ananya", "Kenji", "Sasuke"];

const LAST = ["Ketchum", "Fazbear", "Jackson", "FGO", "Lawliet", "Mistress", 
    "Kim", "Natsuki", "Sato", "Cruz", "Uchiha", "Frost", "Bell", "Uzumaki", "Doyle", "Park"];

const WPN_STANDARD = ["Dagger", "Short Sword", "Long Sword", "Katana", "Spear", "Battle Axe", 
    "Bow", "Crossbow", "Halberd", "Metal Bat", "Rapier", "Zweihander", "Glaive", "Weapon gloves"];

const WPN_CRAFTED = ["Crude Bow", "Wooden Spear", "Wooden Club", "Stone Axe"];

const WPN = [...WPN_STANDARD, ...WPN_CRAFTED];

/* ---------- weapons ----------
   dmg: damage range on the HP scale. acc: accuracy bonus. crit: crit chance (0-1). cx: crit multiplier.
   init: acts earlier when higher. tags: finesse | reach | heavy | ranged. crafted: can break. */
const UNARMED = { tags: [], dmg: [4, 10], acc: 0, crit: 0.05, cx: 2, init: 6 };

const WEAPONS = {
  "Dagger": { tags: ["finesse"], dmg: [9, 17], acc: 2, crit: 0.12, cx: 2, init: 8 },
  "Short Sword": { tags: ["finesse"], dmg: [11, 19], acc: 1, crit: 0.08, cx: 2, init: 6 },
  "Rapier": { tags: ["finesse"], dmg: [11, 19], acc: 2, crit: 0.12, cx: 2, init: 7 },
  "Katana": { tags: ["finesse"], dmg: [14, 24], acc: 1, crit: 0.1, cx: 2.5, init: 6 },
  "Long Sword": { tags: [], dmg: [13, 23], acc: 0, crit: 0.06, cx: 2, init: 5 },
  "Metal Bat": { tags: [], dmg: [12, 20], acc: 0, crit: 0.06, cx: 2, init: 4 },
  "Weapon gloves": { tags: [], dmg: [7, 13], acc: 1, crit: 0.08, cx: 2, init: 5 },
  "Spear": { tags: ["reach"], dmg: [12, 20], acc: 1, crit: 0.06, cx: 2, init: 5 },
  "Glaive": { tags: ["reach", "heavy"], dmg: [15, 25], acc: -1, crit: 0.07, cx: 2, init: 4 },
  "Halberd": { tags: ["reach", "heavy"], dmg: [16, 28], acc: -1, crit: 0.07, cx: 2, init: 3 },
  "Battle Axe": { tags: ["heavy"], dmg: [17, 31], acc: -2, crit: 0.08, cx: 2.5, init: 3 },
  "Zweihander": { tags: ["heavy"], dmg: [18, 32], acc: -2, crit: 0.07, cx: 2, init: 2 },
  "Bow": { tags: ["ranged"], dmg: [11, 19], acc: 0, crit: 0.08, cx: 2, init: 5 },
  "Crossbow": { tags: ["ranged"], dmg: [15, 25], acc: 1, crit: 0.06, cx: 2, init: 6, reload: true },
  "Crude Bow": { tags: ["ranged"], dmg: [8, 14], acc: -2, crit: 0.04, cx: 1.5, init: 4, crafted: true },
  "Wooden Spear": { tags: ["reach"], dmg: [9, 15], acc: 0, crit: 0.04, cx: 1.5, init: 4, crafted: true },
  "Wooden Club": { tags: [], dmg: [8, 14], acc: -1, crit: 0.04, cx: 1.5, init: 3, crafted: true },
  "Stone Axe": { tags: ["heavy"], dmg: [11, 19], acc: -2, crit: 0.05, cx: 1.5, init: 2, crafted: true },
};

/* Combat tuning. Everything here is a starting value to be adjusted with sim_to_end(). */
const HIT_BASE = 0.6,
  HIT_STEP = 0.04,
  HIT_MIN = 0.15,
  HIT_MAX = 0.95;
const EVADE_SPD = 0.5,
  EVADE_WIT = 0.35,
  EVADE_INT = 0.15;
const CRIT_INT = 0.006,
  CRIT_WIT = 0.003,
  CRIT_MAX = 0.4;
const HEAVY_STR = 12,
  HEAVY_PEN = 2,
  THIRST_PEN = 2,
  SWARM_PEN = 1,
  CRAFT_BREAK = 0.08;
const FIGHT_CAP = 10,
  DEATH_CAP = 15,
  LEAD_FOCUS = 0.7;
const BLEED_FRAC = 0.35,
  INFECT_FRAC = 0.4;

/* Ways out of a fight (fractions are of max HP). Stand-down: both hurt and level. Retreat: hurt, or
   outnumbered. Yield: the clearly losing side begs for mercy. Fights to the death have no way out. */
const STANDDOWN_HP = 0.5,
  STANDDOWN_GAP = 0.15,
  STANDDOWN_P = 0.3;
const FLEE_HP = 0.4,
  FLEE_OUTNUM_HP = 0.6;
const YIELD_HP = 0.35,
  YIELD_GAP = 0.25;
const TRIBUTE_P = 0.6,
  TRIBUTE_WEAPON_P = 0.5,
  SPARE_GRUDGE = 0.2;

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
  water: [1, 12],
  food: [1, 99],
  bottle: [0, 5],
  ration: [0, 5],
  kit: [0, 5],
};

const DEFS = { water: 5, food: 40, bottle: 0, ration: 0, kit: 0 };

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
  { t: "{a} lashes together a {w} from scrap.", fx: "craft", ic: "🔨", on: true },
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

const FORAGE_BASE = 0.12,
  FORAGE_WIT = 0.025;

/* Vendetta: someone grieving a lover deals and takes more damage against that lover's killer. */
const VEND_DEALT = 1.5,
  VEND_TAKEN = 1.5;

/* Grief has no timer. It ends when the griever kills the killer, or each round by chance
   (base + WIS modifier * step, kept between 5% and 50%). */
const GRIEF_BASE = 0.15,
  GRIEF_WIS = 0.03;

/* Partner choice: this share of the time an initiator leans on threat when picking a partner.
   Early on they go for weaker or hurt targets; late (endgame, or this fraction of the roster left)
   they go for the most dangerous one. Groupmates and relationships still override it. */
const LEAN_CHANCE = 0.35,
  LATE_FRAC = 1 / 3;

/* Extra chance that an enemy of the target joins someone else's attack on them. */
const FOE_JOIN = 0.25;

const OLD = { str: "atk", dex: "spd", wis: "wit" };

const TF = [
  ["atk", -5, 5],
  ["spd", -5, 5],
  ["wit", -5, 5],
  ["int", -5, 5],
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
  ["int", -5, 5],
  ["dur", 1, 10],
];

const TL = {
  atk: "Attack",
  spd: "Speed",
  wit: "Wits",
  int: "Intellect",
  coord: "Joint-attack chance (%)",
  betray: "Betrayal chance (% points)",
  ally: "Alliance chance (%)",
  heal: "Chance each round to patch up a groupmate (%)",
  dmg: "% of max HP lost each round (negative heals)",
  dur: "Rounds it lasts",
};

const T0 = { atk: 0, spd: 0, wit: 0, int: 0, coord: 0, betray: 0, ally: 0, heal: 0 };

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
  { id: "bleed", n: "Bleeding", ic: "🩸", dmg: 4, atk: 0, spd: 0, wit: 0, int: 0, dur: 3 },
  { id: "poison", n: "Poisoned", ic: "☠️", dmg: 6, atk: 0, spd: -1, wit: 0, int: 0, dur: 3 },
  { id: "burn", n: "Burning", ic: "🔥", dmg: 8, atk: 0, spd: 0, wit: 0, int: 0, dur: 2 },
  { id: "stun", n: "Stunned", ic: "😵", dmg: 0, atk: -3, spd: -3, wit: 0, int: 0, dur: 2 },
  { id: "inspire", n: "Inspired", ic: "✨", dmg: 0, atk: 2, spd: 0, wit: 1, int: 0, dur: 3 },
  { id: "fear", n: "Frightened", ic: "😱", dmg: 0, atk: -2, spd: 0, wit: 0, int: 0, dur: 2 },
  { id: "regen", n: "Regenerating", ic: "💚", dmg: -5, atk: 0, spd: 0, wit: 0, int: 0, dur: 3 },
  { id: "grief", n: "Grieving", ic: "💔", dmg: 0, atk: 2, spd: -2, wit: 0, int: 0, dur: 3 },
];

const RN = { lover: "💞 Lovers", rival: "⚡ Rivals", enemy: "💢 Enemies" };