/* data.js: Content and defaults only: names, weapons, stat ranges, default events/traits/statuses, tuning constants. */

const FIRST = ["Ash", "Freddy", "Michael", "Myst", "L", "Plushie", 
    "Gus", "Hana", "Iris", "Subaru", "Wei", "Yuki", "Arjun", "Min-ji", 
    "Chen", "Naruto", "Priya", "Ji-hoon", "Ananya", "Kenji", "Sasuke",
    "Goku", "Sans", "Statoru", "Sukuna", "Saul", "Steve", "Claude"];

const LAST = ["Ketchum", "Fazbear", "Jackson", "FGO", "Lawliet", "Mistress", 
    "Kim", "Natsuki", "Sato", "Cruz", "Uchiha", "Frost", "Bell", "Uzumaki", "Doyle", "Park",
    "Son", "Undertale", "Myers", "Gojo", "Ryumen", "Goodman", "Minecraft", "GPT"];

const WPN_STANDARD = ["Dagger", "Short Sword", "Long Sword", "Katana", "Spear", "Battle Axe", 
    "Bow", "Crossbow", "Halberd", "Metal Bat", "Rapier", "Zweihander", "Glaive", "Weapon gloves"];

const WPN_CRAFTED = ["Crude Bow", "Wooden Spear", "Wooden Club", "Stone Axe"];

const WPN = [...WPN_STANDARD, ...WPN_CRAFTED];

/* ---------- weapons ----------
   dmg: damage range on the HP scale. acc: accuracy bonus. crit: crit chance (0-1). cx: crit multiplier.
   init: acts earlier when higher. tags: finesse | reach | heavy | ranged. crafted: can break. */
const UNARMED = { tags: [], dmg: [5, 12], acc: 0, crit: 0.05, cx: 2, init: 6 };

const WEAPONS = {
  "Dagger": { tags: ["finesse"], dmg: [10, 18], acc: 2, crit: 0.12, cx: 2, init: 8 },
  "Short Sword": { tags: ["finesse"], dmg: [11, 20], acc: 1, crit: 0.08, cx: 2, init: 6 },
  "Rapier": { tags: ["finesse"], dmg: [11, 19], acc: 2, crit: 0.12, cx: 2, init: 7 },
  "Katana": { tags: ["finesse"], dmg: [13, 21], acc: 1, crit: 0.1, cx: 2.25, init: 5 },
  "Long Sword": { tags: [], dmg: [13, 23], acc: 0, crit: 0.06, cx: 2, init: 5 },
  "Metal Bat": { tags: [], dmg: [12, 21], acc: 0, crit: 0.06, cx: 2, init: 4 },
  "Weapon gloves": { tags: [], dmg: [10, 18], acc: 2, crit: 0.1, cx: 2, init: 7 },
  "Spear": { tags: ["reach"], dmg: [12, 20], acc: 1, crit: 0.06, cx: 2, init: 5 },
  "Glaive": { tags: ["reach", "heavy"], dmg: [15, 25], acc: -1, crit: 0.07, cx: 2, init: 4 },
  "Halberd": { tags: ["reach", "heavy"], dmg: [15, 26], acc: -1, crit: 0.07, cx: 2, init: 3 },
  "Battle Axe": { tags: ["heavy"], dmg: [16, 28], acc: -2, crit: 0.08, cx: 2.25, init: 3 },
  "Zweihander": { tags: ["heavy"], dmg: [17, 29], acc: -2, crit: 0.07, cx: 2, init: 2 },
  "Bow": { tags: ["ranged"], dmg: [11, 19], acc: 0, crit: 0.08, cx: 2, init: 5 },
  "Crossbow": { tags: ["ranged"], dmg: [20, 32], acc: 2, crit: 0.06, cx: 2, init: 6, reload: true },
  "Crude Bow": { tags: ["ranged"], dmg: [10, 17], acc: -2, crit: 0.04, cx: 1.5, init: 4, crafted: true },
  "Wooden Spear": { tags: ["reach"], dmg: [11, 18], acc: 0, crit: 0.04, cx: 1.5, init: 4, crafted: true },
  "Wooden Club": { tags: [], dmg: [10, 17], acc: -1, crit: 0.04, cx: 1.5, init: 3, crafted: true },
  "Stone Axe": { tags: ["heavy"], dmg: [13, 22], acc: -2, crit: 0.05, cx: 1.5, init: 2, crafted: true },
};

