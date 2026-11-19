# The Bloodbath

A customizable, text-based survival simulation game inspired by The Hunger Games, there is one similar to this made by Brantsteele, actually. Set up your contestants, tweak the rules, and watch the carnage unfold round by round.

## 🚀 How to Play
Since this is a vanilla HTML/CSS/JS project, there is no installation required. 
1. Clone or download this repository.
2. Open `index.html` in any modern web browser.
3. Set up your roster, click **Start the Match**, and hit **Next Round** to simulate.

## 🌟 Features :D 🌟

### The Setup
*   **Custom Roster:** Up to 48 contestants. Give them names, upload custom photos, and assign them to teams or leave them solo.
*   **Tabletop Stats:** Uses a D&D-style 1-20 scale (modifier = (score - 10) / 2). 
    *   💪 **STR:** Melee power.
    *   🏃 **DEX:** Speed and escaping.
    *   🛡️ **CON:** Soaks damage, resists infection, and determines Max HP.
    *   📖 **INT:** Tactics. Adds an edge in fights and helps joint-attack coordination.
    *   🧠 **WIS:** Survival instincts, finding water, dodging hazards.
    *   💬 **CHA:** Forming alliances, talking aggressors out of attacking you, and rallying groupmates to join a joint attack.
*   **Optional Rules:** Ban teaming, ban betrayal, lock leavers out of teams, let disasters kill everyone, and set the *Fair fight* and *Gamemakers* thresholds below.
*   **Win Conditions:** Play until there is *One survivor*, or allow the *Last group to share* the victory.

### The Simulation Engine
*   **Solo Events:** Unique encounters for each contestant (finding weapons, falling for traps, hunting,...).
*   **Duo Events:** Dynamic interactions when contestants cross paths (fights, alliances, betrayals,...).
*   **Joint Attacks:** Groupmates can pile onto one target. Every helper adds a flat bonus plus most of their own attack, and the outnumbered side finds it harder to escape, so being the one against several is dangerous unless you clearly out-stat them.
*   **Disasters:** Random (or manually triggered 😈) arena-wide hazards like wildfires, floods, or toxic spores.
*   **Status Effects:** Contestants can bleed, get poisoned, burn, or become infected. High CON allows them to resist though 😎.
*   **Relationships:** Set up Lovers (who seek each other and grieve for the other's death), Rivals, and Enemies (who hunt each other or incite betrayal 🤡).
*   **Traits & Jobs:** Assign passive traits per contestant and a specialized job (e.g., Medic, Soldier, Scout) to give them an edge.
*   **Last Survivor Rule:** Thirst, hunger, and wounds will never wipe out the very last person standing; they cling on at 1 HP. If a *disaster* would kill everyone left, the patrons step in and spare one contestant, and the higher the CHA, the better the odds (a 18 CHA beats an 8 CHA about 5 times out of 6). Tick **Disasters can kill everyone** under Optional rules to turn the rescue off and allow a match with no winner.
*   **Fair Fight:** When this many contestants or fewer remain (default 3, 0 = off), random disasters stop picking victims, so the last few settle it themselves. Area-wide disasters like heat waves and rain can still happen, and you can still trigger any disaster by hand.
*   **Gamemakers Step In:** After this many rounds in a row with no death and no combat (default 3, 0 = off), the Gamemakers act: a harmful disaster if many remain, or a forced fight between two survivors if few remain.
*   **Endgame Mode:** Once a certain number of players remain, alliances are forbidden, and the Gamemakers will strike down anyone trying to team up (f*ck lovers 💔).

### Quality of Life
*   **Time-Travel Roster:** Click "◀ Previous" in the log to rewind time. The roster on the left will update to show exactly who was alive, their HP, and their items during that specific past round.
*   **Import / Export:** Save your entire setup (roster, stats, custom events, relationships) to a `.json` file and share it with friends, or move it to another computer.
*   **Auto-Save:** Your backgrounds, dim settings, roster, and custom events are automatically saved to your browser's local storage.
*   **Round Summary:** Every round starts with a short header: how many are alive, who fell, who is low on health, and who fought. Handy when 24 people act in one round.
*   **Epilogue:** When the match ends, a short prose recap names the winner, the first to fall, the deadliest contestant, and what claimed everyone else.
*   **Seeds:** Every match has a seed. Use **Replay seed** to rerun it, or **Copy seed link** to share a `?seed=...` link that pre-fills the seed box. The same seed only plays out the same way with the same setup (roster, stats, events and rules), so share the exported setup too.
*   **Export Log:** Download a clean Markdown (`.md`) text file of the entire match to share on forums or Discord if you have no life...

## 🛠️ Customization Guide
Almost everything in the game can be edited in the setup screen:
*   **Event Weighting:** In the `%` column (0 to 100), a higher number means the event is more likely to happen. It acts as a weight, not a strict percentage (e.g., an event at 100% is twice as likely to be picked as one at 50%, and 0% never happens). High WIS also makes harmful events less likely to pick you.
*   **Placeholders:** In event texts, use `{a}` for the main character, `{b}` for the target in a duo event, and `{w}` for a random weapon name.
*   **Visual Themes:** Toggle between Light, Dark, and Auto themes, and upload custom background images with a dimming slider for readability.

## 💻 Tech Stack
Built entirely with Vanilla JavaScript, HTML5, and CSS3. No external libraries or frameworks required. Uses `localStorage` for persistence and CSS `color-mix` for modern UI styling.

## 📄 License
MIT. See [LICENSE](LICENSE).

---
*May the odds be ever in your favorite contestant's favor.*