/* Combat tuning. Everything here is a starting value to be adjusted with sim_to_end(). */
const HIT_BASE = 0.75,
  HIT_STEP = 0.03,
  HIT_MIN = 0.15,
  HIT_MAX = 0.95;
/* Evade is on twice the accuracy scale (HIT_BASE is raised to match), so a point of WIS or INT moves the
   hit chance as much as DEX does. Two equal average fighters (all derived stats 5, no weapon bonus) meet at
   60%; higher-skilled pairs hit each other a little less, lower-skilled pairs a little more. */
const EVADE_SPD = 0.5,
  EVADE_WIT = 0.9,
  EVADE_INT = 0.6;
const CRIT_INT = 0.006,
  CRIT_WIT = 0.003,
  CRIT_MAX = 0.4;
/* Strength shifts the damage range instead of adding a flat bonus: above average it raises the
   floor (at most DMG_SHIFT of the range, so a 50-120 weapon never rolls below about 80), below average
   it lowers the ceiling, and each point above average adds CRIT_STR to the crit multiplier. */
const DMG_SHIFT = 0.43,
  CRIT_STR = 0.05;
/* How loot is judged: expected damage per exchange against a typical (evade 10) opponent. */
const RATING_EVADE = 10;
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
  STANDDOWN_P = 0.2;
const FLEE_HP = 0.45,
  FLEE_OUTNUM_HP = 0.6;
const YIELD_HP = 0.35,
  YIELD_GAP = 0.28;
/* A betrayer's opening blow: bonus accuracy and a multiplier on crit chance. */
const AMBUSH_ACC = 2,
  AMBUSH_CRIT = 2,
  AMBUSH_ESCAPE = 0.15; /* a hit-and-run ambusher picked the moment and the way out */
const SCUFFLE_CAP = 3; /* a brief scrap between two people: a few exchanges, then they part */
/* Helpers are not the main target, so they run more readily and get away more often. Each ally
   that has fallen or left shakes everyone's nerve. A yield is harder to honour with the yielder's
   friends still fighting. */
const HELPER_FLEE = 0.15,
  HELPER_ESCAPE = 0.2,
  MORALE_LOSS = 0.15,
  YIELD_PRESSURE = 0.1;
const TRIBUTE_P = 0.6,
  TRIBUTE_WEAPON_P = 0.5,
  SPARE_GRUDGE = 0.2;

/* ---------- stats and inventory ---------- */
const STATS = [
  ["str", "💪", "Strength: weapon damage", "STR"],
  ["dex", "🏃", "Dexterity: accuracy, evasion, initiative and escaping", "DEX"],
  ["con", "🛡️", "Constitution: max HP and disease resistance", "CON"],
  ["int", "📖", "Intelligence: crits, evasion and coordination", "INT"],
  ["wis", "🧠", "Wisdom: evasion, crits, foraging and hazards", "WIS"],
  ["cha", "💬", "Charisma: forming alliances", "CHA"],
  ["water", "💧", "Water: rounds before thirst", "Water"],
  ["food", "🍖", "Food: rounds before hunger", "Food"],
  ["bottle", "🍾", "Water bottles", "Bottles"],
  ["filter", "🚰", "Water filter: makes pond and river water safe to drink", "Filter"],
  ["ration", "🥫", "Rations", "Rations"],
  ["kit", "🩹", "Medkits", "Medkits"],
];

const ITEMS = ["bottle", "ration", "kit", "filter"];

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
  filter: [0, 1],
  ration: [0, 5],
  kit: [0, 5],
};

const DEFS = { water: 6, food: 24, bottle: 1, filter: 1, ration: 0, kit: 0 };

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
  ["hurtboth", "Short fight (text is generated)"],
  ["hurtb", "Ambush and run (text is generated)"],
  ["killb", "Deadly ambush (text is generated)"],
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

const FORAGE_BASE = 0.09,
  FORAGE_WIT = 0.025;

const WATER_BASE = 1, WATER_FIGHT = 0.75, WATER_BLEED = 1;
const FOOD_FIGHT = 2, FOOD_BLEED = 3, FOOD_STRESS = 0.5, EAT_AT = 8;
const HUNGER = [18, 14, 6];
const STARVE_FRAC = 0.07;
const DIRTY_WATER_P = 0.2, URINE_SICK_P = 0.35;

/* Shared reserve, scaled by the number of contestants (make_reserve in engine.js).
   Water sources: `per` units of water per contestant; `regen` is the share of the maximum that comes back
   each round. Animals: `per` animals per contestant, `food` is what one kill is worth, `tier` is its size
   (0 small, 1 medium, 2 large). Hunting each tier: base chance, plus the risk of getting hurt on a miss. */
const WATER_SOURCES = [
  { id: "stream", n: "stream", per: 2, regen: 0.1 },
  { id: "pond", n: "pond", per: 1.5, regen: 0.04 },
];
const ANIMALS = [
  { id: "rabbit", n: "rabbit", ic: "🐇", tier: 0, per: 0.4, food: 6, regen: 0.048 },
  { id: "fish", n: "fish", ic: "🐟", tier: 0, per: 0.32, food: 6, regen: 0.04 },
  { id: "deer", n: "deer", ic: "🦌", tier: 1, per: 0.18, food: 13, regen: 0.024 },
  { id: "boar", n: "boar", ic: "🐗", tier: 1, per: 0.12, food: 14, regen: 0.02 },
  { id: "bear", n: "bear", ic: "🐻", tier: 2, per: 0.048, food: 25, regen: 0.008 },
  { id: "wolf", n: "wolf pack", ic: "🐺", tier: 2, per: 0.048, food: 20, regen: 0.012 },
];
const TIERS = [
  { base: 0.75, hurt: 0 },
  { base: 0.55, hurt: 0.18 },
  { base: 0.35, hurt: 0.35 },
];
/* Control of water sources. A contestant may claim a source (chance rises with attack, with a group, and as water
   gets scarce) and camp there: CAMP_WATER free water a round, but no foraging or hunting, and they leave if they
   get hungry (or by chance, ABANDON_P). Allies drink freely; anyone else only gets in if desperate: a talk-down
   (TALK_WATER plus charisma), a fight, or being turned away. */
const CLAIM_BASE = 0.008, CLAIM_ATK = 0.003, CAMP_WATER = 2, ABANDON_P = 0.05, TALK_WATER = 0.15;

/* Chance per round that a contestant goes hunting: a base chance, more when hungry. */
const HUNT_BASE = 0.012, HUNT_NEED = 0.04;

/* Once the endgame is on, a talk-down succeeds this fraction as often (0.4 = 60% less likely). */
const ENDGAME_CALM = 0.4;

/* Vendetta: someone grieving a lover deals and takes more damage against that lover's killer. */
const VEND_DEALT = 1.5,
  VEND_TAKEN = 1.5;

/* Grief has no timer. It ends when the griever kills the killer, or each round by chance
   (base + WIS modifier * step, kept between 5% and 50%). */
const GRIEF_BASE = 0.15,
  GRIEF_WIS = 0.03,
  GRIEF_MIN = 2; /* rounds before grief can end: the griever gets at least one full round */

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

/* Visible label and hover tooltip for every editor field. */
const TLAB = {
  atk: "Damage",
  spd: "Speed",
  wit: "Wits",
  int: "Intellect",
  coord: "Coord %",
  betray: "Betray %",
  ally: "Ally %",
  heal: "Heal %",
  dmg: "HP loss %",
  dur: "Rounds",
};

const TL = {
  atk: "Damage: shifts the weapon's damage range up (or down) and raises the crit multiplier. Added to the 1-10 score from STR.",
  spd: "Speed: feeds accuracy, evasion and initiative, and helps escape. Added to the 1-10 score from DEX.",
  wit: "Wits: feeds evasion and crit chance. Added to the 1-10 score from WIS.",
  int: "Intellect: feeds crit chance and evasion. Added to the 1-10 score from INT.",
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
  { id: "soldier", n: "Soldier", ic: "🎖️", kind: "job", ...T0, atk: 2, coord: 10 },
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